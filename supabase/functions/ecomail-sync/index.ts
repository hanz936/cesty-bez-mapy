import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry } from "../_shared/sentry.ts";
import { makeEcomailClient, getEcomailListId } from "../_shared/ecomail/config.ts";
import { syncCustomerToEcomail } from "../_shared/ecomail/syncCustomer.ts";

const allowedOrigins = [
  "https://admin.cestybezmapy.cz",
  "https://cesty-bez-mapy-admin.vercel.app",
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

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });
}

interface Body { customer_id?: string; order_id?: string }

Deno.serve(withSentry(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401, cors);

  // Ověř, že volající je admin (is_admin() přes jeho JWT).
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: isAdmin, error: adminErr } = await userClient.rpc("is_admin");
  if (adminErr || isAdmin !== true) return json({ error: "forbidden" }, 403, cors);

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400, cors); }
  if (!body.customer_id) return json({ error: "customer_id_required" }, 400, cors);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: customer, error: custErr } = await admin
    .from("customers").select("id, email, name").eq("id", body.customer_id).single();
  if (custErr || !customer?.email) return json({ error: "customer_not_found" }, 404, cors);

  const result = await syncCustomerToEcomail({
    client: makeEcomailClient(),
    supabase: admin,
    listId: getEcomailListId(),
    customerId: customer.id,
    orderId: body.order_id,
    email: customer.email,
    name: customer.name ?? undefined,
    force: true,
  });

  if (!result.synced) return json({ error: "sync_failed" }, 502, cors);
  return json({ success: true, subscriber_id: result.subscriberId ?? null }, 200, cors);
}, "ecomail-sync"));
