import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Database } from "../database.types.ts";
import { TAGS } from "./config.ts";
import { EcomailClient } from "./client.ts";
import { logEcomail } from "./log.ts";
import { logWarn } from "../log.ts";

/** Placeholder jména z checkout fallbacků — do Ecomailu se neposílají. */
const PLACEHOLDER_NAMES = new Set(["zákazník", "host", "neznámý zákazník"]);

export interface SplitName { name?: string; surname?: string }

/** Rozdělí celé jméno na křestní + příjmení (první token / zbytek). */
export function splitFullName(full?: string | null): SplitName {
  const normalized = (full ?? "").trim().replace(/\s+/g, " ");
  if (!normalized || PLACEHOLDER_NAMES.has(normalized.toLowerCase())) return {};
  const idx = normalized.indexOf(" ");
  if (idx === -1) return { name: normalized };
  return { name: normalized.slice(0, idx), surname: normalized.slice(idx + 1) };
}

/** Sjednotí existující a nové tagy (bez duplikátů, zachová pořadí). */
export function mergeTags(existing: string[], add: string[]): string[] {
  const out = [...existing];
  for (const t of add) if (!out.includes(t)) out.push(t);
  return out;
}

interface SyncParams {
  client: EcomailClient;
  supabase: SupabaseClient<Database>;
  listId: number;
  customerId: string;
  orderId?: string;
  email: string;
  name?: string;
  force?: boolean;
}

export async function syncCustomerToEcomail(p: SyncParams): Promise<{ synced: boolean; subscriberId?: number; skipped?: boolean }> {
  // Guard: idempotence proti webhook retries (admin posílá force:true).
  // Best-effort čtení — při jakékoli chybě/nenalezení pokračujeme k syncu (subscribe je idempotentní),
  // a hlavně NIKDY nethrowujeme do callera (webhook se nesmí rozbít).
  if (!p.force && p.orderId) {
    try {
      const { data: order, error } = await p.supabase
        .from("orders").select("ecomail_synced").eq("id", p.orderId).single();
      if (!error && order?.ecomail_synced) return { synced: true, skipped: true };
    } catch (_e) {
      // ignore — pokračuj k syncu
    }
  }

  try {
    const existing = await p.client.getSubscriber(p.listId, p.email);
    const tags = mergeTags(existing?.tags ?? [], [TAGS.CUSTOMER]);
    const { name, surname } = splitFullName(p.name);
    const resp = await p.client.subscribe(
      p.listId,
      { email: p.email, name, surname, source: "checkout", tags },
      { update_existing: true, skip_confirmation: true },
    );
    const rawId = resp.id ?? existing?.id;
    const subscriberId = rawId != null && Number.isFinite(Number(rawId)) ? Number(rawId) : undefined;

    if (subscriberId != null) {
      const { error: custErr } = await p.supabase
        .from("customers").update({ ecomail_subscriber_id: String(subscriberId) }).eq("id", p.customerId);
      if (custErr) logWarn("syncCustomer_set_subscriber_id_failed", { error: custErr.message });
    }
    if (p.orderId) {
      const { error: flagErr } = await p.supabase
        .from("orders").update({ ecomail_synced: true }).eq("id", p.orderId);
      if (flagErr) logWarn("syncCustomer_set_synced_flag_failed", { error: flagErr.message });
    }
    await logEcomail(p.supabase, "subscribe", "success", { order_id: p.orderId ?? null, customer_id: p.customerId, email: p.email });
    return { synced: true, subscriberId };
  } catch (e) {
    await logEcomail(p.supabase, "subscribe", "failed", { order_id: p.orderId ?? null, customer_id: p.customerId, email: p.email }, String(e));
    return { synced: false };
  }
}
