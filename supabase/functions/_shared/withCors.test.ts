import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { withCors } from "./withCors.ts";
import { ALLOWED_ORIGINS } from "./cors.ts";

const ok = () => new Response(JSON.stringify({ ok: true }), { status: 200 });

Deno.test("OPTIONS short-circuits with 204 + reflected origin", async () => {
  const wrapped = withCors(ok);
  const res = await wrapped(new Request("https://x/fn", { method: "OPTIONS", headers: { Origin: ALLOWED_ORIGINS[0] } }));
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), ALLOWED_ORIGINS[0]);
  assertEquals(res.headers.get("Vary"), "Origin");
});

Deno.test("appends CORS to normal response, reflects allowed origin", async () => {
  const wrapped = withCors(ok);
  const res = await wrapped(new Request("https://x/fn", { method: "POST", headers: { Origin: ALLOWED_ORIGINS[1] } }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), ALLOWED_ORIGINS[1]);
  assertEquals(res.headers.get("Vary"), "Origin");
});

Deno.test("unknown origin falls back to ALLOWED_ORIGINS[0]", async () => {
  const wrapped = withCors(ok);
  const res = await wrapped(new Request("https://x/fn", { method: "POST", headers: { Origin: "https://evil.example" } }));
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), ALLOWED_ORIGINS[0]);
});

Deno.test("appends CORS to a returned error response (401)", async () => {
  const wrapped = withCors(() => new Response("err", { status: 401 }));
  const res = await wrapped(new Request("https://x/fn", { method: "POST", headers: { Origin: ALLOWED_ORIGINS[0] } }));
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), ALLOWED_ORIGINS[0]);
});

Deno.test("catches a thrown exception → 500 with CORS (throw must not escape uncaught)", async () => {
  const wrapped = withCors(() => { throw new Error("boom"); });
  const res = await wrapped(new Request("https://x/fn", { method: "POST", headers: { Origin: ALLOWED_ORIGINS[0] } }));
  assertEquals(res.status, 500);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), ALLOWED_ORIGINS[0]);
});
