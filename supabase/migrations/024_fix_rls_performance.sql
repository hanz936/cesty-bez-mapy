-- ================================================
-- Migration 024: Fix RLS Performance (auth_rls_initplan)
-- ================================================
-- Created: 2026-01-22
-- Description: Fix Supabase Database Advisor warnings about auth.jwt() being
--              re-evaluated for each row instead of once per query.
-- ================================================
-- ISSUE: Supabase lint 0003 (auth_rls_initplan) reports 27 warnings because:
--        1. is_admin() function calls auth.jwt() twice without caching
--        2. Migration 022 added redundant (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
--           checks alongside (SELECT is_admin()), causing additional auth.jwt() calls
-- ================================================
-- SOLUTION:
--        1. Rewrite is_admin() as PL/pgSQL function that caches JWT into a variable
--        2. Remove redundant is_anonymous checks from all policies (is_admin() already checks it)
-- ================================================
-- REFERENCE: https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan
--            https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- ================================================

-- ================================================
-- PART 1: Fix is_admin() Function with JWT Caching
-- ================================================
-- Before: auth.jwt() was called twice (once for is_admin, once for is_anonymous)
-- After: auth.jwt() is called once and cached into a variable

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  jwt_data jsonb;
BEGIN
  -- Cache JWT data in a variable - called only once per query
  jwt_data := (SELECT auth.jwt());

  -- Check both conditions using the cached JWT
  RETURN
    -- Must have is_admin = true in JWT (from custom_access_token_hook)
    -- COALESCE: if null/missing, treat as false (not admin) = fail closed
    COALESCE((jwt_data->>'is_admin')::boolean, false)
    AND
    -- Must NOT be an anonymous user
    -- IS FALSE: if null/missing, returns false (deny access) = fail closed
    (jwt_data->>'is_anonymous')::boolean IS FALSE;
END;
$$;

COMMENT ON FUNCTION is_admin() IS
  'Checks if current user is admin AND not anonymous. Uses PL/pgSQL with cached JWT for performance (single auth.jwt() call per query). Uses "fail closed" pattern - unknown/null values deny access. Updated in migration 024.';

-- ================================================
-- Helper function: is_permanent_user()
-- ================================================
-- Used for policies that need to check if user is NOT anonymous
-- without requiring admin privileges (e.g., allowing permanent users
-- to update their own requests)

CREATE OR REPLACE FUNCTION is_permanent_user()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  jwt_data jsonb;
BEGIN
  -- Cache JWT data in a variable
  jwt_data := (SELECT auth.jwt());

  -- User is permanent (not anonymous) if is_anonymous is not true
  -- IS NOT TRUE handles: false -> true, null -> true, true -> false
  RETURN (jwt_data->>'is_anonymous')::boolean IS NOT TRUE;
END;
$$;

COMMENT ON FUNCTION is_permanent_user() IS
  'Checks if current user is NOT anonymous (i.e., has a permanent account). Uses PL/pgSQL with cached JWT for performance. Updated in migration 024.';

-- ================================================
-- PART 2: products - Remove redundant is_anonymous check
-- ================================================

DROP POLICY IF EXISTS "products_admin_update" ON products;
DROP POLICY IF EXISTS "products_admin_delete" ON products;

CREATE POLICY "products_admin_update"
  ON products
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

CREATE POLICY "products_admin_delete"
  ON products
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- PART 3: blog_posts - Remove redundant is_anonymous check
-- ================================================

DROP POLICY IF EXISTS "blog_posts_admin_update" ON blog_posts;
DROP POLICY IF EXISTS "blog_posts_admin_delete" ON blog_posts;
DROP POLICY IF EXISTS "blog_posts_authenticated_select" ON blog_posts;

CREATE POLICY "blog_posts_admin_update"
  ON blog_posts
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

CREATE POLICY "blog_posts_admin_delete"
  ON blog_posts
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- Mixed policy: authenticated users see published, admins see all (including drafts)
CREATE POLICY "blog_posts_authenticated_select"
  ON blog_posts
  FOR SELECT
  TO authenticated
  USING (
    published_at IS NOT NULL
    OR (SELECT is_admin())
  );

-- ================================================
-- PART 4: categories - Remove redundant is_anonymous check
-- ================================================

DROP POLICY IF EXISTS "categories_admin_update" ON categories;
DROP POLICY IF EXISTS "categories_admin_delete" ON categories;

CREATE POLICY "categories_admin_update"
  ON categories
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

CREATE POLICY "categories_admin_delete"
  ON categories
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- PART 5: customers - Remove redundant is_anonymous check
-- ================================================

DROP POLICY IF EXISTS "customers_admin_select" ON customers;
DROP POLICY IF EXISTS "customers_admin_update" ON customers;
DROP POLICY IF EXISTS "customers_admin_delete" ON customers;

CREATE POLICY "customers_admin_select"
  ON customers
  FOR SELECT
  TO authenticated
  USING ((SELECT is_admin()));

CREATE POLICY "customers_admin_update"
  ON customers
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

CREATE POLICY "customers_admin_delete"
  ON customers
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- PART 6: download_tokens - Remove redundant is_anonymous check
-- ================================================

DROP POLICY IF EXISTS "download_tokens_authenticated_select" ON download_tokens;
DROP POLICY IF EXISTS "download_tokens_admin_delete" ON download_tokens;

-- Mixed policy: anyone can validate non-expired tokens, admins see all
CREATE POLICY "download_tokens_authenticated_select"
  ON download_tokens
  FOR SELECT
  TO authenticated
  USING (
    expires_at > now()
    OR (SELECT is_admin())
  );

CREATE POLICY "download_tokens_admin_delete"
  ON download_tokens
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- PART 7: integration_logs - Remove redundant is_anonymous check
-- ================================================

DROP POLICY IF EXISTS "integration_logs_admin_select" ON integration_logs;
DROP POLICY IF EXISTS "integration_logs_admin_delete" ON integration_logs;

CREATE POLICY "integration_logs_admin_select"
  ON integration_logs
  FOR SELECT
  TO authenticated
  USING ((SELECT is_admin()));

CREATE POLICY "integration_logs_admin_delete"
  ON integration_logs
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- PART 8: newsletter_consent_log - Remove redundant is_anonymous check
-- ================================================

DROP POLICY IF EXISTS "newsletter_consent_admin_select" ON newsletter_consent_log;

CREATE POLICY "newsletter_consent_admin_select"
  ON newsletter_consent_log
  FOR SELECT
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- PART 9: orders - Remove redundant is_anonymous check
-- ================================================

DROP POLICY IF EXISTS "Users and admins can select orders" ON orders;
DROP POLICY IF EXISTS "Admins can update orders" ON orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON orders;

-- Mixed policy: users see own orders, admins see all
CREATE POLICY "Users and admins can select orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = (SELECT auth.uid())
    OR (SELECT is_admin())
  );

CREATE POLICY "Admins can update orders"
  ON orders
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

CREATE POLICY "Admins can delete orders"
  ON orders
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- PART 10: order_items - Remove redundant is_anonymous check
-- ================================================

DROP POLICY IF EXISTS "Users and admins can select order_items" ON order_items;
DROP POLICY IF EXISTS "Admins can update order_items" ON order_items;
DROP POLICY IF EXISTS "Admins can delete order_items" ON order_items;

-- Mixed policy: users see items from own orders, admins see all
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

CREATE POLICY "Admins can update order_items"
  ON order_items
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

CREATE POLICY "Admins can delete order_items"
  ON order_items
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- PART 11: custom_itinerary_requests - Remove redundant is_anonymous check
-- ================================================

DROP POLICY IF EXISTS "Users and admins can select requests" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "Users and admins can update requests" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "Admins can delete requests" ON custom_itinerary_requests;

-- Mixed policy: users see own requests, admins see all
CREATE POLICY "Users and admins can select requests"
  ON custom_itinerary_requests
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = (SELECT auth.uid())
    OR (SELECT is_admin())
  );

-- Mixed policy: permanent users update own, admins update all
-- Note: The WITH CHECK for user's own requests needs is_permanent_user() check
-- because we want to prevent anonymous users from updating their own requests
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

CREATE POLICY "Admins can delete requests"
  ON custom_itinerary_requests
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- PART 12: user_roles - Remove redundant is_anonymous check
-- ================================================

DROP POLICY IF EXISTS "user_roles_select" ON user_roles;
DROP POLICY IF EXISTS "user_roles_admin_update" ON user_roles;
DROP POLICY IF EXISTS "user_roles_admin_delete" ON user_roles;

-- Mixed policy: users see own roles, admins see all
CREATE POLICY "user_roles_select"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT is_admin())
  );

CREATE POLICY "user_roles_admin_update"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

CREATE POLICY "user_roles_admin_delete"
  ON user_roles
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- PART 13: storage.objects - Remove redundant is_anonymous check
-- ================================================

DO $$
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "blog_images_admin_insert" ON storage.objects;
  DROP POLICY IF EXISTS "blog_images_admin_update" ON storage.objects;
  DROP POLICY IF EXISTS "blog_images_admin_delete" ON storage.objects;

  -- Recreate without redundant is_anonymous check (is_admin() already checks it)
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

  RAISE NOTICE '✅ Updated blog-images storage policies';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE WARNING '⚠️  Cannot update blog-images policies (insufficient privileges)';
    RAISE WARNING '    Please update manually via Supabase Dashboard → Storage → Policies';
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "products_images_admin_insert" ON storage.objects;
  DROP POLICY IF EXISTS "products_images_admin_update" ON storage.objects;
  DROP POLICY IF EXISTS "products_images_admin_delete" ON storage.objects;

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

  RAISE NOTICE '✅ Updated products-images storage policies';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE WARNING '⚠️  Cannot update products-images policies (insufficient privileges)';
    RAISE WARNING '    Please update manually via Supabase Dashboard → Storage → Policies';
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "products_pdfs_admin_insert" ON storage.objects;
  DROP POLICY IF EXISTS "products_pdfs_admin_update" ON storage.objects;
  DROP POLICY IF EXISTS "products_pdfs_admin_delete" ON storage.objects;
  DROP POLICY IF EXISTS "products_pdfs_admin_select" ON storage.objects;

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

  RAISE NOTICE '✅ Updated products-pdfs storage policies';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE WARNING '⚠️  Cannot update products-pdfs policies (insufficient privileges)';
    RAISE WARNING '    Please update manually via Supabase Dashboard → Storage → Policies';
END $$;

-- ================================================
-- SUCCESS MESSAGE
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ Migration 024 completed!';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 CHANGES MADE:';
  RAISE NOTICE '   1. Rewrote is_admin() as PL/pgSQL with cached JWT variable';
  RAISE NOTICE '      - auth.jwt() now called only ONCE per query';
  RAISE NOTICE '   2. Added is_permanent_user() helper function';
  RAISE NOTICE '      - For policies needing is_anonymous check without admin requirement';
  RAISE NOTICE '   3. Removed redundant is_anonymous checks from all policies';
  RAISE NOTICE '      - is_admin() already checks is_anonymous internally';
  RAISE NOTICE '      - is_permanent_user() used where non-admin anonymous check needed';
  RAISE NOTICE '';
  RAISE NOTICE '📋 POLICIES UPDATED (27 total):';
  RAISE NOTICE '   ✅ products: admin_update, admin_delete (2)';
  RAISE NOTICE '   ✅ blog_posts: admin_update, admin_delete, authenticated_select (3)';
  RAISE NOTICE '   ✅ categories: admin_update, admin_delete (2)';
  RAISE NOTICE '   ✅ customers: admin_select, admin_update, admin_delete (3)';
  RAISE NOTICE '   ✅ download_tokens: authenticated_select, admin_delete (2)';
  RAISE NOTICE '   ✅ integration_logs: admin_select, admin_delete (2)';
  RAISE NOTICE '   ✅ newsletter_consent_log: admin_select (1)';
  RAISE NOTICE '   ✅ orders: select, update, delete (3)';
  RAISE NOTICE '   ✅ order_items: select, update, delete (3)';
  RAISE NOTICE '   ✅ custom_itinerary_requests: select, update, delete (3)';
  RAISE NOTICE '   ✅ user_roles: select, update, delete (3)';
  RAISE NOTICE '';
  RAISE NOTICE '🗂️  STORAGE BUCKETS:';
  RAISE NOTICE '   ✅ blog-images';
  RAISE NOTICE '   ✅ products-images';
  RAISE NOTICE '   ✅ products-pdfs';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 RESULT:';
  RAISE NOTICE '   All 27 auth_rls_initplan (lint 0003) warnings should be resolved.';
  RAISE NOTICE '   auth.jwt() is now called only once per query (cached in is_admin()).';
  RAISE NOTICE '';
END $$;
