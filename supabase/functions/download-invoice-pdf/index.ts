// download-invoice-pdf — admin-only PDF proxy
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { FakturoidClient, type TokenPersister } from "../create-invoice/fakturoid.ts";
import { withSentry } from "../_shared/sentry.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/requireAdmin.ts";
import { logError } from "../_shared/log.ts";
import type { Database } from "../_shared/database.types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY);

const persister: TokenPersister = {
  async load() {
    const { data } = await supabase.from("fakturoid_tokens").select("*").maybeSingle();
    if (!data) return null;
    return { token: data.access_token, expiresAt: new Date(data.expires_at) };
  },
  async save(t) {
    await supabase.from("fakturoid_tokens").upsert({
      id: true, access_token: t.token, expires_at: t.expiresAt.toISOString(), updated_at: new Date().toISOString(),
    });
  },
};

const fakturoid = new FakturoidClient({
  clientId: Deno.env.get("FAKTUROID_CLIENT_ID")!,
  clientSecret: Deno.env.get("FAKTUROID_CLIENT_SECRET")!,
  slug: Deno.env.get("FAKTUROID_SLUG")!,
  userAgent: Deno.env.get("FAKTUROID_USER_AGENT")!,
}, fetch, { persister });

Deno.serve(withSentry(async (req) => {
  const cors = getCorsHeaders(req, { methods: "GET, OPTIONS" });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // Admin auth check
  const gate = await requireAdmin(req, cors);
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const invoiceIdStr = url.searchParams.get("invoice_id");
  const invoiceId = invoiceIdStr ? Number(invoiceIdStr) : NaN;
  if (!invoiceId || Number.isNaN(invoiceId)) {
    return new Response("Missing invoice_id", { status: 400, headers: cors });
  }

  try {
    const pdf = await fakturoid.downloadPdf(invoiceId);
    return new Response(pdf.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="faktura-${invoiceId}.pdf"`,
      },
    });
  } catch (e) {
    logError("download_invoice_pdf_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return new Response("Stažení PDF se nezdařilo", {
      status: 502, headers: cors,
    });
  }
}, "download-invoice-pdf"));
