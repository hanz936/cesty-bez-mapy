-- ================================================
-- Migration 012: Custom Itinerary Requests RLS (CORRECTED)
-- ================================================
-- Created: 2026-01-10
-- Description: Adds auth_user_id column and Row Level Security policies
--              CRITICAL FIX: Uses auth_user_id (auth.users.id) instead of customer_id
--              This enables guest checkout with anonymous authentication
-- ================================================
-- IMPORTANT: This migration fixes the schema mismatch issue where
--            customer_id (customers.id) cannot be compared with auth.uid()
--            because they are different UUIDs!
-- ================================================

-- ================================================
-- STEP 1: Add auth_user_id Column
-- ================================================
-- This column stores the auth.users.id (works for both anonymous and permanent users)

ALTER TABLE custom_itinerary_requests
  ADD COLUMN IF NOT EXISTS auth_user_id uuid
  REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for RLS performance (CRITICAL for query performance)
CREATE INDEX IF NOT EXISTS idx_custom_requests_auth_user_id
  ON custom_itinerary_requests(auth_user_id);

-- Add helpful comments
COMMENT ON COLUMN custom_itinerary_requests.auth_user_id IS
  'Auth user ID (from auth.users) - supports both anonymous and permanent users. Used for RLS policies.';

COMMENT ON COLUMN custom_itinerary_requests.customer_id IS
  'Customer ID (from customers table) - NULL for guests, automatically populated after account creation via trigger';

-- ================================================
-- STEP 2: Enable Row Level Security
-- ================================================

ALTER TABLE custom_itinerary_requests ENABLE ROW LEVEL SECURITY;

-- ================================================
-- STEP 3: Create RLS Policies
-- ================================================

-- ✅ Policy #1: Authenticated users can INSERT (including anonymous)
CREATE POLICY "Authenticated users can create requests"
  ON custom_itinerary_requests
  FOR INSERT
  TO authenticated  -- ✅ Anonymous users use this role too!
  WITH CHECK (
    auth_user_id = auth.uid()  -- ✅ Works for both anonymous and permanent users
  );

-- ✅ Policy #2: Users can SELECT their own requests (by auth_user_id)
CREATE POLICY "Users can view their own requests"
  ON custom_itinerary_requests
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid()  -- ✅ Correct: compares auth.users.id with auth.uid()
  );

-- ✅ Policy #3: Users can UPDATE their own requests (only non-anonymous)
CREATE POLICY "Permanent users can update their requests"
  ON custom_itinerary_requests
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (
    auth_user_id = auth.uid() AND
    -- Prevent anonymous users from updating (optional security measure)
    (auth.jwt() -> 'is_anonymous')::boolean IS NOT TRUE
  );

-- ✅ Policy #4: Admin full access (read, insert, update, delete)
CREATE POLICY "Admins can manage all requests"
  ON custom_itinerary_requests
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'
  );

-- ✅ Policy #5: Anon role can't access anything (safety measure)
CREATE POLICY "Anon role blocked"
  ON custom_itinerary_requests
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false);

-- ================================================
-- STEP 4: Update Existing Records (if any)
-- ================================================
-- If you have existing records with customer_id but no auth_user_id,
-- this will attempt to link them. This is safe because customers.id
-- should match auth.users.id when created via trigger.

UPDATE custom_itinerary_requests
SET auth_user_id = customer_id
WHERE auth_user_id IS NULL
  AND customer_id IS NOT NULL;

-- ================================================
-- SUCCESS MESSAGE
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 012 completed successfully!';
  RAISE NOTICE '🔑 Added auth_user_id column (auth.users.id reference)';
  RAISE NOTICE '🛡️  Enabled Row Level Security on custom_itinerary_requests';
  RAISE NOTICE '📜 Created 5 RLS policies:';
  RAISE NOTICE '   1. Authenticated users can INSERT (guest checkout enabled)';
  RAISE NOTICE '   2. Users can SELECT own requests (by auth_user_id)';
  RAISE NOTICE '   3. Permanent users can UPDATE own requests';
  RAISE NOTICE '   4. Admins can manage all requests';
  RAISE NOTICE '   5. Anon role blocked (security measure)';
  RAISE NOTICE '📊 Created index for RLS performance';
  RAISE NOTICE '🔗 Updated existing records with auth_user_id';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  NEXT STEP: Run Migration 013 to create auth sync triggers';
END $$;
