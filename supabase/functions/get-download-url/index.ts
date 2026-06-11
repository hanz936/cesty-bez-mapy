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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry } from "../_shared/sentry.ts";

const allowedOrigins = [
  "https://cestybezmapy.cz",
  "https://www.cestybezmapy.cz",
  "https://cesty-bez-mapy-admin.vercel.app",
  "https://admin.cestybezmapy.cz",
  "https://cesty-bez-mapy-git-development-jana-novakovas-projects.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const body: GetDownloadRequest = await req.json();
    const { token } = body;

    if (!token) {
      return jsonResponse(req, 400, { error: "Chybí download token" });
    }

    console.log(`Verifying download token: ${token.substring(0, 8)}...`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tokenRow, error: tokenError } = await supabase
      .from("download_tokens")
      .select("id, token, asset_type, order_id, custom_itinerary_request_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (tokenError || !tokenRow) {
      console.error("Token not found:", tokenError?.message);
      return jsonResponse(req, 404, { error: "Neplatný download token" });
    }

    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return jsonResponse(req, 410, { error: "Platnost odkazu ke stažení vypršela" });
    }

    let response: GetDownloadResponse;

    if (tokenRow.asset_type === 'product_pdf') {
      response = await buildProductDownloads(supabase, tokenRow.order_id);
    } else if (tokenRow.asset_type === 'custom_itinerary_pdf') {
      response = await buildCustomItineraryDownload(supabase, tokenRow.custom_itinerary_request_id);
    } else {
      return jsonResponse(req, 500, { error: "Unknown asset_type" });
    }

    if (response.downloads.length === 0) {
      return jsonResponse(req, 404, { error: "Žádné PDF soubory nejsou dostupné ke stažení" });
    }

    await supabase
      .from("download_tokens")
      .update({ last_downloaded_at: new Date().toISOString() })
      .eq("id", tokenRow.id);

    await supabase.rpc('increment_download_count', { token_id: tokenRow.id });

    return jsonResponse(req, 200, response);

  } catch (error) {
    console.error("Error generating download URLs:", error);
    return jsonResponse(req, 500, { error: "Nepodařilo se vygenerovat odkaz ke stažení" });
  }
}, "get-download-url"));

function jsonResponse(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

async function buildProductDownloads(
  supabase: ReturnType<typeof createClient>,
  orderId: string,
): Promise<GetDownloadResponse> {
  const { data: orderItems, error } = await supabase
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

  if (error || !orderItems) {
    console.error("Order items not found:", error?.message);
    return { success: true, asset_type: 'product_pdf', downloads: [], expires_in: SIGNED_URL_TTL_SECONDS };
  }

  const downloads: DownloadItem[] = [];
  for (const item of orderItems) {
    // deno-lint-ignore no-explicit-any
    const product = item.products as any;
    if (!product?.pdf_url) continue;

    const { data: signed, error: signError } = await supabase.storage
      .from("products-pdfs")
      .createSignedUrl(product.pdf_url, SIGNED_URL_TTL_SECONDS);

    if (signError || !signed) {
      console.error(`Failed to sign URL for ${product.title}:`, signError?.message);
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
  supabase: ReturnType<typeof createClient>,
  requestId: string,
): Promise<GetDownloadResponse> {
  const { data: request, error } = await supabase
    .from("custom_itinerary_requests")
    .select("id, final_pdf_url, form_data")
    .eq("id", requestId)
    .single();

  if (error || !request?.final_pdf_url) {
    console.error("Custom request not found or no PDF:", error?.message);
    return { success: true, asset_type: 'custom_itinerary_pdf', downloads: [], expires_in: SIGNED_URL_TTL_SECONDS };
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("custom-itinerary-pdfs")
    .createSignedUrl(request.final_pdf_url, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed) {
    console.error(`Failed to sign URL for custom itinerary ${requestId}:`, signError?.message);
    return { success: true, asset_type: 'custom_itinerary_pdf', downloads: [], expires_in: SIGNED_URL_TTL_SECONDS };
  }

  // deno-lint-ignore no-explicit-any
  const destination = (request.form_data as any)?.specific_destination || "Tvůj individuální itinerář";

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
