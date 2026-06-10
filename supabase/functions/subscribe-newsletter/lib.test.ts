import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mergeTags } from "../_shared/ecomail/syncCustomer.ts";
import { processNewsletterSignup } from "./lib.ts";

// Fake EcomailClient
function fakeClient(opts: { existingTags?: string[] | null }) {
  const calls: any[] = [];
  return {
    calls,
    async getSubscriber(_listId: number, _email: string) {
      return opts.existingTags === null ? null : { id: 1, email: _email, tags: opts.existingTags ?? [], status: 1 };
    },
    async subscribe(listId: number, data: any, o: any) {
      calls.push({ listId, data, o });
      return { id: 999 };
    },
  } as any;
}

// Fake supabase zachycující inserty
function fakeSupabase() {
  const inserts: Record<string, any[]> = {};
  return {
    inserts,
    from(table: string) {
      return { insert: async (row: any) => { (inserts[table] ??= []).push(row); return { error: null }; } };
    },
  } as any;
}

Deno.test("mergeTags — sjednotí bez duplikátů", () => {
  assertEquals(mergeTags(["newsletter"], ["zakaznik"]).sort(), ["newsletter", "zakaznik"]);
  assertEquals(mergeTags(["zakaznik"], ["zakaznik"]), ["zakaznik"]);
  assertEquals(mergeTags([], ["newsletter"]), ["newsletter"]);
});

Deno.test("processNewsletterSignup — nový odběratel: double opt-in + consent log + tag newsletter", async () => {
  const client = fakeClient({ existingTags: null });
  const supabase = fakeSupabase();
  const res = await processNewsletterSignup({
    client, supabase, listId: 7,
    email: "a@b.cz", ip: "1.2.3.4", userAgent: "UA", privacyPolicyVersion: "2026-06-01",
  });
  assertEquals(res.success, true);
  assertEquals(supabase.inserts["newsletter_consent_log"][0].source, "footer");
  assertEquals(supabase.inserts["newsletter_consent_log"][0].consent_given, true);
  assertEquals(client.calls[0].o.skip_confirmation, false);
  assertEquals(client.calls[0].data.tags, ["newsletter"]);
  assertEquals(supabase.inserts["integration_logs"][0].status, "success");
});

Deno.test("processNewsletterSignup — existující zákazník: merge tagů zachová zakaznik", async () => {
  const client = fakeClient({ existingTags: ["zakaznik"] });
  const supabase = fakeSupabase();
  await processNewsletterSignup({
    client, supabase, listId: 7, email: "a@b.cz", ip: null, userAgent: null, privacyPolicyVersion: "v1",
  });
  assertEquals(client.calls[0].data.tags.sort(), ["newsletter", "zakaznik"]);
});

Deno.test("processNewsletterSignup — selhání Ecomailu: log 'failed' + rethrow", async () => {
  const client = { async getSubscriber() { return null; }, async subscribe() { throw new Error("boom"); } } as any;
  const supabase = fakeSupabase();
  let threw = false;
  try {
    await processNewsletterSignup({
      client, supabase, listId: 7, email: "a@b.cz", ip: null, userAgent: null, privacyPolicyVersion: "v1",
    });
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
  assertEquals(supabase.inserts["integration_logs"][0].status, "failed");
});
