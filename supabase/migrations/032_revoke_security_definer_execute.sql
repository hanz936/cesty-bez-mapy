-- ================================================
-- Migration 032: Revoke EXECUTE on SECURITY DEFINER functions
-- ================================================
-- Created: 2026-04-30
-- Description: Phase 5 of sales workflow audit — security cleanup.
--              SECURITY DEFINER funkce mají defaultně GRANT EXECUTE TO PUBLIC,
--              což u SECURITY DEFINER funkcí znamená privilege-escalation
--              surface. Tato migrace odebírá EXECUTE od PUBLIC, anon
--              a authenticated u 5 funkcí, které mají být volány buď
--              triggerem (4×) nebo pg_cronem (1×) — žádný uživatel je nemá
--              volat napřímo.
-- ================================================

-- ================================================
-- PART 1: Revoke EXECUTE on trigger + maintenance functions
-- ================================================
-- Trigger funkce (handle_new_permanent_user, handle_user_email_update,
-- link_requests_to_customer, link_orders_to_customer) jsou volány triggerem
-- na úrovni řádku — trigger systém nepotřebuje EXECUTE grant pro role.
-- cleanup_expired_tokens je volána pg_cronem, který běží interně jako
-- superuser. service_role bypassuje EXECUTE kontroly automaticky.

DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.cleanup_expired_tokens() FROM PUBLIC;
  REVOKE EXECUTE ON FUNCTION public.cleanup_expired_tokens() FROM anon, authenticated;

  REVOKE EXECUTE ON FUNCTION public.handle_new_permanent_user() FROM PUBLIC;
  REVOKE EXECUTE ON FUNCTION public.handle_new_permanent_user() FROM anon, authenticated;

  REVOKE EXECUTE ON FUNCTION public.handle_user_email_update() FROM PUBLIC;
  REVOKE EXECUTE ON FUNCTION public.handle_user_email_update() FROM anon, authenticated;

  REVOKE EXECUTE ON FUNCTION public.link_requests_to_customer() FROM PUBLIC;
  REVOKE EXECUTE ON FUNCTION public.link_requests_to_customer() FROM anon, authenticated;

  REVOKE EXECUTE ON FUNCTION public.link_orders_to_customer() FROM PUBLIC;
  REVOKE EXECUTE ON FUNCTION public.link_orders_to_customer() FROM anon, authenticated;

  RAISE NOTICE '✅ Revoked EXECUTE on 5 SECURITY DEFINER functions from PUBLIC, anon, authenticated';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE WARNING '⚠️  Cannot revoke EXECUTE (insufficient privileges)';
    RAISE WARNING '    Please revoke manually via Supabase Dashboard → Database → Functions';
END $$;

-- ================================================
-- SUCCESS MESSAGE
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ Migration 032 completed!';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 SECURITY CHANGES:';
  RAISE NOTICE '   Odebrán EXECUTE od PUBLIC, anon, authenticated u funkcí:';
  RAISE NOTICE '   1. public.cleanup_expired_tokens()      (volá pg_cron)';
  RAISE NOTICE '   2. public.handle_new_permanent_user()   (trigger)';
  RAISE NOTICE '   3. public.handle_user_email_update()    (trigger)';
  RAISE NOTICE '   4. public.link_requests_to_customer()   (trigger)';
  RAISE NOTICE '   5. public.link_orders_to_customer()     (trigger)';
  RAISE NOTICE '';
  RAISE NOTICE '   service_role bypassuje EXECUTE automaticky,';
  RAISE NOTICE '   triggery a pg_cron EXECUTE grant nepotřebují.';
  RAISE NOTICE '';
END $$;
