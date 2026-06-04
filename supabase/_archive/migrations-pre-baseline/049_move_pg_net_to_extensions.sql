-- 049_move_pg_net_to_extensions.sql
-- B4 (F9) — relocate pg_net out of `public` into `extensions` (advisor 0014).
-- audit 2026-06-03 (docs/superpowers/audits/2026-06-03-supabase-audit.md)
--
-- pg_net does NOT support `ALTER EXTENSION ... SET SCHEMA` (verified locally:
-- errors `extension "pg_net" does not support SET SCHEMA`), so the documented
-- remediation is drop + recreate. pg_net's API objects live in the `net` schema
-- regardless of the extension's registered namespace; only `pg_extension.extnamespace`
-- moves (public -> extensions), which is what lint 0014 checks.
--
-- Safety (verified locally via a rollback transaction AND full `db reset`):
--   * extnamespace ends as `extensions`
--   * `net.http_post` is recreated and present
--   * the sole app consumer `public.notify_vercel_blog_publish` stays valid — its
--     plpgsql body resolves `net.http_post` by name at runtime (late binding).
-- On Supabase, the managed event trigger `extensions.grant_pg_net_access` re-grants
-- pg_net access automatically after the extension is (re)created.
-- No Database Webhooks / pg_cron depend on net on this project (verified on remote).
drop extension if exists pg_net;
create extension pg_net with schema extensions;
