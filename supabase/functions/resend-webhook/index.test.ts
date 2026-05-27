import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleWebhook } from "./index.ts";

class FakeSupabase {
  // deno-lint-ignore no-explicit-any
  events: any[] = [];
  // deno-lint-ignore no-explicit-any
  suppressions: any[] = [];

  from(table: string) {
    const store = table === "email_events" ? this.events : this.suppressions;
    const key = table === "email_events" ? ["resend_email_id", "event_type"] : ["email"];

    return {
      // deno-lint-ignore no-explicit-any
      upsert(row: any, opts: { onConflict: string; ignoreDuplicates: boolean }) {
        const exists = store.some((existing) =>
          key.every((k) => existing[k] === row[k])
        );
        if (!exists) {
          store.push(row);
        } else if (!opts.ignoreDuplicates) {
          // would normally overwrite — our usage always sets ignoreDuplicates=true
          throw new Error("upsert without ignoreDuplicates not modeled in fake");
        }
        return Promise.resolve({ error: null });
      },
    };
  }
}

class GoodVerifier {
  verify(body: string, _h: Record<string, string>): unknown {
    return JSON.parse(body);
  }
}

class BadVerifier {
  verify(): unknown {
    throw new Error("invalid signature");
  }
}

const headers = {
  "svix-id": "msg_test",
  "svix-timestamp": "1700000000",
  "svix-signature": "v1,fake",
};

function deliveredEvent(to = "user@example.com") {
  return JSON.stringify({
    type: "email.delivered",
    data: { email_id: "email_1", to: [to] },
  });
}

function bouncedEvent(bounceType: string, to = "user@example.com") {
  return JSON.stringify({
    type: "email.bounced",
    data: { email_id: "email_2", to: [to], bounce: { type: bounceType } },
  });
}

function complainedEvent(to = "user@example.com") {
  return JSON.stringify({
    type: "email.complained",
    data: { email_id: "email_3", to: [to] },
  });
}

Deno.test("returns 400 when svix headers are missing", async () => {
  const supabase = new FakeSupabase();
  const result = await handleWebhook(deliveredEvent(), {}, supabase, new GoodVerifier());
  assertEquals(result.status, 400);
  assertEquals(supabase.events.length, 0);
});

Deno.test("returns 400 when signature is invalid", async () => {
  const supabase = new FakeSupabase();
  const result = await handleWebhook(deliveredEvent(), headers, supabase, new BadVerifier());
  assertEquals(result.status, 400);
  assertEquals(supabase.events.length, 0);
});

Deno.test("email.delivered logs event without suppressing", async () => {
  const supabase = new FakeSupabase();
  const result = await handleWebhook(deliveredEvent(), headers, supabase, new GoodVerifier());
  assertEquals(result.status, 200);
  assertEquals(supabase.events.length, 1);
  assertEquals(supabase.events[0].event_type, "email.delivered");
  assertEquals(supabase.suppressions.length, 0);
});

Deno.test("email.bounced Permanent suppresses with reason hard_bounce", async () => {
  const supabase = new FakeSupabase();
  const result = await handleWebhook(bouncedEvent("Permanent"), headers, supabase, new GoodVerifier());
  assertEquals(result.status, 200);
  assertEquals(supabase.events.length, 1);
  assertEquals(supabase.suppressions.length, 1);
  assertEquals(supabase.suppressions[0].reason, "hard_bounce");
  assertEquals(supabase.suppressions[0].email, "user@example.com");
});

Deno.test("email.bounced Transient logs event but does not suppress", async () => {
  const supabase = new FakeSupabase();
  const result = await handleWebhook(bouncedEvent("Transient"), headers, supabase, new GoodVerifier());
  assertEquals(result.status, 200);
  assertEquals(supabase.events.length, 1);
  assertEquals(supabase.suppressions.length, 0);
});

Deno.test("email.complained suppresses with reason complaint", async () => {
  const supabase = new FakeSupabase();
  const result = await handleWebhook(complainedEvent(), headers, supabase, new GoodVerifier());
  assertEquals(result.status, 200);
  assertEquals(supabase.suppressions.length, 1);
  assertEquals(supabase.suppressions[0].reason, "complaint");
});

Deno.test("duplicate event is no-op (idempotent)", async () => {
  const supabase = new FakeSupabase();
  await handleWebhook(bouncedEvent("Permanent"), headers, supabase, new GoodVerifier());
  await handleWebhook(bouncedEvent("Permanent"), headers, supabase, new GoodVerifier());
  assertEquals(supabase.events.length, 1);
  assertEquals(supabase.suppressions.length, 1);
});

Deno.test("complaint sticks: subsequent hard_bounce does not demote", async () => {
  const supabase = new FakeSupabase();
  // first: complaint
  await handleWebhook(complainedEvent("user@example.com"), headers, supabase, new GoodVerifier());
  // then: hard bounce for the SAME email but different event id
  const hardBounceLater = JSON.stringify({
    type: "email.bounced",
    data: { email_id: "email_later", to: ["user@example.com"], bounce: { type: "Permanent" } },
  });
  await handleWebhook(hardBounceLater, headers, supabase, new GoodVerifier());

  assertEquals(supabase.suppressions.length, 1);
  assertEquals(supabase.suppressions[0].reason, "complaint");
});

Deno.test("mixed-case recipient is stored lowercase in both tables", async () => {
  const supabase = new FakeSupabase();
  const event = JSON.stringify({
    type: "email.bounced",
    data: { email_id: "email_mixed", to: ["User@Example.COM"], bounce: { type: "Permanent" } },
  });
  await handleWebhook(event, headers, supabase, new GoodVerifier());
  assertEquals(supabase.events[0].email_to, "user@example.com");
  assertEquals(supabase.suppressions[0].email, "user@example.com");
});

Deno.test("recipient as string (not array) is normalized", async () => {
  const supabase = new FakeSupabase();
  const event = JSON.stringify({
    type: "email.delivered",
    data: { email_id: "email_str", to: "user@example.com" },
  });
  await handleWebhook(event, headers, supabase, new GoodVerifier());
  assertEquals(supabase.events[0].email_to, "user@example.com");
});
