-- ============================================================================
-- 046_storage_admin_select_public_image_buckets.sql
-- Fix: admin SELECT policy pro veřejné image buckety (blog-images, products-images)
-- ----------------------------------------------------------------------------
-- Veřejné buckety se čtou mimo RLS (public path), takže SELECT policy pro roli
-- `authenticated` dosud chyběla a nevadila. Jenže storage API `.remove()` (a list)
-- napřed objekt SELECTne pod rolí `authenticated` — bez SELECT policy vidí 0 řádků
-- → smaže 0 → vrátí []. Důsledek: admin přes aplikaci NEDOKÁŽE mazat ani vyměňovat
-- blog/produktové obrázky (staré soubory se hromadí jako orphany).
--
-- Privátní PDF buckety (products-pdfs, custom-itinerary-pdfs) SELECT policy mají,
-- proto u nich mazání funguje. Doplňujeme ji i pro dva veřejné image buckety.
-- Žádná nová expozice — soubory jsou už veřejně čitelné; policy jen umožní
-- adminovi (is_admin()) řádky vidět, a tím je mazat/vyměňovat.
-- ============================================================================

DROP POLICY IF EXISTS "blog_images_admin_select" ON storage.objects;
CREATE POLICY "blog_images_admin_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'blog-images'
    AND (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "products_images_admin_select" ON storage.objects;
CREATE POLICY "products_images_admin_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'products-images'
    AND (SELECT public.is_admin())
  );
