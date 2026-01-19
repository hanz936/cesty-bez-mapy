-- ================================================
-- Migration 011: Link Custom Itinerary Requests to Orders
-- ================================================
-- Created: 2026-01-10
-- Description: Adds foreign key to order_items to link custom itinerary requests
--              This allows tracking which custom request belongs to which order
-- ================================================

-- Add foreign key column to order_items
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS custom_itinerary_request_id uuid
  REFERENCES custom_itinerary_requests(id) ON DELETE SET NULL;

-- Create index for performance (JOIN queries)
CREATE INDEX IF NOT EXISTS idx_order_items_custom_request_id
  ON order_items(custom_itinerary_request_id)
  WHERE custom_itinerary_request_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN order_items.custom_itinerary_request_id IS
  'Link to custom itinerary request (NULL for standard products, UUID for custom itinerary orders)';

-- ================================================
-- Create custom itinerary product (if not exists)
-- ================================================
-- This is the product that customers order when they want a custom itinerary

INSERT INTO products (
  title,
  description,
  price,
  slug,
  duration,
  badge,
  is_active,
  seo_title,
  seo_description,
  vat_rate
) VALUES (
  'Itinerář na míru',
  'Cestovní průvodce šitý přesně na míru vašim potřebám. Vyplňte formulář s vašimi preferencemi a my vytvoříme personalizovaný itinerář, který bude obsahovat všechny informace potřebné pro váš vysněný výlet. Zahrnuje doporučení restaurací, ubytování, dopravy a zajímavých míst na základě vašeho rozpočtu a stylu cestování.',
  999.00,
  'itinerar-na-miru',
  'Dle potřeb',
  'Na míru',
  true,
  'Itinerář na míru - Personalizovaný cestovní průvodce',
  'Objednejte si cestovní průvodce šitý přesně na míru vašim představám. Kompletní plánování výletu podle vašich preferencí, rozpočtu a zájmů.',
  21.00
)
ON CONFLICT (slug) WHERE is_deleted = false DO NOTHING;

-- ================================================
-- SUCCESS MESSAGE
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 011 completed successfully!';
  RAISE NOTICE '📦 Added custom_itinerary_request_id to order_items';
  RAISE NOTICE '🔗 Created index for JOIN performance';
  RAISE NOTICE '🎯 Created "Itinerář na míru" product (if not exists)';
END $$;
