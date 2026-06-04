-- ================================================
-- Migration 033: Cleanup orphaned anonymous users
-- ================================================
-- Created: 2026-04-30
-- Description: Phase 7 of sales workflow audit — drobnosti.
--              Maže "ghost" anonymní auth.users (vyrobené signInAnonymously,
--              ale nikdy nepoužité) starší než 60 dní bez vazby na orders
--              nebo custom_itinerary_requests. NOT EXISTS guard zaručuje,
--              že žádný uživatel s objednávkou nebo požadavkem se nesmaže —
--              link_orders_to_customer linkuje přes email, takže registrace
--              po smazání anon usera funguje. GDPR storage minimization
--              (Art. 5(1)(e)).
-- ================================================

-- ================================================
-- PART 1: Function definition
-- ================================================
-- SECURITY DEFINER + search_path = '' + fully qualified names.
-- Vrací počet smazaných řádků; RAISE NOTICE pro pg_cron logy.

CREATE OR REPLACE FUNCTION public.cleanup_orphaned_anon_users(retention_days int DEFAULT 60)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted_count int;
BEGIN
  WITH deleted AS (
    DELETE FROM auth.users u
    WHERE u.is_anonymous = true
      AND u.created_at < now() - (retention_days || ' days')::interval
      AND NOT EXISTS (
        SELECT 1 FROM public.orders o WHERE o.auth_user_id = u.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.custom_itinerary_requests r WHERE r.auth_user_id = u.id
      )
    RETURNING u.id
  )
  SELECT count(*) INTO v_deleted_count FROM deleted;

  RAISE NOTICE 'cleanup_orphaned_anon_users: deleted % orphaned anonymous user(s) older than % days', v_deleted_count, retention_days;

  RETURN v_deleted_count;
END;
$$;

ALTER FUNCTION public.cleanup_orphaned_anon_users(int) OWNER TO postgres;

COMMENT ON FUNCTION public.cleanup_orphaned_anon_users(int) IS
  'Maže anonymní auth.users starší než retention_days bez vazby na orders/custom_itinerary_requests. Volá pg_cron.';

-- ================================================
-- PART 2: Lockdown EXECUTE
-- ================================================
-- Mirror migrace 032: SECURITY DEFINER funkce nesmí být volatelná
-- z PUBLIC/anon/authenticated. service_role bypassuje EXECUTE automaticky,
-- pg_cron běží interně jako superuser.

DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.cleanup_orphaned_anon_users(int) FROM PUBLIC;
  REVOKE EXECUTE ON FUNCTION public.cleanup_orphaned_anon_users(int) FROM anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.cleanup_orphaned_anon_users(int) TO service_role;

  RAISE NOTICE '✅ Locked down EXECUTE on cleanup_orphaned_anon_users (service_role only)';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE WARNING '⚠️  Cannot revoke/grant EXECUTE (insufficient privileges)';
    RAISE WARNING '    Please lockdown manually via Supabase Dashboard → Database → Functions';
END $$;

-- ================================================
-- PART 3: One-time cleanup execution
-- ================================================
-- Při aplikaci migrace rovnou jednou pročistí. Aktuálně vrátí 0
-- (žádný anon user starší 60 dní bez vazeb), ale potvrdí, že funkce funguje.

DO $$
DECLARE
  v_deleted int;
BEGIN
  v_deleted := public.cleanup_orphaned_anon_users(60);
  RAISE NOTICE '🧹 One-time cleanup on migration apply: deleted % orphaned anonymous user(s)', v_deleted;
END $$;

-- ================================================
-- PART 4: Schedule daily pg_cron job (graceful degradation)
-- ================================================
-- pg_cron extension není defaultně povolená. Pokud schema 'cron' neexistuje,
-- migrace projde s warningem a uživatel ho po enable v Dashboardu spustí ručně.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    -- Idempotentní: pokud job s tímto názvem existuje, nejdřív unschedule.
    BEGIN
      PERFORM cron.unschedule('cleanup-orphaned-anon-users');
    EXCEPTION
      WHEN OTHERS THEN
        -- Job neexistuje — to je OK, pokračujeme.
        NULL;
    END;

    PERFORM cron.schedule(
      'cleanup-orphaned-anon-users',
      '0 3 * * *',
      $job$SELECT public.cleanup_orphaned_anon_users(60)$job$
    );

    RAISE NOTICE '✅ pg_cron job cleanup-orphaned-anon-users scheduled (daily at 03:00 UTC)';
  ELSE
    RAISE WARNING '========================================';
    RAISE WARNING 'pg_cron extension is not enabled — skipping schedule';
    RAISE WARNING 'Enable it in Supabase Dashboard → Database → Extensions → pg_cron, then run:';
    RAISE WARNING '  SELECT cron.schedule(''cleanup-orphaned-anon-users'', ''0 3 * * *'', ''SELECT public.cleanup_orphaned_anon_users(60)'');';
    RAISE WARNING '========================================';
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE WARNING '⚠️  Insufficient privileges to schedule pg_cron job — schedule manually after enabling pg_cron.';
  WHEN OTHERS THEN
    RAISE WARNING '⚠️  pg_cron scheduling failed: %', SQLERRM;
END $$;

-- ================================================
-- SUCCESS MESSAGE
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ Migration 033 completed!';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE '🧹 ZMĚNY:';
  RAISE NOTICE '   1. Vytvořena funkce public.cleanup_orphaned_anon_users(int)';
  RAISE NOTICE '      (SECURITY DEFINER, search_path = '''', owner postgres)';
  RAISE NOTICE '   2. EXECUTE odebrán PUBLIC/anon/authenticated, povolen jen service_role';
  RAISE NOTICE '   3. Spuštěn jednorázový cleanup (retention 60 dní)';
  RAISE NOTICE '   4. Naplánován pg_cron job ''cleanup-orphaned-anon-users'' na 03:00 UTC';
  RAISE NOTICE '      (pokud pg_cron není enabled, viz WARNING výše)';
  RAISE NOTICE '';
  RAISE NOTICE '   GDPR: storage minimization (Art. 5(1)(e)).';
  RAISE NOTICE '';
END $$;
