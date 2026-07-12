// ================================================
// Edge Function: get-review-request
// ================================================
// Public endpoint (gated by the review token itself). Returns the order
// context for the review form: customer name prefill + purchased products
// with an already_reviewed flag. No Turnstile — the UUID v4 token is the gate.
// ================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Database } from "../_shared/database.types.ts";
import { serveEdge } from "../_shared/serveEdge.ts";
import { jsonResponse } from "../_shared/http.ts";
import { logError } from "../_shared/log.ts";
import { enforceRateLimit, clientIp } from "../_shared/rateLimit.ts";
import { validateReviewToken } from "../_shared/reviewToken.ts";

const FAILURE_STATUS: Record<string, number> = {
  invalid_token: 400,
  not_found: 404,
  expired: 410,
  order_not_completed: 410,
};

serveEdge({ auth: "publishable", fnName: "get-review-request" }, async (req, ctx) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, {});
  }

  let body: { token?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, {});
  }

  const supabase: SupabaseClient<Database> = ctx.supabaseAdmin;

  const allowed = await enforceRateLimit(supabase, {
    bucket: `get-review-request:${clientIp(req)}`,
    limit: 30,
    windowSeconds: 3600,
  });
  if (!allowed) return jsonResponse({ error: "rate_limited" }, 429, {});

  let tokenResult;
  try {
    tokenResult = await validateReviewToken(supabase, body.token);
  } catch (err) {
    logError("get_review_request_lookup_failed", { error: String(err) });
    return jsonResponse({ error: "db_error" }, 500, {});
  }
  if (!tokenResult.ok) {
    return jsonResponse({ error: tokenResult.reason }, FAILURE_STATUS[tokenResult.reason], {});
  }

  const [itemsResult, reviewsResult] = await Promise.all([
    supabase
      .from("order_items")
      .select("product_id, products ( title, image_url )")
      .eq("order_id", tokenResult.orderId),
    supabase
      .from("reviews")
      .select("product_id")
      .eq("order_id", tokenResult.orderId)
      // A rejected review must not permanently mark the slot as reviewed — the
      // customer can submit a fresh one (matches the partial unique index in the DB).
      .neq("status", "rejected"),
  ]);

  if (itemsResult.error || reviewsResult.error) {
    logError("get_review_request_context_failed", {
      items_error: itemsResult.error?.message,
      reviews_error: reviewsResult.error?.message,
    });
    return jsonResponse({ error: "db_error" }, 500, {});
  }

  const reviewedProductIds = new Set(reviewsResult.data.map((r) => r.product_id));
  const products = itemsResult.data.map((item) => ({
    product_id: item.product_id,
    title: item.products?.title ?? "Produkt",
    image_url: item.products?.image_url ?? null,
    already_reviewed: reviewedProductIds.has(item.product_id),
  }));

  return jsonResponse({ customer_name: tokenResult.customerName, products }, 200, {});
});
