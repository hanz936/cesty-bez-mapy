-- ================================================
-- Migration 015: RLS Performance Optimization
-- ================================================
-- Created: 2026-01-10
-- Description: Optimize RLS policies to avoid re-evaluating auth functions for each row
--              Replace auth.uid() with (select auth.uid())
--              Replace auth.jwt() with (select auth.jwt())
-- ================================================
-- ISSUE: Supabase Advisor warning "Auth RLS Initialization Plan"
--        "Table has a row level security policy that re-evaluates
--         auth.<function>() for each row. This produces suboptimal
--         query performance at scale."
-- ================================================
-- SOLUTION: Wrap auth function calls in subquery (select ...)
--           This evaluates the function ONCE per query instead of per row
-- ================================================
-- REFERENCE: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- ================================================

-- ================================================
-- PART 1: Recreate custom_itinerary_requests policies with optimized auth calls
-- ================================================
-- FIX #1: Optimize auth function calls (use subquery)
-- FIX #2: Merge admin + user policies to avoid multiple permissive policies per action

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can create requests" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "Users can view their own requests" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "Permanent users can update their requests" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "Admins can manage all requests" ON custom_itinerary_requests;

-- ✅ Policy #1: INSERT - Users insert own requests OR admins insert any
-- MERGED: Combines "Authenticated users can create" + "Admins can manage all" → ONE policy
-- OPTIMIZED: auth.uid() → (select auth.uid()), auth.jwt() → (select auth.jwt())
CREATE POLICY "Users and admins can insert requests"
  ON custom_itinerary_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User can insert their own request
    auth_user_id = (select auth.uid())
    OR
    -- Admin can insert any request
    ((select auth.jwt()) -> 'app_metadata' ->> 'role')::text = 'admin'
  );

-- ✅ Policy #2: SELECT - Users view own requests OR admins view all
-- MERGED: Combines "Users can view their own" + "Admins can manage all" → ONE policy
-- OPTIMIZED: auth.uid() → (select auth.uid()), auth.jwt() → (select auth.jwt())
CREATE POLICY "Users and admins can select requests"
  ON custom_itinerary_requests
  FOR SELECT
  TO authenticated
  USING (
    -- User can view their own requests
    auth_user_id = (select auth.uid())
    OR
    -- Admin can view all requests
    ((select auth.jwt()) -> 'app_metadata' ->> 'role')::text = 'admin'
  );

-- ✅ Policy #3: UPDATE - Permanent users update own OR admins update any
-- MERGED: Combines "Permanent users can update" + "Admins can manage all" → ONE policy
-- OPTIMIZED: auth.uid() → (select auth.uid()), auth.jwt() → (select auth.jwt())
CREATE POLICY "Users and admins can update requests"
  ON custom_itinerary_requests
  FOR UPDATE
  TO authenticated
  USING (
    -- User can update their own request (must be the owner)
    auth_user_id = (select auth.uid())
    OR
    -- Admin can update any request
    ((select auth.jwt()) -> 'app_metadata' ->> 'role')::text = 'admin'
  )
  WITH CHECK (
    -- User can update their own request (must be permanent, not anonymous)
    (
      auth_user_id = (select auth.uid()) AND
      ((select auth.jwt()) -> 'is_anonymous')::boolean IS NOT TRUE
    )
    OR
    -- Admin can update any request (no restrictions)
    ((select auth.jwt()) -> 'app_metadata' ->> 'role')::text = 'admin'
  );

-- ✅ Policy #4: DELETE - Only admins can delete
-- OPTIMIZED: auth.jwt() → (select auth.jwt())
CREATE POLICY "Admins can delete requests"
  ON custom_itinerary_requests
  FOR DELETE
  TO authenticated
  USING (
    ((select auth.jwt()) -> 'app_metadata' ->> 'role')::text = 'admin'
  );

-- Note: "Anon role blocked" policy doesn't need changes (no auth calls, no overlap)

-- ================================================
-- SUCCESS MESSAGE
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 015 completed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '⚡ PERFORMANCE OPTIMIZATION #1: Auth Function Calls';
  RAISE NOTICE '   ✅ Replaced auth.uid() with (select auth.uid())';
  RAISE NOTICE '   ✅ Replaced auth.jwt() with (select auth.jwt())';
  RAISE NOTICE '   📊 Impact: Auth functions now evaluated ONCE per query';
  RAISE NOTICE '              (instead of ONCE PER ROW)';
  RAISE NOTICE '';
  RAISE NOTICE '⚡ PERFORMANCE OPTIMIZATION #2: Multiple Permissive Policies';
  RAISE NOTICE '   ✅ Merged admin + user policies into single policies';
  RAISE NOTICE '   📊 Impact: Only ONE policy evaluated per action';
  RAISE NOTICE '              (instead of TWO policies)';
  RAISE NOTICE '';
  RAISE NOTICE '🔄 BEFORE (5 policies):';
  RAISE NOTICE '   1. Authenticated users can create requests (INSERT)';
  RAISE NOTICE '   2. Users can view their own requests (SELECT)';
  RAISE NOTICE '   3. Permanent users can update their requests (UPDATE)';
  RAISE NOTICE '   4. Admins can manage all requests (ALL - overlaps with 1,2,3!)';
  RAISE NOTICE '   5. Anon role blocked (RESTRICTIVE)';
  RAISE NOTICE '';
  RAISE NOTICE '✅ AFTER (5 policies):';
  RAISE NOTICE '   1. Users and admins can insert requests (INSERT) - MERGED';
  RAISE NOTICE '   2. Users and admins can select requests (SELECT) - MERGED';
  RAISE NOTICE '   3. Users and admins can update requests (UPDATE) - MERGED';
  RAISE NOTICE '   4. Admins can delete requests (DELETE) - NEW';
  RAISE NOTICE '   5. Anon role blocked (RESTRICTIVE) - UNCHANGED';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 BENEFITS:';
  RAISE NOTICE '   ✅ No more "Auth RLS Initialization Plan" warnings';
  RAISE NOTICE '   ✅ No more "Multiple Permissive Policies" warnings';
  RAISE NOTICE '   ✅ Faster query performance at scale';
  RAISE NOTICE '   ✅ Cleaner, more maintainable policies';
  RAISE NOTICE '';
  RAISE NOTICE '📚 Reference:';
  RAISE NOTICE '   https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select';
END $$;
