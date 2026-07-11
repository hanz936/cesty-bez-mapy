// Pure input validation for submit-review (unit-testable without Supabase).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SubmitReviewInput {
  token: string;
  product_id: string;
  rating: number;
  review_text: string;
  reviewer_name: string;
}

export type ParseResult =
  | { ok: true; value: SubmitReviewInput }
  | { ok: false; error: string };

export function parseSubmitReviewBody(body: unknown): ParseResult {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return { ok: false, error: "invalid_body" };

  const { token, product_id, rating, review_text, reviewer_name } = b;

  if (typeof token !== "string" || !UUID_RE.test(token)) {
    return { ok: false, error: "invalid_token" };
  }
  if (typeof product_id !== "string" || !UUID_RE.test(product_id)) {
    return { ok: false, error: "invalid_product_id" };
  }
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "invalid_rating" };
  }
  if (typeof review_text !== "string") return { ok: false, error: "invalid_review_text" };
  const text = review_text.trim();
  if (text.length < 10 || text.length > 2000) {
    return { ok: false, error: "invalid_review_text" };
  }
  if (typeof reviewer_name !== "string") return { ok: false, error: "invalid_reviewer_name" };
  const name = reviewer_name.trim();
  if (name.length < 1 || name.length > 100) {
    return { ok: false, error: "invalid_reviewer_name" };
  }

  return { ok: true, value: { token, product_id, rating, review_text: text, reviewer_name: name } };
}
