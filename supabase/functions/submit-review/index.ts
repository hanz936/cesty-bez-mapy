// ================================================
// Edge Function: submit-review
// ================================================
// Inserts a pending review for a purchased product. Gate = review token
// (UUID v4 emailed after payment). Validates: token (exists/not expired/
// order completed), product belongs to the order, one review per
// (order, product). Insert runs with service role; RLS blocks any direct
// client INSERT.
// ================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Database } from "../_shared/database.types.ts";
import { serveEdge } from "../_shared/serveEdge.ts";
import { jsonResponse } from "../_shared/http.ts";
import { logError, logInfo } from "../_shared/log.ts";
import { enforceRateLimit, clientIp } from "../_shared/rateLimit.ts";
import { validateReviewToken } from "../_shared/reviewToken.ts";
import { parseSubmitReviewBody } from "./lib.ts";

const FAILURE_STATUS: Record<string, number> = {
  invalid_token: 400,
  not_found: 404,
  expired: 410,
  order_not_completed: 410,
};

/** Kontext od serveEdge zúžený na to, co handler používá (serveEdge typuje ctx jako any). */
export interface SubmitReviewCtx {
  supabaseAdmin: SupabaseClient<Database>;
}

// Exportovaný handler (vzor resend-webhook): orchestrace je testovatelná přímo, bez HTTP kola.
export async function handleSubmitReview(req: Request, ctx: SubmitReviewCtx): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, {});
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, {});
  }

  const parsed = parseSubmitReviewBody(rawBody);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, 400, {});
  const input = parsed.value;

  const supabase: SupabaseClient<Database> = ctx.supabaseAdmin;

  const allowed = await enforceRateLimit(supabase, {
    bucket: `submit-review:${clientIp(req)}`,
    limit: 10,
    windowSeconds: 3600,
  });
  if (!allowed) return jsonResponse({ error: "rate_limited" }, 429, {});

  let tokenResult;
  try {
    tokenResult = await validateReviewToken(supabase, input.token);
  } catch (err) {
    logError("submit_review_lookup_failed", { error: String(err) });
    return jsonResponse({ error: "db_error" }, 500, {});
  }
  if (!tokenResult.ok) {
    return jsonResponse({ error: tokenResult.reason }, FAILURE_STATUS[tokenResult.reason], {});
  }

  // The product must be part of this order.
  const { data: orderItem, error: itemError } = await supabase
    .from("order_items")
    .select("product_id")
    .eq("order_id", tokenResult.orderId)
    .eq("product_id", input.product_id)
    .maybeSingle();
  if (itemError) {
    logError("submit_review_order_item_failed", { error: itemError.message });
    return jsonResponse({ error: "db_error" }, 500, {});
  }
  if (!orderItem) return jsonResponse({ error: "product_not_in_order" }, 400, {});

  const { error: insertError } = await supabase.from("reviews").insert({
    product_id: input.product_id,
    order_id: tokenResult.orderId,
    reviewer_name: input.reviewer_name,
    rating: input.rating,
    review_text: input.review_text,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return jsonResponse({ error: "already_reviewed" }, 409, {});
    }
    logError("submit_review_insert_failed", { error: insertError.message });
    return jsonResponse({ error: "db_error" }, 500, {});
  }

  logInfo("review_submitted", { order_id: tokenResult.orderId, product_id: input.product_id });
  return jsonResponse({ success: true }, 200, {});
}

serveEdge({ auth: "publishable", fnName: "submit-review" }, handleSubmitReview);
