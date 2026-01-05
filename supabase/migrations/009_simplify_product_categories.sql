-- ================================================
-- Migration: Simplify product categories to use array
-- ================================================
-- Created: 2026-01-03
-- Description: Replace many-to-many product_categories table with
--              a simple category_ids UUID array in products table
-- ================================================

-- Step 1: Add category_ids column to products table
ALTER TABLE products ADD COLUMN category_ids uuid[] DEFAULT '{}';

-- Step 2: Migrate existing data from product_categories to category_ids
-- This aggregates all category IDs for each product into an array
UPDATE products
SET category_ids = COALESCE(
  (
    SELECT array_agg(category_id)
    FROM product_categories
    WHERE product_categories.product_id = products.id
  ),
  '{}'
);

-- Step 3: Drop indexes on product_categories
DROP INDEX IF EXISTS idx_product_categories_product_id;
DROP INDEX IF EXISTS idx_product_categories_category_id;

-- Step 4: Drop the product_categories junction table
DROP TABLE IF EXISTS product_categories;

-- Step 5: Create index on category_ids for better query performance
CREATE INDEX idx_products_category_ids ON products USING GIN(category_ids);

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Successfully simplified product categories structure';
  RAISE NOTICE '   - Added category_ids UUID[] column to products table';
  RAISE NOTICE '   - Migrated existing data from product_categories';
  RAISE NOTICE '   - Dropped product_categories junction table';
  RAISE NOTICE '   - Created GIN index on category_ids for fast queries';
  RAISE NOTICE '📋 Products now use simple array: category_ids uuid[]';
END $$;
