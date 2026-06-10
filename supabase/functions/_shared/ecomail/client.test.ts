import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { EcomailClient, EcomailError } from "./client.ts";

interface FetchCall { url: string; init?: RequestInit }

function makeFakeFetch(responses: Array<{ status: number; body: unknown; headers?: Record<string, string> }>) {
  const calls: FetchCall[] = [];
  let i = 0;
  const fn = async (url: string | URL, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(url), init });
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { "Content-Type": "application/json", ...(r.headers ?? {}) },
    });
  };
  return { fn, calls };
}

const CFG = { apiKey: "key_test", baseUrl: "https://api2.ecomailapp.cz" };

Deno.test("subscribe — POSTuje na /lists/{id}/subscribe a vrací id", async () => {
  const { fn, calls } = makeFakeFetch([
    { status: 200, body: { id: 259471, already_subscribed: false } },
  ]);
  const client = new EcomailClient(CFG, fn);
  const res = await client.subscribe(7, { email: "a@b.cz", tags: ["zakaznik"] }, { update_existing: true, skip_confirmation: true });
  assertEquals(res.id, 259471);
  assertEquals(calls[0].url, "https://api2.ecomailapp.cz/lists/7/subscribe");
  assertEquals(calls[0].init?.method, "POST");
  assertEquals((calls[0].init?.headers as Record<string, string>)["key"], "key_test");
  const body = JSON.parse(calls[0].init!.body as string);
  assertEquals(body.subscriber_data.email, "a@b.cz");
  assertEquals(body.subscriber_data.tags, ["zakaznik"]);
  assertEquals(body.update_existing, true);
  assertEquals(body.skip_confirmation, true);
});

Deno.test("getSubscriber — vrací subscriber s tagy", async () => {
  const { fn, calls } = makeFakeFetch([
    { status: 200, body: { id: 12345, email: "a@b.cz", tags: ["newsletter"], status: 1 } },
  ]);
  const client = new EcomailClient(CFG, fn);
  const sub = await client.getSubscriber(7, "a@b.cz");
  assertEquals(sub?.id, 12345);
  assertEquals(sub?.tags, ["newsletter"]);
  assertEquals(calls[0].url, "https://api2.ecomailapp.cz/lists/7/subscriber/a%40b.cz");
  assertEquals(calls[0].init?.method, "GET");
});

Deno.test("getSubscriber — 404 → null", async () => {
  const { fn } = makeFakeFetch([{ status: 404, body: { errors: ["not found"] } }]);
  const client = new EcomailClient(CFG, fn);
  assertEquals(await client.getSubscriber(7, "x@y.cz"), null);
});

Deno.test("getSubscriber — 200 s errors → null", async () => {
  const { fn } = makeFakeFetch([{ status: 200, body: { errors: ["Subscriber not found in the list"] } }]);
  const client = new EcomailClient(CFG, fn);
  assertEquals(await client.getSubscriber(7, "x@y.cz"), null);
});

Deno.test("subscribe — 429 přečte Retry-After a zopakuje jednou", async () => {
  const { fn, calls } = makeFakeFetch([
    { status: 429, body: { message: "too many" }, headers: { "Retry-After": "0" } },
    { status: 200, body: { id: 1 } },
  ]);
  const client = new EcomailClient(CFG, fn, { maxRetries: 2, baseDelayMs: 1 });
  const res = await client.subscribe(7, { email: "a@b.cz" });
  assertEquals(res.id, 1);
  assertEquals(calls.length, 2);
});

Deno.test("subscribe — non-2xx (422) vyhodí EcomailError", async () => {
  const { fn } = makeFakeFetch([{ status: 422, body: { errors: { email: ["Invalid"] } } }]);
  const client = new EcomailClient(CFG, fn);
  await assertRejects(() => client.subscribe(7, { email: "bad" }), EcomailError, "Ecomail 422");
});

Deno.test("unsubscribe — DELETE /lists/{id}/unsubscribe s tělem {email}", async () => {
  const { fn, calls } = makeFakeFetch([{ status: 200, body: { id: 4, status: 2 } }]);
  const client = new EcomailClient(CFG, fn);
  await client.unsubscribe(7, "a@b.cz");
  assertEquals(calls[0].url, "https://api2.ecomailapp.cz/lists/7/unsubscribe");
  assertEquals(calls[0].init?.method, "DELETE");
  assertEquals(JSON.parse(calls[0].init!.body as string).email, "a@b.cz");
});
