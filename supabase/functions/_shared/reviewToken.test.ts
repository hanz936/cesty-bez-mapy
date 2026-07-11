import { validateReviewToken } from "./reviewToken.ts";

function stubClient(row: unknown, error: { message: string } | null = null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: row, error }),
        }),
      }),
    }),
    // deno-lint-ignore no-explicit-any
  } as any;
}

const FUTURE = new Date(Date.now() + 86400000).toISOString();
const PAST = new Date(Date.now() - 86400000).toISOString();
const TOKEN = "123e4567-e89b-42d3-a456-426614174000";

Deno.test("rejects non-uuid token without DB call", async () => {
  const result = await validateReviewToken(stubClient(null), "not-a-uuid");
  if (result.ok || result.reason !== "invalid_token") throw new Error(JSON.stringify(result));
});

Deno.test("not_found when no row", async () => {
  const result = await validateReviewToken(stubClient(null), TOKEN);
  if (result.ok || result.reason !== "not_found") throw new Error(JSON.stringify(result));
});

Deno.test("expired token", async () => {
  const row = { id: "r1", order_id: "o1", expires_at: PAST, orders: { status: "completed", customer_name: "Jana" } };
  const result = await validateReviewToken(stubClient(row), TOKEN);
  if (result.ok || result.reason !== "expired") throw new Error(JSON.stringify(result));
});

Deno.test("refunded order kills token", async () => {
  const row = { id: "r1", order_id: "o1", expires_at: FUTURE, orders: { status: "refunded", customer_name: "Jana" } };
  const result = await validateReviewToken(stubClient(row), TOKEN);
  if (result.ok || result.reason !== "order_not_completed") throw new Error(JSON.stringify(result));
});

Deno.test("valid token returns context", async () => {
  const row = { id: "r1", order_id: "o1", expires_at: FUTURE, orders: { status: "completed", customer_name: "Jana" } };
  const result = await validateReviewToken(stubClient(row), TOKEN);
  if (!result.ok || result.orderId !== "o1" || result.customerName !== "Jana") throw new Error(JSON.stringify(result));
});
