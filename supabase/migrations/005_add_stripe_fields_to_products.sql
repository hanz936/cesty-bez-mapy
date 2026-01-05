-- ================================================
-- CESTY BEZ MAPY - Add Stripe Fields to Products
-- ================================================
-- Created: 2025-12-07
-- Description: Add Stripe Product ID and Price ID fields for payment integration
-- Reference: Stripe best practices - store both Product ID and Price ID
--            Price ID is PRIMARY (used in Checkout Sessions)
--            Product ID is for reference and future flexibility
-- ================================================

-- Add Stripe fields to products table
ALTER TABLE products
ADD COLUMN stripe_product_id TEXT,
ADD COLUMN stripe_price_id TEXT;

-- Add index for fast lookups by Price ID (used in checkout)
CREATE INDEX idx_products_stripe_price_id ON products(stripe_price_id);

-- Add index for Product ID (for webhook synchronization)
CREATE INDEX idx_products_stripe_product_id ON products(stripe_product_id);

-- Add comments for documentation
COMMENT ON COLUMN products.stripe_product_id IS 'Stripe Product ID (prod_xxxxx) - for reference and metadata sync';
COMMENT ON COLUMN products.stripe_price_id IS 'Stripe Price ID (price_xxxxx) - PRIMARY, used in Checkout Sessions';

-- ================================================
-- Migration Notes:
-- ================================================
-- After running this migration:
-- 1. Existing products will have NULL values for Stripe fields
-- 2. New products created via Admin panel will auto-populate these fields
-- 3. To backfill existing products:
--    - Create products in Stripe Dashboard
--    - Manually update products table with Stripe IDs
--    OR
--    - Use Supabase Edge Function to auto-create Stripe products
-- ================================================
