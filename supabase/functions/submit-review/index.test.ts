import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleSubmitReview } from "./index.ts";
import type { SubmitReviewCtx } from "./index.ts";

const TOKEN = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";
const ORDER_ID = "33333333-3333-4333-8333-333333333333";

const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

interface ReviewRequestRow {
  id: string;
  order_id: string;
  expires_at: string;
  orders: { status: string; customer_name: string | null } | null;
}

// Fake řízený přes datový povrch, který handler (a _shared helpery enforceRateLimit
// + validateReviewToken) reálně používá — Deno nemá vi.mock, viz resend-webhook precedent.
class FakeSupabase {
  // vstupní stav — testy si ho před voláním handleru přenastaví
  rateLimitAllowed = true;
  reviewRequest: ReviewRequestRow | null = {
    id: "req-1",
    order_id: ORDER_ID,
    expires_at: FUTURE,
    orders: { status: "completed", customer_name: "Jana" },
  };
  reviewRequestError: { message: string } | null = null;
  orderItem: { product_id: string } | null = { product_id: PRODUCT_ID };
  orderItemError: { message: string } | null = null;
  insertError: { code?: string; message: string } | null = null;
  // zachycené INSERTy do reviews
  // deno-lint-ignore no-explicit-any
  inserted: any[] = [];

  // enforceRateLimit → rpc("check_rate_limit", …); vrací data=true (povoleno) / false (limit)
  rpc(_fn: string, _args: unknown) {
    return Promise.resolve({ data: this.rateLimitAllowed, error: null });
  }

  from(table: string) {
    if (table === "review_requests") {
      // validateReviewToken: select(...).eq("token", …).maybeSingle(); error → helper throwne
      const result = this.reviewRequestError
        ? { data: null, error: this.reviewRequestError }
        : { data: this.reviewRequest, error: null };
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(result) }) }) };
    }
    if (table === "order_items") {
      // handler: select("product_id").eq("order_id", …).eq("product_id", …).maybeSingle()
      const result = this.orderItemError
        ? { data: null, error: this.orderItemError }
        : { data: this.orderItem, error: null };
      const second = { maybeSingle: () => Promise.resolve(result) };
      const first = { eq: () => second };
      return { select: () => ({ eq: () => first }) };
    }
    if (table === "reviews") {
      return {
        // deno-lint-ignore no-explicit-any
        insert: (row: any) => {
          if (this.insertError) return Promise.resolve({ error: this.insertError });
          this.inserted.push(row);
          return Promise.resolve({ error: null });
        },
      };
    }
    throw new Error(`unexpected table: ${table}`);
  }
}

function ctxFor(supabase: FakeSupabase): SubmitReviewCtx {
  return { supabaseAdmin: supabase as unknown as SubmitReviewCtx["supabaseAdmin"] };
}

function validPayload() {
  return {
    token: TOKEN,
    product_id: PRODUCT_ID,
    rating: 5,
    review_text: "Deset znaku minimalne, super pruvodce.",
    reviewer_name: "Jana N.",
  };
}

function postReq(body: unknown): Request {
  return new Request("http://localhost/submit-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

Deno.test("non-POST request returns 405 method_not_allowed", async () => {
  const supabase = new FakeSupabase();
  const res = await handleSubmitReview(
    new Request("http://localhost/submit-review", { method: "GET" }),
    ctxFor(supabase),
  );
  assertEquals(res.status, 405);
  assertEquals((await res.json()).error, "method_not_allowed");
  assertEquals(supabase.inserted.length, 0);
});

Deno.test("malformed JSON body returns 400 invalid_json", async () => {
  const supabase = new FakeSupabase();
  const res = await handleSubmitReview(postReq("not-json{"), ctxFor(supabase));
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, "invalid_json");
});

Deno.test("parse failure (rating out of range) returns 400 with the parse error code", async () => {
  const supabase = new FakeSupabase();
  const res = await handleSubmitReview(postReq({ ...validPayload(), rating: 0 }), ctxFor(supabase));
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, "invalid_rating");
  assertEquals(supabase.inserted.length, 0);
});

Deno.test("rate-limited request returns 429 rate_limited", async () => {
  const supabase = new FakeSupabase();
  supabase.rateLimitAllowed = false;
  const res = await handleSubmitReview(postReq(validPayload()), ctxFor(supabase));
  assertEquals(res.status, 429);
  assertEquals((await res.json()).error, "rate_limited");
  assertEquals(supabase.inserted.length, 0);
});

Deno.test("expired token maps through FAILURE_STATUS to 410 expired", async () => {
  const supabase = new FakeSupabase();
  supabase.reviewRequest!.expires_at = PAST;
  const res = await handleSubmitReview(postReq(validPayload()), ctxFor(supabase));
  assertEquals(res.status, 410);
  assertEquals((await res.json()).error, "expired");
});

Deno.test("unknown token returns 404 not_found", async () => {
  const supabase = new FakeSupabase();
  supabase.reviewRequest = null;
  const res = await handleSubmitReview(postReq(validPayload()), ctxFor(supabase));
  assertEquals(res.status, 404);
  assertEquals((await res.json()).error, "not_found");
});

Deno.test("refunded order (not completed) returns 410 order_not_completed", async () => {
  const supabase = new FakeSupabase();
  supabase.reviewRequest!.orders = { status: "refunded", customer_name: "Jana" };
  const res = await handleSubmitReview(postReq(validPayload()), ctxFor(supabase));
  assertEquals(res.status, 410);
  assertEquals((await res.json()).error, "order_not_completed");
});

Deno.test("token lookup DB error returns 500 db_error", async () => {
  const supabase = new FakeSupabase();
  supabase.reviewRequestError = { message: "boom" };
  const res = await handleSubmitReview(postReq(validPayload()), ctxFor(supabase));
  assertEquals(res.status, 500);
  assertEquals((await res.json()).error, "db_error");
});

Deno.test("product not part of the order returns 400 product_not_in_order", async () => {
  const supabase = new FakeSupabase();
  supabase.orderItem = null;
  const res = await handleSubmitReview(postReq(validPayload()), ctxFor(supabase));
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, "product_not_in_order");
  assertEquals(supabase.inserted.length, 0);
});

Deno.test("order_items DB error returns 500 db_error", async () => {
  const supabase = new FakeSupabase();
  supabase.orderItemError = { message: "boom" };
  const res = await handleSubmitReview(postReq(validPayload()), ctxFor(supabase));
  assertEquals(res.status, 500);
  assertEquals((await res.json()).error, "db_error");
});

Deno.test("happy path inserts the pending review and returns 200 success", async () => {
  const supabase = new FakeSupabase();
  const res = await handleSubmitReview(postReq(validPayload()), ctxFor(supabase));
  assertEquals(res.status, 200);
  assertEquals((await res.json()).success, true);
  assertEquals(supabase.inserted.length, 1);
  assertEquals(supabase.inserted[0], {
    product_id: PRODUCT_ID,
    order_id: ORDER_ID,
    reviewer_name: "Jana N.",
    rating: 5,
    review_text: "Deset znaku minimalne, super pruvodce.",
  });
});

Deno.test("duplicate insert (23505) returns 409 already_reviewed", async () => {
  const supabase = new FakeSupabase();
  supabase.insertError = { code: "23505", message: "duplicate key" };
  const res = await handleSubmitReview(postReq(validPayload()), ctxFor(supabase));
  assertEquals(res.status, 409);
  assertEquals((await res.json()).error, "already_reviewed");
});

Deno.test("non-duplicate insert error returns 500 db_error", async () => {
  const supabase = new FakeSupabase();
  supabase.insertError = { message: "insert exploded" };
  const res = await handleSubmitReview(postReq(validPayload()), ctxFor(supabase));
  assertEquals(res.status, 500);
  assertEquals((await res.json()).error, "db_error");
});
