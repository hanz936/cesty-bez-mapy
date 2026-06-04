-- ================================================
-- Add Title and Hero Fields Migration
-- ================================================
-- Created: 2026-01-02
-- Description: Add separate fields for card vs detail page titles,
--              and structured hero content lines
-- ================================================

-- Add new fields to products table
ALTER TABLE products
  -- Detail page titles (separate from card)
  ADD COLUMN IF NOT EXISTS detail_title TEXT,
  ADD COLUMN IF NOT EXISTS hero_subtitle TEXT,

  -- Hero content lines (alternating bold/normal)
  ADD COLUMN IF NOT EXISTS hero_line_1 TEXT,
  ADD COLUMN IF NOT EXISTS hero_line_2 TEXT,
  ADD COLUMN IF NOT EXISTS hero_line_3 TEXT,
  ADD COLUMN IF NOT EXISTS hero_line_4 TEXT;

-- Remove unused hero_content field
ALTER TABLE products DROP COLUMN IF EXISTS hero_content;

-- Add comments for documentation
COMMENT ON COLUMN products.title IS 'Card title (longer, descriptive) - displayed on TravelGuides listing page';

COMMENT ON COLUMN products.description IS 'Card description/preview text - displayed on TravelGuides listing page';

COMMENT ON COLUMN products.detail_title IS 'Main h1 title for detail page (shorter, punchier) - if NULL, falls back to title';

COMMENT ON COLUMN products.hero_subtitle IS 'h2 subtitle/tagline on detail page hero section - displayed below h1';

COMMENT ON COLUMN products.hero_line_1 IS 'Hero line 1 (bold green) - emphasized question or statement';

COMMENT ON COLUMN products.hero_line_2 IS 'Hero line 2 (normal text) - descriptive answer or detail';

COMMENT ON COLUMN products.hero_line_3 IS 'Hero line 3 (bold green) - emphasized question or statement';

COMMENT ON COLUMN products.hero_line_4 IS 'Hero line 4 (normal text) - descriptive answer or detail';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Title and hero fields added successfully!';
  RAISE NOTICE '📝 Added fields:';
  RAISE NOTICE '   - detail_title (TEXT) - h1 for detail page';
  RAISE NOTICE '   - hero_subtitle (TEXT) - h2 subtitle for hero section';
  RAISE NOTICE '   - hero_line_1 (TEXT) - bold green emphasis';
  RAISE NOTICE '   - hero_line_2 (TEXT) - normal text';
  RAISE NOTICE '   - hero_line_3 (TEXT) - bold green emphasis';
  RAISE NOTICE '   - hero_line_4 (TEXT) - normal text';
  RAISE NOTICE '🗑️  Removed unused hero_content field';
  RAISE NOTICE '📝 Updated comments for title and description fields';
  RAISE NOTICE '✨ Jana can now edit all fields separately for cards vs detail pages!';
END $$;
