-- ================================================
-- Migration 016: Fix Custom Requests Admin Authorization
-- ================================================
-- Created: 2026-01-11
-- Description: Fix admin authorization in custom_itinerary_requests policies
--              Replace app_metadata.role with is_admin() helper for consistency
-- ================================================
-- ISSUE: Migration 015 used app_metadata.role which is NOT set by custom_access_token_hook
--        JWT contains is_admin and user_role, but NOT app_metadata.role
--        This caused admins to lose access to custom_itinerary_requests
-- ================================================
-- SOLUTION: Use is_admin() helper (reads is_admin boolean from JWT)
--           This is consistent with all other tables in the database
-- ================================================

-- Drop existing policies with incorrect admin checks
DROP POLICY IF EXISTS "Users and admins can insert requests" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "Users and admins can select requests" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "Users and admins can update requests" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "Admins can delete requests" ON custom_itinerary_requests;

-- ✅ Policy #1: INSERT - Use is_admin() helper
CREATE POLICY "Users and admins can insert requests"
  ON custom_itinerary_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth_user_id = (select auth.uid())
    OR
    (SELECT is_admin())  -- ✅ FIXED: Use is_admin() instead of app_metadata.role
  );

-- ✅ Policy #2: SELECT - Use is_admin() helper
CREATE POLICY "Users and admins can select requests"
  ON custom_itinerary_requests
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = (select auth.uid())
    OR
    (SELECT is_admin())  -- ✅ FIXED
  );

-- ✅ Policy #3: UPDATE - Use is_admin() helper
CREATE POLICY "Users and admins can update requests"
  ON custom_itinerary_requests
  FOR UPDATE
  TO authenticated
  USING (
    auth_user_id = (select auth.uid())
    OR
    (SELECT is_admin())  -- ✅ FIXED
  )
  WITH CHECK (
    (
      auth_user_id = (select auth.uid()) AND
      ((select auth.jwt()) -> 'is_anonymous')::boolean IS NOT TRUE
    )
    OR
    (SELECT is_admin())  -- ✅ FIXED
  );

-- ✅ Policy #4: DELETE - Use is_admin() helper
CREATE POLICY "Admins can delete requests"
  ON custom_itinerary_requests
  FOR DELETE
  TO authenticated
  USING (
    (SELECT is_admin())  -- ✅ FIXED
  );

-- Update policy comments
COMMENT ON POLICY "Users and admins can insert requests" ON custom_itinerary_requests IS
  'Users can insert their own requests, admins can insert any. Uses is_admin() for consistency with other tables.';

COMMENT ON POLICY "Users and admins can select requests" ON custom_itinerary_requests IS
  'Users can view their own requests, admins can view all. Uses is_admin() helper.';

COMMENT ON POLICY "Users and admins can update requests" ON custom_itinerary_requests IS
  'Users can update their own requests (permanent users only), admins can update any. Uses is_admin() helper.';

COMMENT ON POLICY "Admins can delete requests" ON custom_itinerary_requests IS
  'Only admins can delete requests. Uses is_admin() helper.';

-- ================================================
-- SUCCESS MESSAGE
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 016 completed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 FIXED: Admin authorization for custom_itinerary_requests';
  RAISE NOTICE '   - Replaced app_metadata.role with is_admin() helper';
  RAISE NOTICE '   - All 4 policies now consistent with rest of database';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Admins should now have full access to:';
  RAISE NOTICE '   - View all custom itinerary requests';
  RAISE NOTICE '   - Create new requests';
  RAISE NOTICE '   - Update existing requests';
  RAISE NOTICE '   - Delete requests';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  NOTE: Users must refresh their browser to see changes!';
  RAISE NOTICE '          (Hard refresh: Ctrl+Shift+R or Cmd+Shift+R)';
END $$;
