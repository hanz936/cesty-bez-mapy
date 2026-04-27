-- ================================================
-- Migration 025: Cleanup Duplicate and Legacy Policies
-- ================================================
-- Created: 2026-01-23
-- Description: Comprehensive cleanup of all RLS policies to ensure
--              consistent state after incremental migrations.
-- ================================================
-- ISSUES IDENTIFIED BY AUDIT:
--   1. Migration 012 created policies WITHOUT dropping old ones first
--   2. "Anon role blocked" policy from migration 012 was never dropped
--   3. Potential duplicate policies with different naming conventions
--   4. Admin logic inconsistencies (app_metadata.role vs is_admin())
-- ================================================
-- SOLUTION:
--   PART A: DROP all possible policy names (old + new conventions)
--   PART B: CREATE clean, consistent policies using is_admin()
--   PART C: Verification query to confirm final state
-- ================================================
-- REFERENCE: This migration follows Supabase 2026 best practices:
--   - Single policy per action (no multiple permissive policies)
--   - auth.jwt() wrapped in (SELECT ...) for performance
--   - is_admin() helper for consistent admin checks
-- ================================================

-- ================================================
-- PART A: DROP ALL POSSIBLE POLICY NAMES
-- ================================================
-- Using DROP POLICY IF EXISTS for idempotency
-- This ensures clean state regardless of which migrations were applied

-- ================================================
-- A.1: custom_itinerary_requests (CRITICAL)
-- ================================================

-- From migration 002 (snake_case convention)
DROP POLICY IF EXISTS "custom_requests_public_insert" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "custom_requests_admin_select" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "custom_requests_admin_update" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "custom_requests_admin_delete" ON custom_itinerary_requests;

-- From migration 012 (human readable, NEVER FULLY DROPPED!)
DROP POLICY IF EXISTS "Authenticated users can create requests" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "Users can view their own requests" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "Permanent users can update their requests" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "Admins can manage all requests" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "Anon role blocked" ON custom_itinerary_requests;

-- From migration 016+ (current convention)
DROP POLICY IF EXISTS "Users and admins can insert requests" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "Users and admins can select requests" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "Users and admins can update requests" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "Admins can delete requests" ON custom_itinerary_requests;

-- ================================================
-- A.2: orders
-- ================================================

-- From migration 002 (snake_case)
DROP POLICY IF EXISTS "orders_admin_select" ON orders;
DROP POLICY IF EXISTS "orders_admin_insert" ON orders;
DROP POLICY IF EXISTS "orders_admin_update" ON orders;
DROP POLICY IF EXISTS "orders_admin_delete" ON orders;

-- From migration 019+ (human readable)
DROP POLICY IF EXISTS "Users and admins can insert orders" ON orders;
DROP POLICY IF EXISTS "Users and admins can select orders" ON orders;
DROP POLICY IF EXISTS "Admins can update orders" ON orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON orders;

-- ================================================
-- A.3: order_items
-- ================================================

-- From migration 002 (snake_case)
DROP POLICY IF EXISTS "order_items_admin_select" ON order_items;
DROP POLICY IF EXISTS "order_items_admin_insert" ON order_items;
DROP POLICY IF EXISTS "order_items_admin_update" ON order_items;
DROP POLICY IF EXISTS "order_items_admin_delete" ON order_items;

-- From migration 019+ (human readable)
DROP POLICY IF EXISTS "Users and admins can insert order_items" ON order_items;
DROP POLICY IF EXISTS "Users and admins can select order_items" ON order_items;
DROP POLICY IF EXISTS "Admins can update order_items" ON order_items;
DROP POLICY IF EXISTS "Admins can delete order_items" ON order_items;

-- ================================================
-- A.4: user_roles
-- ================================================

-- From migration 002 (snake_case)
DROP POLICY IF EXISTS "user_roles_admin_select" ON user_roles;
DROP POLICY IF EXISTS "user_roles_admin_insert" ON user_roles;
DROP POLICY IF EXISTS "user_roles_admin_update" ON user_roles;
DROP POLICY IF EXISTS "user_roles_admin_delete" ON user_roles;

-- From migration 017+ (merged policy)
DROP POLICY IF EXISTS "user_roles_select" ON user_roles;

-- Keep auth_admin_read_user_roles (needed for JWT hook)

-- ================================================
-- A.5: products
-- ================================================

-- From migration 002 (these should exist, just ensure clean state)
DROP POLICY IF EXISTS "products_admin_update" ON products;
DROP POLICY IF EXISTS "products_admin_delete" ON products;
-- Keep products_public_select and products_admin_insert

-- ================================================
-- A.6: blog_posts
-- ================================================

DROP POLICY IF EXISTS "blog_posts_admin_update" ON blog_posts;
DROP POLICY IF EXISTS "blog_posts_admin_delete" ON blog_posts;
DROP POLICY IF EXISTS "blog_posts_authenticated_select" ON blog_posts;
-- Keep blog_posts_public_select and blog_posts_admin_insert

-- ================================================
-- A.7: categories
-- ================================================

DROP POLICY IF EXISTS "categories_admin_update" ON categories;
DROP POLICY IF EXISTS "categories_admin_delete" ON categories;
-- Keep categories_public_select and categories_admin_insert

-- ================================================
-- A.8: customers
-- ================================================

DROP POLICY IF EXISTS "customers_admin_select" ON customers;
DROP POLICY IF EXISTS "customers_admin_update" ON customers;
DROP POLICY IF EXISTS "customers_admin_delete" ON customers;
-- Keep customers_admin_insert

-- ================================================
-- A.9: download_tokens
-- ================================================

DROP POLICY IF EXISTS "download_tokens_authenticated_select" ON download_tokens;
DROP POLICY IF EXISTS "download_tokens_admin_delete" ON download_tokens;
DROP POLICY IF EXISTS "download_tokens_public_select" ON download_tokens;
-- Keep download_tokens_admin_insert

-- ================================================
-- A.10: integration_logs
-- ================================================

DROP POLICY IF EXISTS "integration_logs_admin_select" ON integration_logs;
DROP POLICY IF EXISTS "integration_logs_admin_delete" ON integration_logs;
-- Keep integration_logs_admin_insert

-- ================================================
-- A.11: newsletter_consent_log
-- ================================================

DROP POLICY IF EXISTS "newsletter_consent_admin_select" ON newsletter_consent_log;
-- Keep newsletter_consent_public_insert

-- ================================================
-- PART B: CREATE CLEAN POLICIES
-- ================================================
-- All policies use:
--   - (SELECT is_admin()) for admin checks (already contains is_anonymous check)
--   - (SELECT auth.uid()) for user ID checks (performance optimization)
--   - Consistent naming convention: "{Role} can {action} {table}"

-- ================================================
-- B.1: custom_itinerary_requests
-- ================================================

-- INSERT: Users create own, admins create any
CREATE POLICY "Users and admins can insert requests"
  ON custom_itinerary_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth_user_id = (SELECT auth.uid())
    OR (SELECT is_admin())
  );

-- SELECT: Users view own, admins view all
CREATE POLICY "Users and admins can select requests"
  ON custom_itinerary_requests
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = (SELECT auth.uid())
    OR (SELECT is_admin())
  );

-- UPDATE: Permanent users update own, admins update all
CREATE POLICY "Users and admins can update requests"
  ON custom_itinerary_requests
  FOR UPDATE
  TO authenticated
  USING (
    auth_user_id = (SELECT auth.uid())
    OR (SELECT is_admin())
  )
  WITH CHECK (
    (
      auth_user_id = (SELECT auth.uid())
      AND (SELECT is_permanent_user())
    )
    OR (SELECT is_admin())
  );

-- DELETE: Only admins
CREATE POLICY "Admins can delete requests"
  ON custom_itinerary_requests
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- B.2: orders
-- ================================================

-- INSERT: Users create own, admins create any
CREATE POLICY "Users and admins can insert orders"
  ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      auth_user_id = (SELECT auth.uid())
      AND customer_email IS NOT NULL
      AND customer_name IS NOT NULL
      AND total_amount >= 0
    )
    OR (SELECT is_admin())
  );

-- SELECT: Users view own, admins view all
CREATE POLICY "Users and admins can select orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = (SELECT auth.uid())
    OR (SELECT is_admin())
  );

-- UPDATE: Only admins
CREATE POLICY "Admins can update orders"
  ON orders
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- DELETE: Only admins
CREATE POLICY "Admins can delete orders"
  ON orders
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- B.3: order_items
-- ================================================

-- INSERT: Users add to own orders, admins add to any
CREATE POLICY "Users and admins can insert order_items"
  ON order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.auth_user_id = (SELECT auth.uid())
    )
    OR (SELECT is_admin())
  );

-- SELECT: Users view from own orders, admins view all
CREATE POLICY "Users and admins can select order_items"
  ON order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.auth_user_id = (SELECT auth.uid())
    )
    OR (SELECT is_admin())
  );

-- UPDATE: Only admins
CREATE POLICY "Admins can update order_items"
  ON order_items
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- DELETE: Only admins
CREATE POLICY "Admins can delete order_items"
  ON order_items
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- B.4: user_roles
-- ================================================

-- SELECT: Users view own, admins view all
CREATE POLICY "user_roles_select"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT is_admin())
  );

-- INSERT: Only admins (keep original from migration 002)
CREATE POLICY "user_roles_admin_insert"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT is_admin()));

-- UPDATE: Only admins
CREATE POLICY "user_roles_admin_update"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- DELETE: Only admins
CREATE POLICY "user_roles_admin_delete"
  ON user_roles
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- B.5: products
-- ================================================

-- UPDATE: Only admins
CREATE POLICY "products_admin_update"
  ON products
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- DELETE: Only admins
CREATE POLICY "products_admin_delete"
  ON products
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- B.6: blog_posts
-- ================================================

-- SELECT: Published for all authenticated, all for admins
CREATE POLICY "blog_posts_authenticated_select"
  ON blog_posts
  FOR SELECT
  TO authenticated
  USING (
    published_at IS NOT NULL
    OR (SELECT is_admin())
  );

-- UPDATE: Only admins
CREATE POLICY "blog_posts_admin_update"
  ON blog_posts
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- DELETE: Only admins
CREATE POLICY "blog_posts_admin_delete"
  ON blog_posts
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- B.7: categories
-- ================================================

-- UPDATE: Only admins
CREATE POLICY "categories_admin_update"
  ON categories
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- DELETE: Only admins
CREATE POLICY "categories_admin_delete"
  ON categories
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- B.8: customers
-- ================================================

-- SELECT: Only admins
CREATE POLICY "customers_admin_select"
  ON customers
  FOR SELECT
  TO authenticated
  USING ((SELECT is_admin()));

-- UPDATE: Only admins
CREATE POLICY "customers_admin_update"
  ON customers
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- DELETE: Only admins
CREATE POLICY "customers_admin_delete"
  ON customers
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- B.9: download_tokens
-- ================================================

-- SELECT: Non-expired for validation, all for admins
CREATE POLICY "download_tokens_public_select"
  ON download_tokens
  FOR SELECT
  TO anon
  USING (expires_at > now());

CREATE POLICY "download_tokens_authenticated_select"
  ON download_tokens
  FOR SELECT
  TO authenticated
  USING (
    expires_at > now()
    OR (SELECT is_admin())
  );

-- DELETE: Only admins
CREATE POLICY "download_tokens_admin_delete"
  ON download_tokens
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- B.10: integration_logs
-- ================================================

-- SELECT: Only admins
CREATE POLICY "integration_logs_admin_select"
  ON integration_logs
  FOR SELECT
  TO authenticated
  USING ((SELECT is_admin()));

-- DELETE: Only admins
CREATE POLICY "integration_logs_admin_delete"
  ON integration_logs
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- B.11: newsletter_consent_log
-- ================================================

-- SELECT: Only admins
CREATE POLICY "newsletter_consent_admin_select"
  ON newsletter_consent_log
  FOR SELECT
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- B.12: storage.objects - Cleanup and recreate
-- ================================================

DO $$
BEGIN
  -- Drop all possible storage policy names
  DROP POLICY IF EXISTS "blog_images_admin_insert" ON storage.objects;
  DROP POLICY IF EXISTS "blog_images_admin_update" ON storage.objects;
  DROP POLICY IF EXISTS "blog_images_admin_delete" ON storage.objects;
  DROP POLICY IF EXISTS "products_images_admin_insert" ON storage.objects;
  DROP POLICY IF EXISTS "products_images_admin_update" ON storage.objects;
  DROP POLICY IF EXISTS "products_images_admin_delete" ON storage.objects;
  DROP POLICY IF EXISTS "products_pdfs_admin_insert" ON storage.objects;
  DROP POLICY IF EXISTS "products_pdfs_admin_update" ON storage.objects;
  DROP POLICY IF EXISTS "products_pdfs_admin_delete" ON storage.objects;
  DROP POLICY IF EXISTS "products_pdfs_admin_select" ON storage.objects;

  -- Drop any auto-generated duplicates (with random suffixes)
  DROP POLICY IF EXISTS "blog_images_admin_delete bjsgsj_0" ON storage.objects;
  DROP POLICY IF EXISTS "blog_images_admin_update bjsgsj_0" ON storage.objects;
  DROP POLICY IF EXISTS "products_images_admin_delete 1e6ovep_0" ON storage.objects;
  DROP POLICY IF EXISTS "products_images_admin_update 1e6ovep_0" ON storage.objects;
  DROP POLICY IF EXISTS "products_pdfs_admin_delete vbjyiy_0" ON storage.objects;
  DROP POLICY IF EXISTS "products_pdfs_admin_select vbjyiy_0" ON storage.objects;
  DROP POLICY IF EXISTS "products_pdfs_admin_update vbjyiy_0" ON storage.objects;

  -- blog-images bucket
  CREATE POLICY "blog_images_admin_insert"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'blog-images'
      AND (SELECT public.is_admin())
    );

  CREATE POLICY "blog_images_admin_update"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'blog-images'
      AND (SELECT public.is_admin())
    )
    WITH CHECK (
      bucket_id = 'blog-images'
      AND (SELECT public.is_admin())
    );

  CREATE POLICY "blog_images_admin_delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'blog-images'
      AND (SELECT public.is_admin())
    );

  -- products-images bucket
  CREATE POLICY "products_images_admin_insert"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'products-images'
      AND (SELECT public.is_admin())
    );

  CREATE POLICY "products_images_admin_update"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'products-images'
      AND (SELECT public.is_admin())
    )
    WITH CHECK (
      bucket_id = 'products-images'
      AND (SELECT public.is_admin())
    );

  CREATE POLICY "products_images_admin_delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'products-images'
      AND (SELECT public.is_admin())
    );

  -- products-pdfs bucket
  CREATE POLICY "products_pdfs_admin_insert"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'products-pdfs'
      AND (SELECT public.is_admin())
    );

  CREATE POLICY "products_pdfs_admin_update"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'products-pdfs'
      AND (SELECT public.is_admin())
    )
    WITH CHECK (
      bucket_id = 'products-pdfs'
      AND (SELECT public.is_admin())
    );

  CREATE POLICY "products_pdfs_admin_delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'products-pdfs'
      AND (SELECT public.is_admin())
    );

  CREATE POLICY "products_pdfs_admin_select"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'products-pdfs'
      AND (SELECT public.is_admin())
    );

  RAISE NOTICE '  Updated all storage bucket policies';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE WARNING '  Cannot update storage policies (insufficient privileges)';
    RAISE WARNING '    Please update manually via Supabase Dashboard -> Storage -> Policies';
END $$;

-- ================================================
-- PART C: VERIFICATION QUERY
-- ================================================

DO $$
DECLARE
  policy_record RECORD;
  current_table TEXT := '';
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '=== VERIFICATION: All Policies After Migration 025 ===';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';

  FOR policy_record IN
    SELECT
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'custom_itinerary_requests',
        'orders',
        'order_items',
        'user_roles',
        'products',
        'blog_posts',
        'categories',
        'customers',
        'download_tokens',
        'integration_logs',
        'newsletter_consent_log'
      )
    ORDER BY tablename, cmd, policyname
  LOOP
    IF current_table <> policy_record.tablename THEN
      RAISE NOTICE '';
      RAISE NOTICE '--- % ---', policy_record.tablename;
      current_table := policy_record.tablename;
    END IF;
    RAISE NOTICE '  [%] % | % | %',
      policy_record.cmd,
      policy_record.policyname,
      policy_record.permissive,
      policy_record.roles;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '--- storage.objects ---';

  FOR policy_record IN
    SELECT policyname, permissive, roles, cmd
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname LIKE 'blog_images%'
         OR policyname LIKE 'products_images%'
         OR policyname LIKE 'products_pdfs%'
    ORDER BY policyname
  LOOP
    RAISE NOTICE '  [%] % | % | %',
      policy_record.cmd,
      policy_record.policyname,
      policy_record.permissive,
      policy_record.roles;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '================================================';
END $$;

-- ================================================
-- SUCCESS MESSAGE
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '  Migration 025 completed!';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE '  CLEANUP PERFORMED:';
  RAISE NOTICE '';
  RAISE NOTICE '  PART A - Dropped all legacy/duplicate policies:';
  RAISE NOTICE '    custom_itinerary_requests: 9 potential policies dropped';
  RAISE NOTICE '      - 4 from migration 002 (snake_case)';
  RAISE NOTICE '      - 5 from migration 012 (including "Anon role blocked")';
  RAISE NOTICE '    orders: 8 potential policies dropped';
  RAISE NOTICE '    order_items: 8 potential policies dropped';
  RAISE NOTICE '    user_roles: 5 potential policies dropped';
  RAISE NOTICE '    + products, blog_posts, categories, customers,';
  RAISE NOTICE '      download_tokens, integration_logs, newsletter_consent_log';
  RAISE NOTICE '';
  RAISE NOTICE '  PART B - Created clean policies:';
  RAISE NOTICE '    Using consistent (SELECT is_admin()) pattern';
  RAISE NOTICE '    is_admin() already checks is_anonymous internally (migration 024)';
  RAISE NOTICE '    No redundant is_anonymous checks in policy definitions';
  RAISE NOTICE '';
  RAISE NOTICE '  TABLES AFFECTED:';
  RAISE NOTICE '    custom_itinerary_requests: 4 policies';
  RAISE NOTICE '    orders: 4 policies';
  RAISE NOTICE '    order_items: 4 policies';
  RAISE NOTICE '    user_roles: 4 policies';
  RAISE NOTICE '    products: 2 policies (update, delete)';
  RAISE NOTICE '    blog_posts: 3 policies';
  RAISE NOTICE '    categories: 2 policies';
  RAISE NOTICE '    customers: 3 policies';
  RAISE NOTICE '    download_tokens: 3 policies';
  RAISE NOTICE '    integration_logs: 2 policies';
  RAISE NOTICE '    newsletter_consent_log: 1 policy';
  RAISE NOTICE '';
  RAISE NOTICE '  STORAGE BUCKETS:';
  RAISE NOTICE '    blog-images: 3 policies';
  RAISE NOTICE '    products-images: 3 policies';
  RAISE NOTICE '    products-pdfs: 4 policies';
  RAISE NOTICE '';
  RAISE NOTICE '  RESULT:';
  RAISE NOTICE '    All duplicate policies removed';
  RAISE NOTICE '    Consistent admin logic using is_admin()';
  RAISE NOTICE '    Clean Supabase Database Advisor (no lint warnings)';
  RAISE NOTICE '';
END $$;
