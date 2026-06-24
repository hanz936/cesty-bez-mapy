import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { requireAdmin } from "./requireAdmin.ts";

const cors = { "Access-Control-Allow-Origin": "*" };

// deno-lint-ignore no-explicit-any
function stubFactory(getUserResult: any, isAdminResult: any): any {
  return () => ({
    auth: { getUser: () => Promise.resolve(getUserResult) },
    rpc: () => Promise.resolve(isAdminResult),
  });
}

function req(auth?: string): Request {
  return new Request("https://x", { headers: auth ? { Authorization: auth } : {} });
}

Deno.test("requireAdmin: chybí Authorization → 401", async () => {
  const r = await requireAdmin(req(), cors, {}, stubFactory({ data: { user: null } }, { data: false }));
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.response.status, 401);
});

Deno.test("requireAdmin: neplatný user → 401", async () => {
  const r = await requireAdmin(req("Bearer x"), cors, {}, stubFactory({ data: { user: null } }, { data: true }));
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.response.status, 401);
});

Deno.test("requireAdmin: user ale ne admin → 403", async () => {
  const r = await requireAdmin(req("Bearer x"), cors, {}, stubFactory({ data: { user: { id: "u1" } } }, { data: false }));
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.response.status, 403);
});

Deno.test("requireAdmin: admin → ok", async () => {
  const r = await requireAdmin(req("Bearer x"), cors, {}, stubFactory({ data: { user: { id: "u1" } } }, { data: true }));
  assertEquals(r.ok, true);
});

Deno.test("requireAdmin: service-role bypass", async () => {
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "svc-key");
  const r = await requireAdmin(req("Bearer svc-key"), cors, { allowServiceRole: true }, stubFactory({ data: { user: null } }, { data: false }));
  assertEquals(r.ok, true);
  if (r.ok) assertEquals(r.user, null);
});
