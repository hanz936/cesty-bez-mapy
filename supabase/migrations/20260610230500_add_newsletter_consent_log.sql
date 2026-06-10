-- Add newsletter_consent_log (GDPR consent audit log).
-- This table is defined in the consolidated baseline (00000000000000_baseline.sql) but was
-- never actually created on the live production DB (discovered during Ecomail go-live 2026-06-10).
-- The Ecomail integration (subscribe-newsletter + stripe-webhook order sync) writes consent
-- proof here, so the table must exist. Idempotent: a no-op where the baseline already created it.

CREATE TABLE IF NOT EXISTS "public"."newsletter_consent_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "consent_given" boolean NOT NULL,
    "source" "text" NOT NULL,
    "ip_address" "inet",
    "user_agent" "text",
    "privacy_policy_version" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "newsletter_consent_log_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."newsletter_consent_log" OWNER TO "postgres";

COMMENT ON TABLE "public"."newsletter_consent_log" IS 'GDPR audit log for newsletter opt-in/opt-out (proof of consent)';
COMMENT ON COLUMN "public"."newsletter_consent_log"."consent_given" IS 'true = opt-in, false = opt-out';
COMMENT ON COLUMN "public"."newsletter_consent_log"."source" IS 'Where consent was given: blog, checkout, footer, etc.';
COMMENT ON COLUMN "public"."newsletter_consent_log"."ip_address" IS 'IP address at time of consent (GDPR requirement)';
COMMENT ON COLUMN "public"."newsletter_consent_log"."user_agent" IS 'Browser/device info (GDPR requirement)';
COMMENT ON COLUMN "public"."newsletter_consent_log"."privacy_policy_version" IS 'Version of privacy policy shown to user';

CREATE INDEX IF NOT EXISTS "idx_newsletter_consent_active" ON "public"."newsletter_consent_log" USING "btree" ("email", "created_at" DESC) WHERE ("consent_given" = true);
CREATE INDEX IF NOT EXISTS "idx_newsletter_consent_created_at" ON "public"."newsletter_consent_log" USING "btree" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_newsletter_consent_email" ON "public"."newsletter_consent_log" USING "btree" ("email");

ALTER TABLE "public"."newsletter_consent_log" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "newsletter_consent_admin_select" ON "public"."newsletter_consent_log";
CREATE POLICY "newsletter_consent_admin_select" ON "public"."newsletter_consent_log" FOR SELECT TO "authenticated" USING ((SELECT "public"."is_admin"() AS "is_admin"));

DROP POLICY IF EXISTS "newsletter_consent_public_insert" ON "public"."newsletter_consent_log";
CREATE POLICY "newsletter_consent_public_insert" ON "public"."newsletter_consent_log" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("email" IS NOT NULL) AND ("consent_given" IS NOT NULL) AND ("source" IS NOT NULL)));

GRANT ALL ON TABLE "public"."newsletter_consent_log" TO "anon";
GRANT ALL ON TABLE "public"."newsletter_consent_log" TO "authenticated";
GRANT ALL ON TABLE "public"."newsletter_consent_log" TO "service_role";
