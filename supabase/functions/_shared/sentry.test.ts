import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { withSentry } from "./sentry.ts";

Deno.test("withSentry passes through a normal response when Sentry disabled", async () => {
  Deno.env.delete("SENTRY_DSN");
  const handler = withSentry(
    () => new Response("ok", { status: 200 }),
    "test-fn",
  );
  const res = await handler(new Request("http://localhost/"));
  assertEquals(res.status, 200);
  assertEquals(await res.text(), "ok");
});

Deno.test("withSentry re-throws handler errors when Sentry disabled", async () => {
  Deno.env.delete("SENTRY_DSN");
  const handler = withSentry(() => {
    throw new Error("boom");
  }, "test-fn");
  await assertRejects(() => handler(new Request("http://localhost/")), Error, "boom");
});
