import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { jsonResponse } from "./http.ts";

Deno.test("jsonResponse: status, JSON tělo, cors + content-type", async () => {
  const res = jsonResponse({ ok: true }, 201, { "Access-Control-Allow-Origin": "*" });
  assertEquals(res.status, 201);
  assertEquals(res.headers.get("Content-Type"), "application/json");
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(await res.json(), { ok: true });
});

Deno.test("jsonResponse: extraHeaders (Cache-Control)", () => {
  const res = jsonResponse({}, 200, {}, { "Cache-Control": "no-store" });
  assertEquals(res.headers.get("Cache-Control"), "no-store");
});
