// ================================================
// Supabase Edge Function: Get Download URL (unified)
// ================================================
// Validates download token, generates 1-hour signed URLs for assets in
// either products-pdfs (standard) or custom-itinerary-pdfs (custom)
// based on asset_type discriminator. Tokens created since audit 3.5.4 (F5)
// expire after 7 days (expires_at); tokens created before that are NULL
// (perpetual, kept for backward compatibility).
// Audit columns (download_count, last_downloaded_at) updated on each call.
// ================================================

import { createClient, type QueryData, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Database } from "../_shared/database.types.ts";
import { withSentry } from "../_shared/sentry.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/http.ts";
import { logInfo, logError } from "../_shared/log.ts";

interface GetDownloadRequest {
  token: string;
}

interface DownloadItem {
  product_id: string | null;
  product_title: string;
  download_url: string;
}

interface GetDownloadResponse {
  success: true;
  asset_type: 'product_pdf' | 'custom_itinerary_pdf';
  downloads: DownloadItem[];
  expires_in: number;
}

const SIGNED_URL_TTL_SECONDS = 3600;

Deno.serve(withSentry(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const body: GetDownloadRequest = await req.json();
    const { token } = body;

    if (!token) {
      return jsonResponse({ error: "Chybí download token" }, 400, cors);
    }

    logInfo("verifying_download_token", { tokenPrefix: token.substring(0, 8) });

    const supabase = createClient<Database>(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tokenRow, error: tokenError } = await supabase
      .from("download_tokens")
      .select("id, token, asset_type, order_id, custom_itinerary_request_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (tokenError || !tokenRow) {
      logError("download_token_not_found", { message: tokenError?.message });
      return jsonResponse({ error: "Neplatný download token" }, 404, cors);
    }

    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return jsonResponse({ error: "Platnost odkazu ke stažení vypršela" }, 410, cors);
    }

    let response: GetDownloadResponse;

    // DB CHECK constraint download_tokens_one_target guarantees order_id is
    // set iff asset_type='product_pdf' (and likewise for custom_itinerary_request_id) —
    // these null guards only narrow the column type for TS, they are unreachable in practice.
    if (tokenRow.asset_type === 'product_pdf') {
      if (!tokenRow.order_id) {
        return jsonResponse({ error: "Unknown asset_type" }, 500, cors);
      }
      response = await buildProductDownloads(supabase, tokenRow.order_id);
    } else if (tokenRow.asset_type === 'custom_itinerary_pdf') {
      if (!tokenRow.custom_itinerary_request_id) {
        return jsonResponse({ error: "Unknown asset_type" }, 500, cors);
      }
      response = await buildCustomItineraryDownload(supabase, tokenRow.custom_itinerary_request_id);
    } else {
      return jsonResponse({ error: "Unknown asset_type" }, 500, cors);
    }

    if (response.downloads.length === 0) {
      return jsonResponse({ error: "Žádné PDF soubory nejsou dostupné ke stažení" }, 404, cors);
    }

    await supabase
      .from("download_tokens")
      .update({ last_downloaded_at: new Date().toISOString() })
      .eq("id", tokenRow.id);

    await supabase.rpc('increment_download_count', { token_id: tokenRow.id });

    return jsonResponse(response, 200, cors);

  } catch (error) {
    logError("get_download_url_error", { message: error instanceof Error ? error.message : String(error) });
    return jsonResponse({ error: "Nepodařilo se vygenerovat odkaz ke stažení" }, 500, cors);
  }
}, "get-download-url"));

const productDownloadsQuery = (supabase: SupabaseClient<Database>, orderId: string) =>
  supabase
    .from("order_items")
    .select(`
      product_id,
      products (
        id,
        title,
        pdf_url
      )
    `)
    .eq("order_id", orderId);

type ProductDownloadsRow = QueryData<ReturnType<typeof productDownloadsQuery>>[number];

async function buildProductDownloads(
  supabase: SupabaseClient<Database>,
  orderId: string,
): Promise<GetDownloadResponse> {
  const { data: orderItems, error } = await productDownloadsQuery(supabase, orderId);

  if (error || !orderItems) {
    logError("order_items_not_found", { message: error?.message });
    return { success: true, asset_type: 'product_pdf', downloads: [], expires_in: SIGNED_URL_TTL_SECONDS };
  }

  const downloads: DownloadItem[] = [];
  for (const item of orderItems as ProductDownloadsRow[]) {
    const product = item.products;
    if (!product?.pdf_url) continue;

    const { data: signed, error: signError } = await supabase.storage
      .from("products-pdfs")
      .createSignedUrl(product.pdf_url, SIGNED_URL_TTL_SECONDS);

    if (signError || !signed) {
      logError("failed_to_sign_url", { productTitle: product.title, message: signError?.message });
      continue;
    }

    downloads.push({
      product_id: product.id,
      product_title: product.title,
      download_url: signed.signedUrl,
    });
  }

  return { success: true, asset_type: 'product_pdf', downloads, expires_in: SIGNED_URL_TTL_SECONDS };
}

async function buildCustomItineraryDownload(
  supabase: SupabaseClient<Database>,
  requestId: string,
): Promise<GetDownloadResponse> {
  const { data: request, error } = await supabase
    .from("custom_itinerary_requests")
    .select("id, final_pdf_url, form_data")
    .eq("id", requestId)
    .single();

  if (error || !request?.final_pdf_url) {
    logError("custom_request_not_found_or_no_pdf", { message: error?.message });
    return { success: true, asset_type: 'custom_itinerary_pdf', downloads: [], expires_in: SIGNED_URL_TTL_SECONDS };
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("custom-itinerary-pdfs")
    .createSignedUrl(request.final_pdf_url, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed) {
    logError("failed_to_sign_url_custom_itinerary", { requestId, message: signError?.message });
    return { success: true, asset_type: 'custom_itinerary_pdf', downloads: [], expires_in: SIGNED_URL_TTL_SECONDS };
  }

  const formData = request.form_data as { specific_destination?: string } | null;
  const destination = formData?.specific_destination || "Tvůj individuální itinerář";

  return {
    success: true,
    asset_type: 'custom_itinerary_pdf',
    downloads: [{
      product_id: null,
      product_title: destination,
      download_url: signed.signedUrl,
    }],
    expires_in: SIGNED_URL_TTL_SECONDS,
  };
}
