import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry } from "../_shared/sentry.ts";
import { makeEcomailClient, getEcomailListId } from "../_shared/ecomail/config.ts";
import { syncCustomerToEcomail } from "../_shared/ecomail/syncCustomer.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/http.ts";
import { requireAdmin } from "../_shared/requireAdmin.ts";
import type { Database } from "../_shared/database.types.ts";

interface Body { customer_id?: string; order_id?: string }

Deno.serve(withSentry(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405, cors);

  // Ověř, že volající je admin (is_admin() přes jeho JWT).
  const gate = await requireAdmin(req, cors);
  if (!gate.ok) return gate.response;

  let body: Body;
  try { body = await req.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400, cors); }
  if (!body.customer_id) return jsonResponse({ error: "customer_id_required" }, 400, cors);

  const admin = createClient<Database>(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: customer, error: custErr } = await admin
    .from("customers").select("id, email, name").eq("id", body.customer_id).single();
  if (custErr || !customer?.email) return jsonResponse({ error: "customer_not_found" }, 404, cors);

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

  if (!result.synced) return jsonResponse({ error: "sync_failed" }, 502, cors);
  return jsonResponse({ success: true, subscriber_id: result.subscriberId ?? null }, 200, cors);
}, "ecomail-sync"));
