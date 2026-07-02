import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { composeEdge } from "./serveEdge.ts";
import { ALLOWED_ORIGINS } from "./cors.ts";

// fake withSupabase: propustí handler s daným ctx, jinak vrátí 401 při chybějícím apikey
const fakeWithSupabase = (_opts: unknown, handler: (r: Request, c: unknown) => Promise<Response> | Response) =>
  (req: Request) => req.headers.get("apikey") ? handler(req, { authMode: "publishable", supabaseAdmin: {}, supabase: {} }) : new Response("unauth", { status: 401 });

Deno.test("composeEdge: OPTIONS gets 204+CORS without hitting withSupabase", async () => {
  const fetchFn = composeEdge({ auth: "publishable", fnName: "t" }, async () => new Response("ok"), fakeWithSupabase);
  const res = await fetchFn(new Request("https://x/t", { method: "OPTIONS", headers: { Origin: ALLOWED_ORIGINS[0] } }));
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), ALLOWED_ORIGINS[0]);
});

Deno.test("composeEdge: 401 from withSupabase still carries CORS", async () => {
  const fetchFn = composeEdge({ auth: "publishable", fnName: "t" }, async () => new Response("ok"), fakeWithSupabase);
  const res = await fetchFn(new Request("https://x/t", { method: "POST", headers: { Origin: ALLOWED_ORIGINS[0] } }));
  assertEquals(res.status, 401);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), ALLOWED_ORIGINS[0]);
});

Deno.test("composeEdge: authed request reaches handler with ctx", async () => {
  const fetchFn = composeEdge({ auth: "publishable", fnName: "t" }, async (_r, ctx) => Response.json({ mode: (ctx as { authMode: string }).authMode }), fakeWithSupabase);
  const res = await fetchFn(new Request("https://x/t", { method: "POST", headers: { apikey: "sb_publishable_x", Origin: ALLOWED_ORIGINS[0] } }));
  assertEquals((await res.json()).mode, "publishable");
});

Deno.test("composeEdge: handler throw → 500 with CORS (withCors outermost catches)", async () => {
  const fetchFn = composeEdge({ auth: "publishable", fnName: "t" }, () => { throw new Error("boom"); }, fakeWithSupabase);
  const res = await fetchFn(new Request("https://x/t", { method: "POST", headers: { apikey: "sb_publishable_x", Origin: ALLOWED_ORIGINS[0] } }));
  assertEquals(res.status, 500);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), ALLOWED_ORIGINS[0]);
});
