-- 047_security_download_tokens_and_function_grants.sql
-- B1 security remediation — audit 2026-06-03
-- (docs/superpowers/audits/2026-06-03-supabase-audit.md)

-- F1 [CRITICAL]: remove broad USING(true) SELECT policies that exposed
-- download_tokens (bearer capability for paid-PDF signed URLs) to the public
-- anon API key and to any authenticated (incl. anonymous-sign-in) user.
-- The legitimate flow (get-download-url edge fn) uses service_role and bypasses
-- RLS, so dropping these policies does not affect it. Admin policies remain.
drop policy if exists "download_tokens_public_select" on public.download_tokens;
drop policy if exists "download_tokens_authenticated_select" on public.download_tokens;

-- F4 [HIGH]: revoke EXECUTE on SECURITY DEFINER RPC functions from anon/authenticated
-- (callers are service-role edge functions; service_role retains EXECUTE).
revoke execute on function public.increment_download_count(uuid) from anon, authenticated;
revoke execute on function public.increment_email_resend_count(text, uuid, text) from anon, authenticated;

-- F8 [LOW]: revoke EXECUTE on trigger functions from PUBLIC (least-privilege).
-- These functions hold EXECUTE via the default PUBLIC grant (Postgres grants
-- EXECUTE to PUBLIC on new functions), so revoking only anon/authenticated is a
-- no-op — we must revoke from PUBLIC. Triggers still fire regardless of EXECUTE
-- (the trigger mechanism doesn't check the invoker's privilege), and these are
-- never called directly via PostgREST RPC (they return `trigger`).
revoke execute on function public.notify_vercel_blog_publish() from public, anon, authenticated;
revoke execute on function public.update_all_products_in_order() from public, anon, authenticated;
revoke execute on function public.update_product_total_sales() from public, anon, authenticated;
