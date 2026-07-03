import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { makeEcomailClient, getEcomailListId } from "../_shared/ecomail/config.ts";
import { syncCustomerToEcomail } from "../_shared/ecomail/syncCustomer.ts";
import { jsonResponse } from "../_shared/http.ts";
import { serveEdge } from "../_shared/serveEdge.ts";
import { assertAdmin } from "../_shared/assertAdmin.ts";
import type { Database } from "../_shared/database.types.ts";

interface Body { customer_id?: string; order_id?: string }

serveEdge({ auth: "user", fnName: "ecomail-sync" }, async (req, ctx) => {
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405, {});

  // Ověř, že volající je admin (is_admin() přes jeho JWT).
  const gate = await assertAdmin(ctx, {});
  if (!gate.ok) return gate.response;

  let body: Body;
  try { body = await req.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400, {}); }
  if (!body.customer_id) return jsonResponse({ error: "customer_id_required" }, 400, {});

  const admin: SupabaseClient<Database> = ctx.supabaseAdmin;
  const { data: customer, error: custErr } = await admin
    .from("customers").select("id, email, name").eq("id", body.customer_id).single();
  if (custErr || !customer?.email) return jsonResponse({ error: "customer_not_found" }, 404, {});

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

  if (!result.synced) return jsonResponse({ error: "sync_failed" }, 502, {});
  return jsonResponse({ success: true, subscriber_id: result.subscriberId ?? null }, 200, {});
});
