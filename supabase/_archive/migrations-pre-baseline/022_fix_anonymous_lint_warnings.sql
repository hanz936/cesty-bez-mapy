-- ================================================
-- Migration 022: Fix Anonymous Access Lint Warnings
-- ================================================
-- Created: 2026-01-21
-- Description: Add explicit is_anonymous checks to satisfy Supabase Database Advisor
-- ================================================
-- ISSUE: Supabase lint 0012 (auth_allow_anonymous_sign_ins) reports warnings
--        because policies use TO authenticated without explicit is_anonymous check.
--        The linter does NOT analyze function contents (like is_admin()),
--        it only looks for literal (auth.jwt()->>'is_anonymous') in policy definitions.
-- ================================================
-- SOLUTION: Recreate all admin policies with explicit is_anonymous check.
--           This is redundant (is_admin() already checks it) but satisfies the linter.
-- ================================================
-- REFERENCE: https://supabase.com/docs/guides/auth/auth-anonymous#access-control
-- ================================================

-- ================================================
-- PART 1: products
-- ================================================

DROP POLICY IF EXISTS "products_admin_update" ON products;
DROP POLICY IF EXISTS "products_admin_delete" ON products;

CREATE POLICY "products_admin_update"
  ON products
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  )
  WITH CHECK (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  );

CREATE POLICY "products_admin_delete"
  ON products
  FOR DELETE
  TO authenticated
  USING (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  );

-- ================================================
-- PART 2: blog_posts
-- ================================================

DROP POLICY IF EXISTS "blog_posts_admin_update" ON blog_posts;
DROP POLICY IF EXISTS "blog_posts_admin_delete" ON blog_posts;
DROP POLICY IF EXISTS "blog_posts_authenticated_select" ON blog_posts;

CREATE POLICY "blog_posts_admin_update"
  ON blog_posts
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  )
  WITH CHECK (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  );

CREATE POLICY "blog_posts_admin_delete"
  ON blog_posts
  FOR DELETE
  TO authenticated
  USING (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  );

-- Smíšená policy: authenticated users see published, admins see all (including drafts)
CREATE POLICY "blog_posts_authenticated_select"
  ON blog_posts
  FOR SELECT
  TO authenticated
  USING (
    published_at IS NOT NULL  -- anyone can see published posts
    OR (
      (SELECT is_admin())
      AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
    )
  );

-- ================================================
-- PART 3: categories
-- ================================================

DROP POLICY IF EXISTS "categories_admin_update" ON categories;
DROP POLICY IF EXISTS "categories_admin_delete" ON categories;

CREATE POLICY "categories_admin_update"
  ON categories
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  )
  WITH CHECK (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  );

CREATE POLICY "categories_admin_delete"
  ON categories
  FOR DELETE
  TO authenticated
  USING (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  );

-- ================================================
-- PART 4: customers
-- ================================================

DROP POLICY IF EXISTS "customers_admin_select" ON customers;
DROP POLICY IF EXISTS "customers_admin_update" ON customers;
DROP POLICY IF EXISTS "customers_admin_delete" ON customers;

CREATE POLICY "customers_admin_select"
  ON customers
  FOR SELECT
  TO authenticated
  USING (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  );

CREATE POLICY "customers_admin_update"
  ON customers
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  )
  WITH CHECK (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  );

CREATE POLICY "customers_admin_delete"
  ON customers
  FOR DELETE
  TO authenticated
  USING (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  );

-- ================================================
-- PART 5: download_tokens
-- ================================================

DROP POLICY IF EXISTS "download_tokens_authenticated_select" ON download_tokens;
DROP POLICY IF EXISTS "download_tokens_admin_delete" ON download_tokens;

-- Smíšená policy: anyone can validate non-expired tokens, admins see all
CREATE POLICY "download_tokens_authenticated_select"
  ON download_tokens
  FOR SELECT
  TO authenticated
  USING (
    expires_at > now()  -- anyone can validate non-expired tokens
    OR (
      (SELECT is_admin())
      AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
    )
  );

CREATE POLICY "download_tokens_admin_delete"
  ON download_tokens
  FOR DELETE
  TO authenticated
  USING (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  );

-- ================================================
-- PART 6: integration_logs
-- ================================================

DROP POLICY IF EXISTS "integration_logs_admin_select" ON integration_logs;
DROP POLICY IF EXISTS "integration_logs_admin_delete" ON integration_logs;

CREATE POLICY "integration_logs_admin_select"
  ON integration_logs
  FOR SELECT
  TO authenticated
  USING (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  );

CREATE POLICY "integration_logs_admin_delete"
  ON integration_logs
  FOR DELETE
  TO authenticated
  USING (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  );

-- ================================================
-- PART 7: newsletter_consent_log
-- ================================================

DROP POLICY IF EXISTS "newsletter_consent_admin_select" ON newsletter_consent_log;

CREATE POLICY "newsletter_consent_admin_select"
  ON newsletter_consent_log
  FOR SELECT
  TO authenticated
  USING (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  );

-- ================================================
-- PART 8: orders (from migration 019)
-- ================================================

DROP POLICY IF EXISTS "Users and admins can select orders" ON orders;
DROP POLICY IF EXISTS "Admins can update orders" ON orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON orders;

-- Smíšená policy: users see own orders, admins see all
CREATE POLICY "Users and admins can select orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    (auth_user_id = (SELECT auth.uid()))
    OR (
      (SELECT is_admin())
      AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
    )
  );

CREATE POLICY "Admins can update orders"
  ON orders
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  )
  WITH CHECK (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  );

CREATE POLICY "Admins can delete orders"
  ON orders
  FOR DELETE
  TO authenticated
  USING (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  );

-- ================================================
-- PART 9: order_items (from migration 019)
-- ================================================

DROP POLICY IF EXISTS "Users and admins can select order_items" ON order_items;
DROP POLICY IF EXISTS "Admins can update order_items" ON order_items;
DROP POLICY IF EXISTS "Admins can delete order_items" ON order_items;

-- Smíšená policy: users see items from own orders, admins see all
CREATE POLICY "Users and admins can select order_items"
  ON order_items
  FOR SELECT
  TO authenticated
  USING (
    (
      EXISTS (
        SELECT 1 FROM orders
        WHERE orders.id = order_items.order_id
        AND orders.auth_user_id = (SELECT auth.uid())
      )
    )
    OR (
      (SELECT is_admin())
      AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
    )
  );

CREATE POLICY "Admins can update order_items"
  ON order_items
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  )
  WITH CHECK (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  );

CREATE POLICY "Admins can delete order_items"
  ON order_items
  FOR DELETE
  TO authenticated
  USING (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  );

-- ================================================
-- PART 10: custom_itinerary_requests (from migration 016)
-- ================================================

DROP POLICY IF EXISTS "Users and admins can select requests" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "Users and admins can update requests" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "Admins can delete requests" ON custom_itinerary_requests;

-- Smíšená policy: users see own requests, admins see all
CREATE POLICY "Users and admins can select requests"
  ON custom_itinerary_requests
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = (SELECT auth.uid())
    OR (
      (SELECT is_admin())
      AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
    )
  );

-- Smíšená policy: permanent users update own, admins update all
CREATE POLICY "Users and admins can update requests"
  ON custom_itinerary_requests
  FOR UPDATE
  TO authenticated
  USING (
    auth_user_id = (SELECT auth.uid())
    OR (
      (SELECT is_admin())
      AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
    )
  )
  WITH CHECK (
    (
      auth_user_id = (SELECT auth.uid())
      AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS NOT TRUE
    )
    OR (
      (SELECT is_admin())
      AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
    )
  );

CREATE POLICY "Admins can delete requests"
  ON custom_itinerary_requests
  FOR DELETE
  TO authenticated
  USING (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  );

-- ================================================
-- PART 11: user_roles
-- ================================================

DROP POLICY IF EXISTS "user_roles_select" ON user_roles;
DROP POLICY IF EXISTS "user_roles_admin_update" ON user_roles;
DROP POLICY IF EXISTS "user_roles_admin_delete" ON user_roles;

-- Smíšená policy: users see own roles, admins see all
CREATE POLICY "user_roles_select"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (
      (SELECT is_admin())
      AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
    )
  );

CREATE POLICY "user_roles_admin_update"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  )
  WITH CHECK (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  );

CREATE POLICY "user_roles_admin_delete"
  ON user_roles
  FOR DELETE
  TO authenticated
  USING (
    (SELECT is_admin())
    AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  );

-- ================================================
-- PART 12: storage.objects (update policies from migration 020)
-- ================================================

DO $$
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "blog_images_admin_insert" ON storage.objects;
  DROP POLICY IF EXISTS "blog_images_admin_update" ON storage.objects;
  DROP POLICY IF EXISTS "blog_images_admin_delete" ON storage.objects;

  -- Recreate with explicit anonymous check in policy definition
  CREATE POLICY "blog_images_admin_insert"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'blog-images'
      AND (SELECT public.is_admin())
      AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
    );

  CREATE POLICY "blog_images_admin_update"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'blog-images'
      AND (SELECT public.is_admin())
      AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
    )
    WITH CHECK (
      bucket_id = 'blog-images'
      AND (SELECT public.is_admin())
      AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
    );

  CREATE POLICY "blog_images_admin_delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'blog-images'
      AND (SELECT public.is_admin())
      AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
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
      AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
    );

  CREATE POLICY "products_images_admin_update"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'products-images'
      AND (SELECT public.is_admin())
      AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
    )
    WITH CHECK (
      bucket_id = 'products-images'
      AND (SELECT public.is_admin())
      AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
    );

  CREATE POLICY "products_images_admin_delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'products-images'
      AND (SELECT public.is_admin())
      AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
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
      AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
    );

  CREATE POLICY "products_pdfs_admin_update"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'products-pdfs'
      AND (SELECT public.is_admin())
      AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
    )
    WITH CHECK (
      bucket_id = 'products-pdfs'
      AND (SELECT public.is_admin())
      AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
    );

  CREATE POLICY "products_pdfs_admin_delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'products-pdfs'
      AND (SELECT public.is_admin())
      AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
    );

  CREATE POLICY "products_pdfs_admin_select"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'products-pdfs'
      AND (SELECT public.is_admin())
      AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
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
  RAISE NOTICE '✅ Migration 022 completed!';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 CHANGES MADE:';
  RAISE NOTICE '   Added explicit (auth.jwt()->>''is_anonymous'')::boolean IS FALSE';
  RAISE NOTICE '   to all admin policies so Supabase linter can see the check.';
  RAISE NOTICE '';
  RAISE NOTICE '📋 TABLES UPDATED:';
  RAISE NOTICE '   ✅ products (admin_update, admin_delete)';
  RAISE NOTICE '   ✅ blog_posts (admin_update, admin_delete, authenticated_select)';
  RAISE NOTICE '   ✅ categories (admin_update, admin_delete)';
  RAISE NOTICE '   ✅ customers (admin_select, admin_update, admin_delete)';
  RAISE NOTICE '   ✅ download_tokens (authenticated_select, admin_delete)';
  RAISE NOTICE '   ✅ integration_logs (admin_select, admin_delete)';
  RAISE NOTICE '   ✅ newsletter_consent_log (admin_select)';
  RAISE NOTICE '   ✅ orders (select, update, delete)';
  RAISE NOTICE '   ✅ order_items (select, update, delete)';
  RAISE NOTICE '   ✅ custom_itinerary_requests (select, update, delete)';
  RAISE NOTICE '   ✅ user_roles (select, update, delete)';
  RAISE NOTICE '';
  RAISE NOTICE '🗂️  STORAGE BUCKETS:';
  RAISE NOTICE '   ✅ blog-images';
  RAISE NOTICE '   ✅ products-images';
  RAISE NOTICE '   ✅ products-pdfs';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 RESULT:';
  RAISE NOTICE '   All "auth_allow_anonymous_sign_ins" warnings should be resolved.';
  RAISE NOTICE '   Supabase Database Advisor lint 0012 should pass.';
  RAISE NOTICE '';
  RAISE NOTICE '📝 NOTE:';
  RAISE NOTICE '   The is_admin() function already checks is_anonymous internally.';
  RAISE NOTICE '   This explicit check is redundant but required for the linter.';
  RAISE NOTICE '';
END $$;
