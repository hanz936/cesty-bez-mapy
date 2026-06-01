// download-invoice-pdf — admin-only PDF proxy
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { FakturoidClient, type TokenPersister } from "../create-invoice/fakturoid.ts";
import { withSentry } from "../_shared/sentry.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const allowedOrigins = [
  "https://cesty-bez-mapy-admin.vercel.app",
  "https://admin.cestybezmapy.cz",
  "http://localhost:5173",
  "http://localhost:5174",
];

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
  };
}

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
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // Admin auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: cors });
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401, headers: cors });
  const { data: isAdmin } = await userClient.rpc("is_admin");
  if (!isAdmin) return new Response("Forbidden", { status: 403, headers: cors });

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
    return new Response(`PDF download failed: ${e instanceof Error ? e.message : e}`, {
      status: 502, headers: cors,
    });
  }
}, "download-invoice-pdf"));
