-- ================================================
-- Migration: Remove unused fields from categories table
-- ================================================
-- Created: 2026-01-03
-- Description: Remove description and parent_id fields as they are not needed
--              for simple category filtering
-- ================================================

-- Drop index for parent_id
DROP INDEX IF EXISTS idx_categories_parent_id;

-- Drop parent_id column (also drops the foreign key constraint automatically)
ALTER TABLE categories DROP COLUMN IF EXISTS parent_id;

-- Drop description column
ALTER TABLE categories DROP COLUMN IF EXISTS description;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Successfully removed unused fields from categories table';
  RAISE NOTICE '   - Dropped parent_id column (and its foreign key constraint)';
  RAISE NOTICE '   - Dropped description column';
  RAISE NOTICE '   - Dropped idx_categories_parent_id index';
  RAISE NOTICE '📋 Categories table now has only: id, name, slug, created_at, updated_at';
END $$;
