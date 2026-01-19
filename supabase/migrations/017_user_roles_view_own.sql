-- ================================================
-- Migration 017: Allow users to view their own roles (FIXED)
-- ================================================
-- Created: 2026-01-11
-- Updated: 2026-01-11 - Fixed Multiple Permissive Policies issue
-- Description: Replace admin-only SELECT policy with merged policy
--              Users can view own roles, admins can view all roles
-- ================================================
-- ISSUE: Migration 002 created admin-only SELECT policy (user_roles_admin_select)
--        Regular users cannot see their own role assignments
-- ================================================
-- ANTI-PATTERN (original approach):
--   ❌ Create new policy alongside existing one → Multiple Permissive Policies
--   ❌ Performance overhead: 2 policies evaluated per SELECT
--   ❌ Supabase Advisor warning: 0006_multiple_permissive_policies
-- ================================================
-- SOLUTION (Supabase Best Practices 2026):
--   ✅ DROP old admin-only policy
--   ✅ CREATE single merged policy with OR logic
--   ✅ One policy per action (SELECT) - optimal performance
-- ================================================
-- REFERENCES:
--   - https://supabase.com/docs/guides/database/database-advisors
--   - https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices
-- ================================================

-- Drop old admin-only SELECT policy from migration 002
DROP POLICY IF EXISTS "user_roles_admin_select" ON user_roles;

-- Create merged policy: users view own roles OR admins view all
CREATE POLICY "user_roles_select"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())  -- ✅ Users can see their own roles
    OR
    (SELECT is_admin())             -- ✅ Admins can see all roles
  );

-- Add helpful comment
COMMENT ON POLICY "user_roles_select" ON user_roles IS
  'Merged policy: Users can view their own role assignments, admins can view all roles. Uses is_admin() helper for consistency.';

-- ================================================
-- SUCCESS MESSAGE
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 017 completed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 FIXED: Multiple Permissive Policies issue';
  RAISE NOTICE '   - Dropped old policy: user_roles_admin_select';
  RAISE NOTICE '   - Created merged policy: user_roles_select';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Single SELECT policy (optimal performance):';
  RAISE NOTICE '   - Users can view own roles: user_id = auth.uid()';
  RAISE NOTICE '   - Admins can view all roles: is_admin()';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Users can now query:';
  RAISE NOTICE '   SELECT * FROM user_roles WHERE user_id = auth.uid();';
  RAISE NOTICE '';
  RAISE NOTICE '⚡ Performance: 1 policy instead of 2 (no Multiple Permissive Policies warning)';
  RAISE NOTICE '🎯 Follows Supabase Best Practices 2026';
END $$;
