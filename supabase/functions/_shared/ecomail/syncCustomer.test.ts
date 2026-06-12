import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { splitFullName, syncCustomerToEcomail } from "./syncCustomer.ts";

function fakeClient(existingTags: string[] | null) {
  const calls: any[] = [];
  return {
    calls,
    async getSubscriber() { return existingTags === null ? null : { id: 1, email: "a@b.cz", tags: existingTags, status: 1 }; },
    async subscribe(listId: number, data: any, o: any) { calls.push({ listId, data, o }); return { id: 555 }; },
  } as any;
}

function fakeSupabase(orderSynced = false) {
  const updates: Record<string, any[]> = {};
  const inserts: Record<string, any[]> = {};
  return {
    updates, inserts,
    from(table: string) {
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: { ecomail_synced: orderSynced }, error: null }) }) }),
        update: (row: any) => ({ eq: async (_c: string, _v: string) => { (updates[table] ??= []).push(row); return { error: null }; } }),
        insert: async (row: any) => { (inserts[table] ??= []).push(row); return { error: null }; },
      };
    },
  } as any;
}

Deno.test("syncCustomerToEcomail — happy path: tag zakaznik, single opt-in, nastaví flagy", async () => {
  const client = fakeClient(null);
  const supabase = fakeSupabase(false);
  const res = await syncCustomerToEcomail({
    client, supabase, listId: 7, customerId: "cust-1", orderId: "ord-1", email: "a@b.cz", name: "Jan Novák",
  });
  assertEquals(res.synced, true);
  assertEquals(res.subscriberId, 555);
  assertEquals(client.calls[0].data.tags, ["zakaznik"]);
  assertEquals(client.calls[0].o.skip_confirmation, true);
  assertEquals(supabase.updates["customers"][0].ecomail_subscriber_id, "555");
  assertEquals(supabase.updates["orders"][0].ecomail_synced, true);
  assertEquals(supabase.inserts["integration_logs"][0].status, "success");
});

Deno.test("syncCustomerToEcomail — merge zachová newsletter tag", async () => {
  const client = fakeClient(["newsletter"]);
  const res = await syncCustomerToEcomail({
    client, supabase: fakeSupabase(false), listId: 7, customerId: "c", orderId: "o", email: "a@b.cz",
  });
  assertEquals(client.calls[0].data.tags.sort(), ["newsletter", "zakaznik"]);
  assertEquals(res.synced, true);
});

Deno.test("syncCustomerToEcomail — guard: už synced a bez force → skip", async () => {
  const client = fakeClient(null);
  const res = await syncCustomerToEcomail({
    client, supabase: fakeSupabase(true), listId: 7, customerId: "c", orderId: "o", email: "a@b.cz",
  });
  assertEquals(res.skipped, true);
  assertEquals(client.calls.length, 0);
});

Deno.test("syncCustomerToEcomail — selhání Ecomailu → synced:false + log failed, nethrowuje", async () => {
  const client = { async getSubscriber() { return null; }, async subscribe() { throw new Error("boom"); } } as any;
  const supabase = fakeSupabase(false);
  const res = await syncCustomerToEcomail({ client, supabase, listId: 7, customerId: "c", orderId: "o", email: "a@b.cz" });
  assertEquals(res.synced, false);
  assertEquals(supabase.inserts["integration_logs"][0].status, "failed");
});

Deno.test("syncCustomerToEcomail — guard DB read throws → nethrowuje, pokračuje k syncu", async () => {
  const badGuardSupabase = {
    from(_t: string) {
      return {
        select: () => ({ eq: () => ({ single: async () => { throw new Error("row not found"); } }) }),
        update: (_row: any) => ({ eq: async () => ({ error: null }) }),
        insert: async () => ({ error: null }),
      };
    },
  } as any;
  const client = fakeClient(null);
  const res = await syncCustomerToEcomail({
    client, supabase: badGuardSupabase, listId: 7, customerId: "c", orderId: "o", email: "a@b.cz",
  });
  // Klíč: nevyhodí výjimku; guard chybu spolkne a sync proběhne.
  assertEquals(res.synced, true);
});

Deno.test("splitFullName — dvě slova → name + surname", () => {
  assertEquals(splitFullName("Jan Novák"), { name: "Jan", surname: "Novák" });
});

Deno.test("splitFullName — jedno slovo → jen name", () => {
  assertEquals(splitFullName("Jan"), { name: "Jan" });
});

Deno.test("splitFullName — víceslovné příjmení + přebytečné mezery", () => {
  assertEquals(splitFullName("  Jan   van der Berg "), { name: "Jan", surname: "van der Berg" });
});

Deno.test("splitFullName — prázdné/null/undefined → {}", () => {
  assertEquals(splitFullName(""), {});
  assertEquals(splitFullName("   "), {});
  assertEquals(splitFullName(null), {});
  assertEquals(splitFullName(undefined), {});
});

Deno.test("splitFullName — placeholder jména → {} (case-insensitive)", () => {
  assertEquals(splitFullName("Zákazník"), {});
  assertEquals(splitFullName("Host"), {});
  assertEquals(splitFullName("Neznámý zákazník"), {});
  assertEquals(splitFullName("neznámý zákazník"), {});
});
