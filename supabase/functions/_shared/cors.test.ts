import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getCorsHeaders, ALLOWED_ORIGINS } from "./cors.ts";

function reqWithOrigin(origin?: string): Request {
  return new Request("https://x", { headers: origin ? { Origin: origin } : {} });
}

Deno.test("getCorsHeaders: povolený origin se odrazí + Vary", () => {
  const h = getCorsHeaders(reqWithOrigin("https://www.cestybezmapy.cz"));
  assertEquals(h["Access-Control-Allow-Origin"], "https://www.cestybezmapy.cz");
  assertEquals(h["Vary"], "Origin");
  assertEquals(h["Access-Control-Allow-Methods"], "POST, OPTIONS");
});

Deno.test("getCorsHeaders: nepovolený origin → fallback ALLOWED_ORIGINS[0]", () => {
  const h = getCorsHeaders(reqWithOrigin("https://evil.example"));
  assertEquals(h["Access-Control-Allow-Origin"], ALLOWED_ORIGINS[0]);
});

Deno.test("getCorsHeaders: methods override", () => {
  const h = getCorsHeaders(reqWithOrigin("https://www.cestybezmapy.cz"), { methods: "GET, OPTIONS" });
  assertEquals(h["Access-Control-Allow-Methods"], "GET, OPTIONS");
});

Deno.test("getCorsHeaders: publicAccess → wildcard, bez Vary", () => {
  const h = getCorsHeaders(reqWithOrigin("https://anything"), { publicAccess: true });
  assertEquals(h["Access-Control-Allow-Origin"], "*");
  assertEquals(h["Vary"], undefined);
});
