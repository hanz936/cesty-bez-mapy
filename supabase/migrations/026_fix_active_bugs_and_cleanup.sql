-- ================================================
-- Migration 026: Fix Active Bugs and Cleanup
-- ================================================
-- Created: 2026-01-27
-- Updated: 2026-01-29 (robustní handling pro pg_cron a orphaned customers)
-- Author: Audit oprav
-- Description: Opravuje 2 aktivní bugy v orders tabulce (NOT NULL constrainty
--              bránící anonymous checkout), přidává FK customers→auth.users,
--              odstraňuje osiřelou funkci, nastavuje pg_cron.
--
-- Dependencies: 001, 013, 014, 019, 025
-- Affected tables: orders, customers
-- Type: FIX, CLEANUP
-- ================================================
-- ISSUES:
--   #18: orders.stripe_payment_id je NOT NULL — brání vytvoření objednávky před Stripe platbou
--   #H:  orders.customer_name je NOT NULL — brání anonymous checkout
--   #C:  customers.id nemá FK na auth.users(id)
--   #15: handle_new_user() je osiřelá funkce (nahrazena handle_new_permanent_user v 013)
--   #J:  cleanup_expired_tokens() nemá pg_cron job
-- ================================================
-- SOLUTION:
--   1. Odstranit NOT NULL z orders.stripe_payment_id a orders.customer_name
--   2. Přidat FK customers.id → auth.users(id) ON DELETE CASCADE (s cleanup orphaned records)
--   3. Dropnout osiřelou handle_new_user()
--   4. Nastavit pg_cron pro cleanup_expired_tokens() (graceful degradation pro Free tier)
-- ================================================

-- ================================================
-- PART 1: Fix NOT NULL constrainty pro anonymous checkout (#18, #H)
-- ================================================

-- stripe_payment_id nemusí být vyplněn při vytvoření objednávky (platba přijde později)
ALTER TABLE public.orders ALTER COLUMN stripe_payment_id DROP NOT NULL;

-- customer_name nemusí být znám při anonymous checkout
ALTER TABLE public.orders ALTER COLUMN customer_name DROP NOT NULL;

-- ================================================
-- PART 2a: Přidat FK customers.id → auth.users(id) (#C)
-- ================================================
-- Robustní handling:
-- 1. Najít orphaned customers (bez auth.users záznamu)
-- 2. Smazat ty bez objednávek/requests (bezpečné)
-- 3. Pokud zůstanou orphaned s objednávkami → přeskočit FK + warning
-- 4. Pokud žádné nezůstanou → přidat FK

DO $$
DECLARE
  orphan_count int;
  orphan_with_data int;
  deleted_count int;
BEGIN
  -- Spočítat orphaned customers
  SELECT COUNT(*) INTO orphan_count
  FROM public.customers c
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.id);

  IF orphan_count > 0 THEN
    RAISE NOTICE 'Found % orphaned customer(s) without auth.users record', orphan_count;

    -- Spočítat kolik z nich má objednávky nebo custom requests
    SELECT COUNT(*) INTO orphan_with_data
    FROM public.customers c
    WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.id)
      AND (
        EXISTS (SELECT 1 FROM public.orders o WHERE o.customer_id = c.id)
        OR EXISTS (SELECT 1 FROM public.custom_itinerary_requests cr WHERE cr.customer_id = c.id)
      );

    -- Smazat orphaned customers BEZ objednávek a custom requests (bezpečné)
    WITH deleted AS (
      DELETE FROM public.customers c
      WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.id)
        AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.customer_id = c.id)
        AND NOT EXISTS (SELECT 1 FROM public.custom_itinerary_requests cr WHERE cr.customer_id = c.id)
      RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;

    IF deleted_count > 0 THEN
      RAISE NOTICE 'Deleted % orphaned customer(s) without orders/requests', deleted_count;
    END IF;

    -- Pokud zůstaly orphaned s daty, přeskočit FK
    IF orphan_with_data > 0 THEN
      RAISE WARNING '========================================';
      RAISE WARNING '% orphaned customer(s) have orders/requests - SKIPPING FK constraint', orphan_with_data;
      RAISE WARNING 'To resolve manually, run:';
      RAISE WARNING '  SELECT c.id, c.email, ';
      RAISE WARNING '    (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) as orders,';
      RAISE WARNING '    (SELECT COUNT(*) FROM custom_itinerary_requests cr WHERE cr.customer_id = c.id) as requests';
      RAISE WARNING '  FROM customers c';
      RAISE WARNING '  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.id);';
      RAISE WARNING '========================================';
      RETURN;
    END IF;
  END IF;

  -- Přidat FK constraint
  ALTER TABLE public.customers
    ADD CONSTRAINT fk_customers_auth_users
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

  RAISE NOTICE 'FK constraint fk_customers_auth_users added successfully';

EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'FK constraint fk_customers_auth_users already exists';
END $$;

-- ================================================
-- PART 2b: Odstranit osiřelou funkci handle_new_user() (#15)
-- ================================================

-- Funkce byla vytvořena v migraci 002, nahrazena handle_new_permanent_user() v 013.
-- Trigger on_auth_user_created je od migrace 013 napojený na handle_new_permanent_user().
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ================================================
-- PART 2c: Nastavit pg_cron pro cleanup_expired_tokens() (#J)
-- ================================================
-- Graceful degradation: pg_cron vyžaduje Pro tier na Supabase.
-- Na Free tieru migrace projde s warningem, po upgrade lze znovu spustit.

DO $$
BEGIN
  -- Zkusit vytvořit extension
  CREATE EXTENSION IF NOT EXISTS pg_cron;

  -- Naplánovat job (idempotentní - pokud existuje, unschedule + schedule)
  PERFORM cron.unschedule('cleanup-expired-tokens');

  PERFORM cron.schedule(
    'cleanup-expired-tokens',
    '0 3 * * *',
    $$SELECT public.cleanup_expired_tokens()$$
  );

  RAISE NOTICE 'pg_cron job cleanup-expired-tokens scheduled (daily at 03:00)';

EXCEPTION
  WHEN undefined_object THEN
    RAISE WARNING '========================================';
    RAISE WARNING 'pg_cron extension not available (requires Supabase Pro plan)';
    RAISE WARNING 'Skipping automatic token cleanup scheduling.';
    RAISE WARNING 'After upgrading to Pro, run:';
    RAISE WARNING '  CREATE EXTENSION IF NOT EXISTS pg_cron;';
    RAISE WARNING '  SELECT cron.schedule(''cleanup-expired-tokens'', ''0 3 * * *'', ''SELECT public.cleanup_expired_tokens()'');';
    RAISE WARNING '========================================';
  WHEN insufficient_privilege THEN
    RAISE WARNING '========================================';
    RAISE WARNING 'Insufficient privileges to create pg_cron extension';
    RAISE WARNING 'Skipping automatic token cleanup scheduling.';
    RAISE WARNING '========================================';
  WHEN OTHERS THEN
    -- cron.unschedule může vyhodit chybu pokud job neexistuje - to je OK
    IF SQLERRM LIKE '%does not exist%' OR SQLERRM LIKE '%could not find%' THEN
      -- Job neexistoval, zkusit znovu bez unschedule
      BEGIN
        PERFORM cron.schedule(
          'cleanup-expired-tokens',
          '0 3 * * *',
          $$SELECT public.cleanup_expired_tokens()$$
        );
        RAISE NOTICE 'pg_cron job cleanup-expired-tokens scheduled (daily at 03:00)';
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Failed to schedule pg_cron job: %', SQLERRM;
      END;
    ELSE
      RAISE WARNING 'pg_cron setup failed: %', SQLERRM;
    END IF;
END $$;

-- ================================================
-- VERIFICATION
-- ================================================
-- Ověření správnosti po spuštění migrace:
--
-- 1. Ověřit nullable sloupce:
--    SELECT column_name, is_nullable FROM information_schema.columns
--    WHERE table_name = 'orders' AND column_name IN ('stripe_payment_id', 'customer_name');
--
-- 2. Ověřit FK customers → auth.users:
--    SELECT conname FROM pg_constraint
--    WHERE conrelid = 'public.customers'::regclass AND contype = 'f';
--
-- 3. Ověřit, že handle_new_user() neexistuje:
--    SELECT proname FROM pg_proc WHERE proname = 'handle_new_user';
--
-- 4. Ověřit pg_cron job (pouze Pro tier):
--    SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'cleanup-expired-tokens';
--
-- 5. Ověřit orphaned customers:
--    SELECT COUNT(*) FROM customers c WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = c.id);

-- ================================================
-- SUCCESS MESSAGE
-- ================================================
DO $$
DECLARE
  fk_exists boolean;
  cron_available boolean;
BEGIN
  -- Zkontrolovat stav FK
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.customers'::regclass
      AND conname = 'fk_customers_auth_users'
  ) INTO fk_exists;

  -- Zkontrolovat pg_cron
  SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) INTO cron_available;

  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration 026 completed!';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 CHANGES MADE:';
  RAISE NOTICE '   1. orders.stripe_payment_id: odstraněn NOT NULL';
  RAISE NOTICE '   2. orders.customer_name: odstraněn NOT NULL';

  IF fk_exists THEN
    RAISE NOTICE '   3. customers.id: přidán FK → auth.users(id) ON DELETE CASCADE';
  ELSE
    RAISE NOTICE '   3. customers.id: FK PŘESKOČEN (orphaned records s daty)';
  END IF;

  RAISE NOTICE '   4. handle_new_user(): osiřelá funkce odstraněna';

  IF cron_available THEN
    RAISE NOTICE '   5. pg_cron: cleanup-expired-tokens naplánován na 03:00 denně';
  ELSE
    RAISE NOTICE '   5. pg_cron: PŘESKOČEN (vyžaduje Pro plan)';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '📋 TABLES AFFECTED:';
  RAISE NOTICE '   orders, customers';
  RAISE NOTICE '';

  IF NOT fk_exists OR NOT cron_available THEN
    RAISE NOTICE '⚠️  NEXT STEPS:';
    IF NOT fk_exists THEN
      RAISE NOTICE '   - Vyřešit orphaned customers (viz WARNING výše)';
    END IF;
    IF NOT cron_available THEN
      RAISE NOTICE '   - Po upgrade na Pro tier: znovu spustit pg_cron část';
    END IF;
  ELSE
    RAISE NOTICE '⚠️  NEXT STEPS:';
    RAISE NOTICE '   Žádné další kroky nejsou potřeba.';
  END IF;
END $$;
