-- ================================================
-- Migration 031: Custom Itinerary Delivery
-- ================================================
-- Created: 2026-04-29
-- Description: Phase 3 of sales workflow audit — adds delivery tooling
--              for "Itinerář na míru" custom requests so admin (Jana)
--              can upload final PDF and generate signed URL to send manually.
-- ================================================

-- ================================================
-- PART 1: Add delivery columns to custom_itinerary_requests
-- ================================================

ALTER TABLE public.custom_itinerary_requests
  ADD COLUMN IF NOT EXISTS final_pdf_url text,
  ADD COLUMN IF NOT EXISTS final_pdf_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

COMMENT ON COLUMN public.custom_itinerary_requests.final_pdf_url IS
  'Cesta k finálnímu PDF v bucketu custom-itinerary-pdfs (NE plná URL — používá se pro tvorbu signed URL).';
COMMENT ON COLUMN public.custom_itinerary_requests.final_pdf_uploaded_at IS
  'Časová značka, kdy admin nahrál finální PDF itinerář.';
COMMENT ON COLUMN public.custom_itinerary_requests.delivered_at IS
  'Časová značka, kdy admin označil itinerář jako doručený zákazníkovi.';

-- ================================================
-- PART 2: Create private storage bucket
-- ================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'custom-itinerary-pdfs',
  'custom-itinerary-pdfs',
  false,
  209715200, -- 200 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ================================================
-- PART 3: RLS policies for custom-itinerary-pdfs bucket
-- ================================================
-- Pattern mirrors products_pdfs_* policies from migration 020.
-- service_role bypasses RLS automatically — frontend reads PDFs via
-- signed URLs created by admin, no anon/authenticated access needed.

DO $$
BEGIN
  DROP POLICY IF EXISTS "custom_itinerary_pdfs_admin_select" ON storage.objects;
  DROP POLICY IF EXISTS "custom_itinerary_pdfs_admin_insert" ON storage.objects;
  DROP POLICY IF EXISTS "custom_itinerary_pdfs_admin_update" ON storage.objects;
  DROP POLICY IF EXISTS "custom_itinerary_pdfs_admin_delete" ON storage.objects;

  CREATE POLICY "custom_itinerary_pdfs_admin_select"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'custom-itinerary-pdfs'
      AND (SELECT public.is_admin())
    );

  CREATE POLICY "custom_itinerary_pdfs_admin_insert"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'custom-itinerary-pdfs'
      AND (SELECT public.is_admin())
    );

  CREATE POLICY "custom_itinerary_pdfs_admin_update"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'custom-itinerary-pdfs'
      AND (SELECT public.is_admin())
    )
    WITH CHECK (
      bucket_id = 'custom-itinerary-pdfs'
      AND (SELECT public.is_admin())
    );

  CREATE POLICY "custom_itinerary_pdfs_admin_delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'custom-itinerary-pdfs'
      AND (SELECT public.is_admin())
    );

  RAISE NOTICE '✅ Created custom-itinerary-pdfs storage policies';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE WARNING '⚠️  Cannot create custom-itinerary-pdfs policies (insufficient privileges)';
    RAISE WARNING '    Please create manually via Supabase Dashboard → Storage → Policies';
END $$;

-- ================================================
-- SUCCESS MESSAGE
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ Migration 031 completed!';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 CHANGES MADE:';
  RAISE NOTICE '   1. Added final_pdf_url, final_pdf_uploaded_at, delivered_at columns';
  RAISE NOTICE '      to custom_itinerary_requests';
  RAISE NOTICE '   2. Created private bucket custom-itinerary-pdfs (200 MB, application/pdf)';
  RAISE NOTICE '   3. Created admin-only RLS policies (select/insert/update/delete)';
  RAISE NOTICE '';
END $$;
