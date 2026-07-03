// download-invoice-pdf — admin-only PDF proxy
import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { FakturoidClient, type TokenPersister } from "../create-invoice/fakturoid.ts";
import { serveEdge } from "../_shared/serveEdge.ts";
import { assertAdmin } from "../_shared/assertAdmin.ts";
import { logError } from "../_shared/log.ts";
import type { Database } from "../_shared/database.types.ts";

// Populated from ctx.supabaseAdmin at the top of the serveEdge handler on each
// invocation (no module-level client construction — see serveEdge migration).
// Referenced by the persister closure below, only ever invoked during request
// handling, i.e. after this assignment has run.
let supabase: SupabaseClient<Database>;

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

serveEdge({ auth: "user", fnName: "download-invoice-pdf", methods: "GET, OPTIONS" }, async (req, ctx) => {
  // Admin auth check
  const gate = await assertAdmin(ctx, {});
  if (!gate.ok) return gate.response;

  supabase = ctx.supabaseAdmin;

  const url = new URL(req.url);
  const invoiceIdStr = url.searchParams.get("invoice_id");
  const invoiceId = invoiceIdStr ? Number(invoiceIdStr) : NaN;
  if (!invoiceId || Number.isNaN(invoiceId)) {
    return new Response("Missing invoice_id", { status: 400 });
  }

  try {
    const pdf = await fakturoid.downloadPdf(invoiceId);
    return new Response(pdf.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="faktura-${invoiceId}.pdf"`,
      },
    });
  } catch (e) {
    logError("download_invoice_pdf_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return new Response("Stažení PDF se nezdařilo", {
      status: 502,
    });
  }
});
