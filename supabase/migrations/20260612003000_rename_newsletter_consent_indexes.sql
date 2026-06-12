-- Rename newsletter_consent_log indexes to the idx_<full_table_name>_* convention
-- (CONVENTIONS.md; enforced by pgTAP guard 00_naming_conventions test #2).
-- The short-prefix names exist both locally (baseline) and on live (20260610230500),
-- so a plain rename converges both environments.

alter index if exists public.idx_newsletter_consent_active
  rename to idx_newsletter_consent_log_active;

alter index if exists public.idx_newsletter_consent_created_at
  rename to idx_newsletter_consent_log_created_at;

alter index if exists public.idx_newsletter_consent_email
  rename to idx_newsletter_consent_log_email;
