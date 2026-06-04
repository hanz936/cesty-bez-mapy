-- ================================================
-- Migration 028: Fix Products and Newsletter RLS Policies
-- ================================================
-- Created: 2026-01-29
-- Author: Security audit
-- Description: Fixes two RLS security issues identified in audit:
--              1. Products: soft-deleted products visible to public
--              2. Newsletter: missing WITH CHECK validation
--
-- Dependencies: 025
-- Affected tables: products, newsletter_consent_log
-- Type: FIX, RLS
-- ================================================
-- ISSUES:
--   1. products_public_select policy uses USING (true), exposing
--      is_deleted = true products to anon/authenticated users.
--      This violates defense in depth - RLS should enforce soft-delete.
--
--   2. newsletter_consent_public_insert policy uses WITH CHECK (true),
--      relying solely on DB constraints. MIGRATIONS.md documents
--      validation that doesn't exist in actual policy.
-- ================================================
-- SOLUTION:
--   1. Update products_public_select to filter is_deleted = false
--      (admins still see all via authenticated_select policy)
--
--   2. Add explicit validation to newsletter INSERT policy
--      (defense in depth, matches documentation)
-- ================================================
-- REFERENCE:
--   https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
--   Supabase 2026 best practices: "Defense in depth" - RLS should enforce
--   business rules, not just rely on application-level filtering.
-- ================================================

-- ================================================
-- PART 1: Fix products_public_select Policy
-- ================================================
-- Before: USING (true) - returns ALL products including is_deleted = true
-- After: USING (is_deleted = false) - returns only active products
--
-- Note: Admins can still see all products via separate admin policies.
-- This change only affects public/anonymous access.

DROP POLICY IF EXISTS "products_public_select" ON products;

-- Policy: Public can read only non-deleted products
-- Admins see all products through is_admin() check in UPDATE/DELETE policies
-- and through authenticated_select pattern if needed
CREATE POLICY "products_public_select"
  ON products
  FOR SELECT
  TO anon, authenticated
  USING (is_deleted = false);

COMMENT ON POLICY "products_public_select" ON products IS
  'Public read access to active products only (is_deleted = false). Updated in migration 028 for defense in depth.';

-- ================================================
-- PART 2: Fix newsletter_consent_public_insert Policy
-- ================================================
-- Before: WITH CHECK (true) - relies solely on DB NOT NULL constraints
-- After: Explicit validation for defense in depth
--
-- This matches the documentation in MIGRATIONS.md:
--   "email + consent_given + source NOT NULL"

DROP POLICY IF EXISTS "newsletter_consent_public_insert" ON newsletter_consent_log;

-- Policy: Anyone can log consent with required fields
-- Explicit validation provides defense in depth beyond DB constraints
CREATE POLICY "newsletter_consent_public_insert"
  ON newsletter_consent_log
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND consent_given IS NOT NULL
    AND source IS NOT NULL
  );

COMMENT ON POLICY "newsletter_consent_public_insert" ON newsletter_consent_log IS
  'Allow public to log consent events. Validates required fields (email, consent_given, source). Updated in migration 028 for defense in depth.';

-- ================================================
-- VERIFICATION
-- ================================================
-- Run these queries after migration to verify:
--
-- Products policy:
-- SELECT policyname, qual FROM pg_policies
-- WHERE tablename = 'products' AND policyname = 'products_public_select';
-- Should show: is_deleted = false
--
-- Newsletter policy:
-- SELECT policyname, with_check FROM pg_policies
-- WHERE tablename = 'newsletter_consent_log' AND policyname = 'newsletter_consent_public_insert';
-- Should show: email IS NOT NULL AND consent_given IS NOT NULL AND source IS NOT NULL

-- ================================================
-- SUCCESS MESSAGE
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '  Migration 028 completed!';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE '  CHANGES MADE:';
  RAISE NOTICE '';
  RAISE NOTICE '  1. products_public_select policy:';
  RAISE NOTICE '     - Before: USING (true) - exposed soft-deleted products';
  RAISE NOTICE '     - After: USING (is_deleted = false)';
  RAISE NOTICE '     - Admins still see all via admin policies';
  RAISE NOTICE '';
  RAISE NOTICE '  2. newsletter_consent_public_insert policy:';
  RAISE NOTICE '     - Before: WITH CHECK (true) - no validation';
  RAISE NOTICE '     - After: WITH CHECK (email, consent_given, source NOT NULL)';
  RAISE NOTICE '     - Defense in depth, matches MIGRATIONS.md documentation';
  RAISE NOTICE '';
  RAISE NOTICE '  SECURITY IMPROVEMENTS:';
  RAISE NOTICE '     Defense in depth: RLS now enforces business rules';
  RAISE NOTICE '     Soft-deleted products hidden at database level';
  RAISE NOTICE '     Newsletter validation at policy + constraint level';
  RAISE NOTICE '';
  RAISE NOTICE '  TABLES AFFECTED:';
  RAISE NOTICE '     products';
  RAISE NOTICE '     newsletter_consent_log';
  RAISE NOTICE '';
END $$;
