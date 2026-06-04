-- ================================================
-- Migration 027: Fix Orders INSERT Policy
-- ================================================
-- Created: 2026-01-28
-- Author: Audit oprav
-- Description: Opravuje RLS policy pro orders INSERT - odstraňuje
--              customer_name IS NOT NULL check, který blokoval anonymous checkout.
--
-- Dependencies: 025, 026
-- Affected tables: orders
-- Type: FIX
-- ================================================
-- ISSUE:
--   Migrace 026 správně odstranila NOT NULL constraint z orders.customer_name,
--   ale policy "Users and admins can insert orders" (vytvořená v migraci 025)
--   stále obsahuje WITH CHECK (... AND customer_name IS NOT NULL ...).
--
--   Důsledek: Anonymous users nemohou vytvořit objednávku bez customer_name,
--   i když databázový sloupec je nullable.
-- ================================================
-- SOLUTION:
--   Aktualizovat policy - odstranit customer_name IS NOT NULL check.
--   customer_email zůstává povinný (identifikace zákazníka).
-- ================================================

-- ================================================
-- PART 1: Drop and recreate orders INSERT policy
-- ================================================

DROP POLICY IF EXISTS "Users and admins can insert orders" ON orders;

CREATE POLICY "Users and admins can insert orders"
  ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      auth_user_id = (SELECT auth.uid())
      AND customer_email IS NOT NULL
      -- customer_name může být NULL pro anonymous checkout
      AND total_amount >= 0
    )
    OR (SELECT is_admin())
  );

-- ================================================
-- VERIFICATION
-- ================================================
-- Ověření správnosti po spuštění migrace:
--
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'orders' AND policyname = 'Users and admins can insert orders';
--
-- with_check by měl obsahovat customer_email IS NOT NULL, ale NE customer_name IS NOT NULL

-- ================================================
-- SUCCESS MESSAGE
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 027 completed!';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 CHANGES MADE:';
  RAISE NOTICE '   Policy "Users and admins can insert orders" aktualizována';
  RAISE NOTICE '   - Odstraněn: customer_name IS NOT NULL check';
  RAISE NOTICE '   - Zachován: customer_email IS NOT NULL (identifikace)';
  RAISE NOTICE '   - Zachován: total_amount >= 0 (validace)';
  RAISE NOTICE '';
  RAISE NOTICE '📋 TABLES AFFECTED:';
  RAISE NOTICE '   orders';
  RAISE NOTICE '';
  RAISE NOTICE '✨ RESULT:';
  RAISE NOTICE '   Anonymous checkout nyní funguje správně.';
END $$;
