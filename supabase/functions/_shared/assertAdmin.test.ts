import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assertAdmin } from "./assertAdmin.ts";

const cors = { "x": "y" };
const ctxWith = (isAdmin: unknown) => ({ supabase: { rpc: (_: string) => Promise.resolve({ data: isAdmin }) } });

Deno.test("ok when is_admin true", async () => {
  const r = await assertAdmin(ctxWith(true), cors);
  assertEquals(r.ok, true);
});

Deno.test("403 when is_admin false", async () => {
  const r = await assertAdmin(ctxWith(false), cors);
  assertEquals(r.ok, false);
  if (!r.ok) assertEquals(r.response.status, 403);
});
