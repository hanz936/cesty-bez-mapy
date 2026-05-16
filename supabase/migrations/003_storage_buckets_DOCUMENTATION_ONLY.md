-- ⚠️⚠️⚠️ WARNING: DOCUMENTATION ONLY - CANNOT BE RUN VIA SQL EDITOR ⚠️⚠️⚠️
--
-- This file documents Storage bucket configuration that was created manually
-- via Supabase Dashboard due to PostgreSQL permission restrictions.
--
-- WHY THIS FILE EXISTS:
-- - Documents exact Storage bucket configuration (names, limits, MIME types)
-- - Documents all RLS policies for storage.objects table
-- - Serves as blueprint for replicating setup in other environments
--
-- WHY IT CANNOT BE RUN:
-- - Error: "must be owner of table objects"
-- - storage.objects is a system table owned by supabase_storage_admin
-- - Storage buckets and policies must be created via Dashboard UI
--
-- HOW TO USE THIS FILE:
-- 1. Read the configuration below
-- 2. Create buckets manually: Dashboard → Storage → New bucket
-- 3. Create policies manually: Dashboard → Storage → Policies → New Policy
--
-- CREATED: 2025-11-09 (via Dashboard, documented here)
-- STATUS: Already implemented in production
-- ================================================

-- ================================================
-- CESTY BEZ MAPY - Storage Buckets with RLS
-- ================================================
-- Created: 2025-11-09
-- Description: Storage buckets for products and blog content
-- Buckets: products-pdfs (private), products-images (public), blog-images (public)
-- Security: Admin-only uploads, token-based PDF downloads, public image access
-- ================================================

-- ================================================
-- BUCKET: products-pdfs (PRIVATE)
-- Description: PDF travel guides for secure delivery
-- Access: Admin upload/delete, token-based download via signed URLs
-- ================================================

-- Delete existing bucket if exists (idempotent)
DELETE FROM storage.buckets WHERE id = 'products-pdfs';

-- Create private bucket for PDF files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'products-pdfs',
  'products-pdfs',
  false,  -- PRIVATE bucket - requires authentication or signed URLs
  209715200,  -- 200MB limit (PRO tier - dostatečný headroom pro velké itineráře)
  ARRAY['application/pdf']
);

-- Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for products-pdfs (idempotent)
DROP POLICY IF EXISTS "products_pdfs_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "products_pdfs_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "products_pdfs_admin_delete" ON storage.objects;
DROP POLICY IF EXISTS "products_pdfs_admin_select" ON storage.objects;

-- Policy: Only admins can upload PDFs
CREATE POLICY "products_pdfs_admin_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'products-pdfs'
    AND (SELECT is_admin())
  );

-- Policy: Only admins can update PDFs (overwrite files)
CREATE POLICY "products_pdfs_admin_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'products-pdfs'
    AND (SELECT is_admin())
  )
  WITH CHECK (
    bucket_id = 'products-pdfs'
    AND (SELECT is_admin())
  );

-- Policy: Only admins can delete PDFs
CREATE POLICY "products_pdfs_admin_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'products-pdfs'
    AND (SELECT is_admin())
  );

-- Policy: Only admins can list/view PDF metadata
-- NOTE: Actual downloads for customers will use signed URLs created by Edge Functions
CREATE POLICY "products_pdfs_admin_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'products-pdfs'
    AND (SELECT is_admin())
  );

COMMENT ON POLICY "products_pdfs_admin_insert" ON storage.objects IS 'Only admins can upload PDFs to products-pdfs bucket';
COMMENT ON POLICY "products_pdfs_admin_select" ON storage.objects IS 'Only admins can view PDF metadata. Customers download via signed URLs from Edge Functions.';

-- ================================================
-- BUCKET: products-images (PUBLIC)
-- Description: Product cover images and screenshots
-- Access: Admin upload/delete, public read
-- ================================================

-- Delete existing bucket if exists (idempotent)
DELETE FROM storage.buckets WHERE id = 'products-images';

-- Create public bucket for product images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'products-images',
  'products-images',
  true,  -- PUBLIC bucket - anyone can read/download
  10485760,  -- 10MB limit (dostatečné i pro 4K high-quality fotky)
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
);

-- Drop existing policies for products-images (idempotent)
DROP POLICY IF EXISTS "products_images_public_select" ON storage.objects;
DROP POLICY IF EXISTS "products_images_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "products_images_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "products_images_admin_delete" ON storage.objects;

-- NOTE: No SELECT policy needed - public bucket bypasses access controls for read operations

-- Policy: Only admins can upload product images
CREATE POLICY "products_images_admin_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'products-images'
    AND (SELECT is_admin())
  );

-- Policy: Only admins can update product images
CREATE POLICY "products_images_admin_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'products-images'
    AND (SELECT is_admin())
  )
  WITH CHECK (
    bucket_id = 'products-images'
    AND (SELECT is_admin())
  );

-- Policy: Only admins can delete product images
CREATE POLICY "products_images_admin_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'products-images'
    AND (SELECT is_admin())
  );

COMMENT ON POLICY "products_images_admin_insert" ON storage.objects IS 'Only admins can upload product images';

-- ================================================
-- BUCKET: blog-images (PUBLIC)
-- Description: Blog article images and featured images
-- Access: Admin upload/delete, public read
-- ================================================

-- Delete existing bucket if exists (idempotent)
DELETE FROM storage.buckets WHERE id = 'blog-images';

-- Create public bucket for blog images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'blog-images',
  'blog-images',
  true,  -- PUBLIC bucket - anyone can read/download
  10485760,  -- 10MB limit (dostatečné pro blog fotky a hero images)
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
);

-- Drop existing policies for blog-images (idempotent)
DROP POLICY IF EXISTS "blog_images_public_select" ON storage.objects;
DROP POLICY IF EXISTS "blog_images_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "blog_images_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "blog_images_admin_delete" ON storage.objects;

-- NOTE: No SELECT policy needed - public bucket bypasses access controls for read operations

-- Policy: Only admins can upload blog images
CREATE POLICY "blog_images_admin_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'blog-images'
    AND (SELECT is_admin())
  );

-- Policy: Only admins can update blog images
CREATE POLICY "blog_images_admin_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'blog-images'
    AND (SELECT is_admin())
  )
  WITH CHECK (
    bucket_id = 'blog-images'
    AND (SELECT is_admin())
  );

-- Policy: Only admins can delete blog images
CREATE POLICY "blog_images_admin_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'blog-images'
    AND (SELECT is_admin())
  );

COMMENT ON POLICY "blog_images_admin_insert" ON storage.objects IS 'Only admins can upload blog images';

-- ================================================
-- SUCCESS MESSAGE
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Storage buckets created successfully!';
  RAISE NOTICE '🗂️  Created 3 buckets with RLS policies:';
  RAISE NOTICE '';
  RAISE NOTICE '📦 products-pdfs (PRIVATE):';
  RAISE NOTICE '   - Admin-only upload/delete/view';
  RAISE NOTICE '   - Customer downloads via signed URLs (FÁZE 3)';
  RAISE NOTICE '   - File limit: 200MB';
  RAISE NOTICE '   - MIME types: application/pdf';
  RAISE NOTICE '';
  RAISE NOTICE '🖼️  products-images (PUBLIC):';
  RAISE NOTICE '   - Admin upload/delete';
  RAISE NOTICE '   - Public read access (no SELECT policy needed)';
  RAISE NOTICE '   - File limit: 10MB';
  RAISE NOTICE '   - MIME types: image/jpeg, image/png, image/webp';
  RAISE NOTICE '';
  RAISE NOTICE '📸 blog-images (PUBLIC):';
  RAISE NOTICE '   - Admin upload/delete';
  RAISE NOTICE '   - Public read access (no SELECT policy needed)';
  RAISE NOTICE '   - File limit: 10MB';
  RAISE NOTICE '   - MIME types: image/jpeg, image/png, image/webp';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Security:';
  RAISE NOTICE '   - All uploads restricted to admins (is_admin())';
  RAISE NOTICE '   - Private bucket for PDFs (token-based downloads)';
  RAISE NOTICE '   - Public buckets for images (SEO-friendly URLs)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  NEXT STEPS:';
  RAISE NOTICE '1. Test admin upload to each bucket via Supabase Dashboard';
  RAISE NOTICE '2. Verify public access to products-images and blog-images';
  RAISE NOTICE '3. Test that products-pdfs requires authentication';
  RAISE NOTICE '4. Create first admin user and test JWT claims';
END $$;
