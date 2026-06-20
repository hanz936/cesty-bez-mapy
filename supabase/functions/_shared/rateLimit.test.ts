import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { clientIp, enforceRateLimit } from "./rateLimit.ts";

// deno-lint-ignore no-explicit-any
function mockClient(result: { data: unknown; error: unknown }): any {
  return { rpc: () => Promise.resolve(result) };
}

Deno.test("enforceRateLimit: povolí, když RPC vrátí true", async () => {
  const allowed = await enforceRateLimit(mockClient({ data: true, error: null }), {
    bucket: "checkout:1.1.1.1",
    limit: 10,
    windowSeconds: 60,
  });
  assertEquals(allowed, true);
});

Deno.test("enforceRateLimit: zablokuje, když RPC vrátí false", async () => {
  const allowed = await enforceRateLimit(mockClient({ data: false, error: null }), {
    bucket: "checkout:1.1.1.1",
    limit: 10,
    windowSeconds: 60,
  });
  assertEquals(allowed, false);
});

Deno.test("enforceRateLimit: fail-open při chybě RPC", async () => {
  const allowed = await enforceRateLimit(
    mockClient({ data: null, error: { message: "boom" } }),
    { bucket: "checkout:1.1.1.1", limit: 10, windowSeconds: 60 },
  );
  assertEquals(allowed, true);
});

Deno.test("clientIp: preferuje cf-connecting-ip", () => {
  const req = new Request("https://x", {
    headers: { "cf-connecting-ip": "9.9.9.9", "x-forwarded-for": "8.8.8.8" },
  });
  assertEquals(clientIp(req), "9.9.9.9");
});

Deno.test("clientIp: fallback na x-forwarded-for první hop", () => {
  const req = new Request("https://x", {
    headers: { "x-forwarded-for": "8.8.8.8, 7.7.7.7" },
  });
  assertEquals(clientIp(req), "8.8.8.8");
});
