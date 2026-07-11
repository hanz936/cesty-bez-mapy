import { parseSubmitReviewBody } from "./lib.ts";

const VALID = {
  token: "123e4567-e89b-42d3-a456-426614174000",
  product_id: "223e4567-e89b-42d3-a456-426614174000",
  rating: 5,
  review_text: "Naprosto skvely pruvodce, doporucuji vsem.",
  reviewer_name: "Jana N.",
};

Deno.test("accepts valid body and trims strings", () => {
  const result = parseSubmitReviewBody({ ...VALID, reviewer_name: "  Jana N.  " });
  if (!result.ok) throw new Error(result.error);
  if (result.value.reviewer_name !== "Jana N.") throw new Error("not trimmed");
});

Deno.test("rejects non-integer and out-of-range rating", () => {
  for (const rating of [0, 6, 4.5, "5", null, undefined]) {
    const result = parseSubmitReviewBody({ ...VALID, rating });
    if (result.ok) throw new Error(`rating ${String(rating)} accepted`);
  }
});

Deno.test("rejects review_text shorter than 10 or longer than 2000 chars", () => {
  const short = parseSubmitReviewBody({ ...VALID, review_text: "kratke" });
  const long = parseSubmitReviewBody({ ...VALID, review_text: "a".repeat(2001) });
  if (short.ok || long.ok) throw new Error("length limits not enforced");
});

Deno.test("rejects empty or too long reviewer_name", () => {
  const empty = parseSubmitReviewBody({ ...VALID, reviewer_name: "   " });
  const long = parseSubmitReviewBody({ ...VALID, reviewer_name: "a".repeat(101) });
  if (empty.ok || long.ok) throw new Error("name limits not enforced");
});

Deno.test("rejects invalid product_id uuid", () => {
  const result = parseSubmitReviewBody({ ...VALID, product_id: "nope" });
  if (result.ok) throw new Error("invalid uuid accepted");
});
