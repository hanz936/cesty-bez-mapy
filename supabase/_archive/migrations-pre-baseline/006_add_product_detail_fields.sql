-- ================================================
-- Add Product Detail Fields Migration
-- ================================================
-- Created: 2026-01-02
-- Description: Add fields for dynamic product detail page content
--              + review system foundation (average_rating, review_count)
-- ================================================

-- Add new fields to products table
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS hero_content TEXT,
  ADD COLUMN IF NOT EXISTS budget_level INTEGER CHECK (budget_level IS NULL OR (budget_level >= 1 AND budget_level <= 3)),

  -- Seasonal descriptions (icons and titles are hardcoded in frontend)
  ADD COLUMN IF NOT EXISTS spring_description TEXT,
  ADD COLUMN IF NOT EXISTS summer_description TEXT,
  ADD COLUMN IF NOT EXISTS autumn_description TEXT,
  ADD COLUMN IF NOT EXISTS winter_description TEXT,

  ADD COLUMN IF NOT EXISTS gallery_images JSONB DEFAULT '[]'::jsonb CHECK (jsonb_typeof(gallery_images) = 'array'),

  -- Review system foundation (will be auto-updated by trigger when reviews table is added)
  ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) DEFAULT 0.00 CHECK (average_rating >= 0 AND average_rating <= 5),
  ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0 CHECK (review_count >= 0);

-- Add index for JSONB column for better query performance
CREATE INDEX IF NOT EXISTS idx_products_gallery_images ON products USING GIN(gallery_images);

-- Add index for sorting by rating (used in "Dle hodnocení" filter)
CREATE INDEX IF NOT EXISTS idx_products_average_rating ON products(average_rating DESC);

-- Add comments for documentation
COMMENT ON COLUMN products.hero_content IS 'Detailed hero section content with bullet points (markdown supported)';

COMMENT ON COLUMN products.budget_level IS 'Budget indicator: 1 = $, 2 = $$, 3 = $$$ (NULL if not applicable). Validated by CHECK constraint.';

COMMENT ON COLUMN products.spring_description IS 'Spring season (🌸 Jaro) - description of why this period is good for the trip. Icons and titles are hardcoded in frontend.';

COMMENT ON COLUMN products.summer_description IS 'Summer season (☀️ Léto) - description of why this period is good for the trip. Icons and titles are hardcoded in frontend.';

COMMENT ON COLUMN products.autumn_description IS 'Autumn season (🍂 Podzim) - description of why this period is good for the trip. Icons and titles are hardcoded in frontend.';

COMMENT ON COLUMN products.winter_description IS 'Winter season (❄️ Zima) - description of why this period is good for the trip. Icons and titles are hardcoded in frontend.';

COMMENT ON COLUMN products.gallery_images IS 'JSONB array with gallery images: [{url: "...", alt: "...", caption: "..."}]. Must be array type (validated by CHECK constraint).';

COMMENT ON COLUMN products.average_rating IS 'Average customer rating (0.00-5.00). Initially 0.00, will be calculated automatically by trigger when reviews table is implemented.';

COMMENT ON COLUMN products.review_count IS 'Total number of approved reviews. Initially 0, will be calculated automatically by trigger when reviews table is implemented.';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Product detail fields added successfully!';
  RAISE NOTICE '📝 Added fields:';
  RAISE NOTICE '   - hero_content (TEXT)';
  RAISE NOTICE '   - budget_level (INTEGER 1-3, validated)';
  RAISE NOTICE '   - spring_description (TEXT) 🌸';
  RAISE NOTICE '   - summer_description (TEXT) ☀️';
  RAISE NOTICE '   - autumn_description (TEXT) 🍂';
  RAISE NOTICE '   - winter_description (TEXT) ❄️';
  RAISE NOTICE '   - gallery_images (JSONB array, validated)';
  RAISE NOTICE '   - average_rating (NUMERIC 0.00-5.00, validated)';
  RAISE NOTICE '   - review_count (INTEGER >= 0, validated)';
  RAISE NOTICE '🔍 Created GIN index for gallery_images';
  RAISE NOTICE '🔍 Created index for rating sorting';
  RAISE NOTICE '🛡️ Added CHECK constraints for data integrity';
  RAISE NOTICE '💡 Review system ready for future implementation!';
  RAISE NOTICE '🌸 Seasonal descriptions are simple TEXT fields for easy editing!';
END $$;
