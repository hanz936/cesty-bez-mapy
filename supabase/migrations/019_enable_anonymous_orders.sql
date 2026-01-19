-- ================================================
-- Migration 019: Enable Anonymous Sign-Ins for Orders
-- ================================================
-- Created: 2026-01-11
-- Purpose: Allow anonymous users to create orders while maintaining security
--
-- SECURITY GUARANTEES:
-- ✅ Anonymous users CAN create their own orders
-- ✅ Anonymous users CAN view their own orders
-- ✅ Anonymous users CANNOT view other users' orders
-- ✅ Anonymous users CANNOT modify or delete orders
-- ✅ Admins retain full access to all orders
-- ================================================

-- ================================================
-- STEP 1: Add auth_user_id to orders table
-- ================================================

-- Add column to link orders to auth.users (for anonymous users)
ALTER TABLE orders
  ADD COLUMN auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for performance (filtering by auth_user_id)
CREATE INDEX idx_orders_auth_user_id ON orders(auth_user_id);

-- Document the new column
COMMENT ON COLUMN orders.auth_user_id IS 'Link to auth.users for anonymous users (before customer record created)';

-- ================================================
-- STEP 2: Drop old admin-only policies
-- ================================================

-- Drop old restrictive policies from migration 002
DROP POLICY IF EXISTS "orders_admin_insert" ON orders;
DROP POLICY IF EXISTS "orders_admin_select" ON orders;
DROP POLICY IF EXISTS "orders_admin_update" ON orders;
DROP POLICY IF EXISTS "orders_admin_delete" ON orders;

DROP POLICY IF EXISTS "order_items_admin_insert" ON order_items;
DROP POLICY IF EXISTS "order_items_admin_select" ON order_items;
DROP POLICY IF EXISTS "order_items_admin_update" ON order_items;
DROP POLICY IF EXISTS "order_items_admin_delete" ON order_items;

-- ================================================
-- STEP 3: Create new merged policies for orders
-- ================================================

-- Policy: INSERT - Users create their own orders, admins create any
CREATE POLICY "Users and admins can insert orders"
  ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Regular/anonymous users can create orders with their own auth_user_id
    (
      auth_user_id = (SELECT auth.uid())
      AND customer_email IS NOT NULL
      AND customer_name IS NOT NULL
      AND total_amount >= 0
    )
    OR
    -- Admins can create orders for anyone (manual/offline orders)
    (SELECT is_admin())
  );

-- Policy: SELECT - Users view their own orders, admins view all
CREATE POLICY "Users and admins can select orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    -- Users can view orders where they are the auth user
    -- NOTE: When anonymous user upgrades to permanent account via Manual Linking,
    --       auth.uid() remains the same, so this check covers both cases
    (auth_user_id = (SELECT auth.uid()))
    OR
    -- Admins can view all orders
    (SELECT is_admin())
  );

-- Policy: UPDATE - Only admins can update orders
CREATE POLICY "Admins can update orders"
  ON orders
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- Policy: DELETE - Only admins can delete orders
CREATE POLICY "Admins can delete orders"
  ON orders
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- STEP 4: Create new merged policies for order_items
-- ================================================

-- Policy: INSERT - Users add items to their own orders, admins add to any
CREATE POLICY "Users and admins can insert order_items"
  ON order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Users can add items to orders they own
    (
      EXISTS (
        SELECT 1 FROM orders
        WHERE orders.id = order_items.order_id
        AND orders.auth_user_id = (SELECT auth.uid())
      )
    )
    OR
    -- Admins can add items to any order
    (SELECT is_admin())
  );

-- Policy: SELECT - Users view items from their own orders, admins view all
CREATE POLICY "Users and admins can select order_items"
  ON order_items
  FOR SELECT
  TO authenticated
  USING (
    -- Users can view items from their own orders
    (
      EXISTS (
        SELECT 1 FROM orders
        WHERE orders.id = order_items.order_id
        AND orders.auth_user_id = (SELECT auth.uid())
      )
    )
    OR
    -- Admins can view all order items
    (SELECT is_admin())
  );

-- Policy: UPDATE - Only admins can update order items
CREATE POLICY "Admins can update order_items"
  ON order_items
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- Policy: DELETE - Only admins can delete order items
CREATE POLICY "Admins can delete order_items"
  ON order_items
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- SUCCESS MESSAGE
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 019 completed successfully!';
  RAISE NOTICE '🔓 Anonymous users can now create orders';
  RAISE NOTICE '🔒 Security maintained - users only see their own data';
  RAISE NOTICE '👤 Added auth_user_id column to orders table';
  RAISE NOTICE '📋 Created merged RLS policies for orders and order_items';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  NEXT STEPS:';
  RAISE NOTICE '1. Enable Anonymous Sign-Ins in Supabase Dashboard';
  RAISE NOTICE '   → Settings → Authentication → Anonymous sign-ins (toggle ON)';
  RAISE NOTICE '2. Enable Manual Linking in Supabase Dashboard';
  RAISE NOTICE '   → Settings → Authentication → Manual linking (toggle ON)';
  RAISE NOTICE '3. Update Checkout.jsx to call supabase.auth.signInAnonymously()';
  RAISE NOTICE '4. Set auth_user_id when creating orders in Checkout.jsx';
  RAISE NOTICE '';
  RAISE NOTICE '🛡️  SECURITY GUARANTEES:';
  RAISE NOTICE '   ✅ Users can only view/create their own orders';
  RAISE NOTICE '   ✅ Users cannot modify or delete orders';
  RAISE NOTICE '   ✅ Admins retain full access';
END $$;
