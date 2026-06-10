// deno-lint-ignore-file no-explicit-any
import { TAGS } from "./config.ts";
import { logEcomail } from "./log.ts";

/** Sjednotí existující a nové tagy (bez duplikátů, zachová pořadí). */
export function mergeTags(existing: string[], add: string[]): string[] {
  const out = [...existing];
  for (const t of add) if (!out.includes(t)) out.push(t);
  return out;
}

// mergeTags() definováno výše (Task 3).

interface SyncParams {
  client: any; // EcomailClient
  supabase: any; // service-role
  listId: number;
  customerId: string;
  orderId?: string;
  email: string;
  name?: string;
  force?: boolean;
}

export async function syncCustomerToEcomail(p: SyncParams): Promise<{ synced: boolean; subscriberId?: number; skipped?: boolean }> {
  // Guard: idempotence proti webhook retries (admin posílá force:true)
  if (!p.force && p.orderId) {
    const { data: order } = await p.supabase.from("orders").select("ecomail_synced").eq("id", p.orderId).single();
    if (order?.ecomail_synced) return { synced: true, skipped: true };
  }

  try {
    const existing = await p.client.getSubscriber(p.listId, p.email);
    const tags = mergeTags(existing?.tags ?? [], [TAGS.CUSTOMER]);
    const resp = await p.client.subscribe(
      p.listId,
      { email: p.email, name: p.name, source: "checkout", tags },
      { update_existing: true, skip_confirmation: true },
    );
    const subscriberId: number | undefined = resp.id ?? existing?.id;

    if (subscriberId) {
      await p.supabase.from("customers").update({ ecomail_subscriber_id: String(subscriberId) }).eq("id", p.customerId);
    }
    if (p.orderId) {
      await p.supabase.from("orders").update({ ecomail_synced: true }).eq("id", p.orderId);
    }
    await logEcomail(p.supabase, "subscribe", "success", { order_id: p.orderId ?? null, customer_id: p.customerId, email: p.email });
    return { synced: true, subscriberId };
  } catch (e) {
    await logEcomail(p.supabase, "subscribe", "failed", { order_id: p.orderId ?? null, customer_id: p.customerId, email: p.email }, String(e));
    return { synced: false };
  }
}
