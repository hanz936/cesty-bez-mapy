-- Reviews system: verified-purchase product reviews.
-- Spec: ADM repo docs/superpowers/specs/2026-07-11-reviews-system-design.md
-- reviews: one review per (order, product), pre-moderated (pending -> approved/rejected).
-- review_requests: one token per order, emailed +21 days after payment, valid 12 months.
-- Trigger keeps products.average_rating / review_count in sync (approved only) —
-- fulfils the promise in the baseline column comments.

CREATE TABLE "public"."reviews" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "product_id" uuid NOT NULL,
    "order_id" uuid NOT NULL,
    "reviewer_name" text NOT NULL,
    "rating" smallint NOT NULL,
    "review_text" text NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "admin_notes" text,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    "approved_at" timestamptz,
    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE,
    CONSTRAINT "reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE,
    CONSTRAINT "reviews_order_id_product_id_key" UNIQUE ("order_id", "product_id"),
    CONSTRAINT "reviews_reviewer_name_check" CHECK (char_length("reviewer_name") BETWEEN 1 AND 100),
    CONSTRAINT "reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
    CONSTRAINT "reviews_review_text_check" CHECK (char_length("review_text") BETWEEN 10 AND 2000),
    CONSTRAINT "reviews_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected'))
);

ALTER TABLE "public"."reviews" OWNER TO "postgres";

COMMENT ON TABLE "public"."reviews" IS 'Verified-purchase product reviews. One per (order, product). Pre-moderated: pending -> approved/rejected; only approved rows are public and feed products.average_rating.';
COMMENT ON COLUMN "public"."reviews"."status" IS 'Allowed values: pending, approved, rejected. Moderation may reject only spam/vulgarity/PII, never by rating value (par. 5 ZOS).';
COMMENT ON COLUMN "public"."reviews"."reviewer_name" IS 'Customer-chosen display name, published with the review.';
COMMENT ON COLUMN "public"."reviews"."review_text" IS 'Plain text 10-2000 chars. Admin must never edit content (legal requirement) - no UPDATE grant on this column.';

CREATE INDEX "idx_reviews_product_id_status" ON "public"."reviews" USING btree ("product_id", "status");
CREATE INDEX "idx_reviews_status_pending" ON "public"."reviews" USING btree ("status") WHERE ("status" = 'pending');
CREATE INDEX "idx_reviews_created_at" ON "public"."reviews" USING btree ("created_at" DESC);

CREATE TABLE "public"."review_requests" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "order_id" uuid NOT NULL,
    "token" uuid DEFAULT gen_random_uuid() NOT NULL,
    "expires_at" timestamptz NOT NULL,
    "invitation_email_id" text,
    "created_at" timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT "review_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "review_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE,
    CONSTRAINT "review_requests_order_id_key" UNIQUE ("order_id"),
    CONSTRAINT "review_requests_token_key" UNIQUE ("token")
);

ALTER TABLE "public"."review_requests" OWNER TO "postgres";

COMMENT ON TABLE "public"."review_requests" IS 'One review-invitation token per paid order (UUID v4, ~122 bits). Emailed +21 days after payment via Resend scheduled_at; valid 12 months. Token validation additionally requires orders.status = completed (refund kills the token).';
COMMENT ON COLUMN "public"."review_requests"."invitation_email_id" IS 'Resend email id of the scheduled invitation - used for best-effort cancel on refund.';

-- Aggregate trigger: recompute products.average_rating + review_count from approved reviews.
CREATE OR REPLACE FUNCTION "public"."refresh_product_rating"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_product_id uuid;
BEGIN
  target_product_id := COALESCE(NEW.product_id, OLD.product_id);
  UPDATE public.products p SET
    average_rating = COALESCE(
      (SELECT round(avg(r.rating)::numeric, 2)
         FROM public.reviews r
        WHERE r.product_id = target_product_id AND r.status = 'approved'),
      0.00),
    review_count = (SELECT count(*)
                      FROM public.reviews r
                     WHERE r.product_id = target_product_id AND r.status = 'approved')
  WHERE p.id = target_product_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER "trg_reviews_refresh_product_rating"
AFTER INSERT OR UPDATE OF "status" OR DELETE ON "public"."reviews"
FOR EACH ROW EXECUTE FUNCTION "public"."refresh_product_rating"();

-- RLS + grants.
-- Admin has NO dedicated Postgres role: admin = role authenticated + is_admin() JWT claim
-- (aal2-enforced). FE checkout uses signInAnonymously => regular visitors can also be
-- role authenticated. Grants are per-role; row visibility is cut by RLS policies.
ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."review_requests" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."reviews" FROM "anon", "authenticated";
GRANT SELECT ("id", "product_id", "reviewer_name", "rating", "review_text", "created_at")
  ON "public"."reviews" TO "anon";
GRANT SELECT ON TABLE "public"."reviews" TO "authenticated";
GRANT UPDATE ("status", "admin_notes", "approved_at") ON "public"."reviews" TO "authenticated";
GRANT DELETE ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";

CREATE POLICY "reviews_public_select" ON "public"."reviews"
  FOR SELECT TO "anon" USING ("status" = 'approved');
CREATE POLICY "reviews_authenticated_select" ON "public"."reviews"
  FOR SELECT TO "authenticated" USING ((SELECT "public"."is_admin"()) OR "status" = 'approved');
CREATE POLICY "reviews_admin_update" ON "public"."reviews"
  FOR UPDATE TO "authenticated" USING ((SELECT "public"."is_admin"())) WITH CHECK ((SELECT "public"."is_admin"()));
CREATE POLICY "reviews_admin_delete" ON "public"."reviews"
  FOR DELETE TO "authenticated" USING ((SELECT "public"."is_admin"()));

REVOKE ALL ON TABLE "public"."review_requests" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."review_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."review_requests" TO "service_role";

CREATE POLICY "review_requests_admin_select" ON "public"."review_requests"
  FOR SELECT TO "authenticated" USING ((SELECT "public"."is_admin"()));
