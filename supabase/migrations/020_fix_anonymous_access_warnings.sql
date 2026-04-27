-- ================================================
-- Migration 020: Fix Anonymous Access Warnings
-- ================================================
-- Created: 2026-01-19
-- Description: Remove Supabase Database Advisor warnings about anonymous access
--              by adding explicit is_anonymous check to admin authorization
-- ================================================
-- ISSUE: Supabase Advisor reports "auth_allow_anonymous_sign_ins" warnings
--        because admin policies use TO authenticated (which includes anonymous)
--        Even though is_admin() already blocks anonymous users, the linter
--        doesn't analyze USING clause logic - it only checks target roles
-- ================================================
-- SOLUTION: Update is_admin() helper to explicitly check NOT is_anonymous
--           This is redundant security-wise but satisfies the linter
--           All existing policies automatically use the updated function
-- ================================================
-- BENEFIT: Clean Supabase Dashboard for non-technical administrators
--          No confusing warnings = peace of mind
-- ================================================

-- ================================================
-- PART 1: Update is_admin() Helper Function
-- ================================================
-- This single change fixes ALL public.* table policies automatically
-- because they all use (SELECT is_admin()) in their USING clauses

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    -- Must have is_admin = true in JWT (from custom_access_token_hook)
    -- COALESCE: if null/missing, treat as false (not admin) = fail closed
    COALESCE((auth.jwt()->>'is_admin')::boolean, false)
    AND
    -- Must NOT be an anonymous user (explicit check for Supabase Advisor)
    -- IS FALSE: if null/missing, returns false (deny access) = fail closed
    -- This follows Supabase docs pattern for anonymous access control
    (auth.jwt()->>'is_anonymous')::boolean IS FALSE;
$$;

COMMENT ON FUNCTION is_admin() IS
  'Checks if current user is admin AND not anonymous. Uses "fail closed" pattern - unknown/null values deny access. Reads from JWT (fast, no DB query). Updated in migration 020.';

-- ================================================
-- PART 2: Update Storage Policies
-- ================================================
-- Storage policies were created via Dashboard (migration 003 is documentation only)
-- They use inline is_admin() check, so we need to recreate them
--
-- NOTE: If this fails with "must be owner of table objects",
--       you must update these policies manually via Supabase Dashboard:
--       Storage → Policies → Edit each policy → Add: AND NOT (auth.jwt()->>'is_anonymous')::boolean

-- ================================================
-- PART 2A: Blog Images Bucket Policies
-- ================================================
-- NOTE: Using public.is_admin() with full schema qualification
--       to ensure correct resolution in storage schema context

DO $$
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "blog_images_admin_insert" ON storage.objects;
  DROP POLICY IF EXISTS "blog_images_admin_update" ON storage.objects;
  DROP POLICY IF EXISTS "blog_images_admin_delete" ON storage.objects;

  -- Recreate with explicit anonymous check
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

-- ================================================
-- PART 2B: Products Images Bucket Policies
-- ================================================

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

-- ================================================
-- PART 2C: Products PDFs Bucket Policies
-- ================================================

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
  RAISE NOTICE '✅ Migration 020 completed!';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 CHANGES MADE:';
  RAISE NOTICE '   1. Updated is_admin() function to check NOT is_anonymous';
  RAISE NOTICE '   2. Recreated storage.objects policies using public.is_admin()';
  RAISE NOTICE '';
  RAISE NOTICE '📋 TABLES AUTOMATICALLY FIXED (via is_admin() update):';
  RAISE NOTICE '   ✅ blog_posts';
  RAISE NOTICE '   ✅ categories';
  RAISE NOTICE '   ✅ customers';
  RAISE NOTICE '   ✅ products';
  RAISE NOTICE '   ✅ orders';
  RAISE NOTICE '   ✅ order_items';
  RAISE NOTICE '   ✅ custom_itinerary_requests';
  RAISE NOTICE '   ✅ download_tokens';
  RAISE NOTICE '   ✅ integration_logs';
  RAISE NOTICE '   ✅ newsletter_consent_log';
  RAISE NOTICE '   ✅ user_roles';
  RAISE NOTICE '   ✅ product_categories';
  RAISE NOTICE '';
  RAISE NOTICE '🗂️  STORAGE BUCKETS:';
  RAISE NOTICE '   ✅ blog-images (or manual update required)';
  RAISE NOTICE '   ✅ products-images (or manual update required)';
  RAISE NOTICE '   ✅ products-pdfs (or manual update required)';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 RESULT:';
  RAISE NOTICE '   All "auth_allow_anonymous_sign_ins" warnings should be resolved';
  RAISE NOTICE '   Supabase Database Advisor should show clean status';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IF STORAGE WARNINGS PERSIST:';
  RAISE NOTICE '   Update policies manually via Supabase Dashboard:';
  RAISE NOTICE '   Storage → Select bucket → Policies → Edit each policy';
  RAISE NOTICE '   Add to WITH CHECK/USING: AND NOT (auth.jwt()->>''is_anonymous'')::boolean';
  RAISE NOTICE '';
END $$;
