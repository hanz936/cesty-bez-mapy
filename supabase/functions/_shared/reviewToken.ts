// ================================================
// Shared helper: review token validation
// ================================================
// Used by get-review-request + submit-review. A token is valid iff the
// review_requests row exists, has not expired, and the order is still
// 'completed' (refund invalidates the token without any extra bookkeeping).
// ================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Database } from "./database.types.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ReviewTokenFailureReason =
  | "invalid_token"
  | "not_found"
  | "expired"
  | "order_not_completed";

export type ReviewTokenResult =
  | { ok: true; requestId: string; orderId: string; customerName: string | null }
  | { ok: false; reason: ReviewTokenFailureReason };

export async function validateReviewToken(
  supabase: SupabaseClient<Database>,
  token: unknown,
): Promise<ReviewTokenResult> {
  if (typeof token !== "string" || !UUID_RE.test(token)) {
    return { ok: false, reason: "invalid_token" };
  }

  const { data, error } = await supabase
    .from("review_requests")
    .select("id, order_id, expires_at, orders ( status, customer_name )")
    .eq("token", token)
    .maybeSingle();

  if (error) throw new Error(`review_requests lookup failed: ${error.message}`);
  if (!data) return { ok: false, reason: "not_found" };
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  if (data.orders?.status !== "completed") {
    return { ok: false, reason: "order_not_completed" };
  }
  return {
    ok: true,
    requestId: data.id,
    orderId: data.order_id,
    customerName: data.orders?.customer_name ?? null,
  };
}
