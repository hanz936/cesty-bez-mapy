-- ================================================
-- Migration: Add total_sales column to products
-- ================================================
-- Created: 2026-01-03
-- Updated: 2026-01-04 - Verified against latest PostgreSQL docs
-- Description: Add total_sales column with automatic updates via trigger
--              Counts only COMPLETED orders (status = 'completed')
-- ================================================

-- Step 1: Add total_sales column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS total_sales INTEGER DEFAULT 0 NOT NULL;

-- Step 2: Add check constraint (with proper exception handling)
DO $$
BEGIN
  ALTER TABLE products ADD CONSTRAINT products_total_sales_check
    CHECK (total_sales >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Step 3: Calculate initial values from existing COMPLETED orders
UPDATE products
SET total_sales = COALESCE(
  (
    SELECT SUM(oi.quantity)
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.product_id = products.id
      AND o.status = 'completed'
  ),
  0
);

-- Step 4: Create function to update total_sales (counts only completed orders)
CREATE OR REPLACE FUNCTION update_product_total_sales()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT or UPDATE
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE') THEN
    UPDATE products
    SET total_sales = (
      SELECT COALESCE(SUM(oi.quantity), 0)
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.product_id = NEW.product_id
        AND o.status = 'completed'
    )
    WHERE id = NEW.product_id;

    -- If UPDATE changed product_id, update old product too
    IF (TG_OP = 'UPDATE') AND (OLD.product_id IS DISTINCT FROM NEW.product_id) THEN
      UPDATE products
      SET total_sales = (
        SELECT COALESCE(SUM(oi.quantity), 0)
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE oi.product_id = OLD.product_id
          AND o.status = 'completed'
      )
      WHERE id = OLD.product_id;
    END IF;
  END IF;

  -- Handle DELETE
  IF (TG_OP = 'DELETE') THEN
    UPDATE products
    SET total_sales = (
      SELECT COALESCE(SUM(oi.quantity), 0)
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.product_id = OLD.product_id
        AND o.status = 'completed'
    )
    WHERE id = OLD.product_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger on order_items
DROP TRIGGER IF EXISTS update_total_sales_on_order_item_change ON order_items;
CREATE TRIGGER update_total_sales_on_order_item_change
  AFTER INSERT OR UPDATE OR DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_product_total_sales();

-- Step 6: Helper function to update all products in an order
CREATE OR REPLACE FUNCTION update_all_products_in_order()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET total_sales = (
    SELECT COALESCE(SUM(oi.quantity), 0)
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.product_id = products.id
      AND o.status = 'completed'
  )
  WHERE id IN (
    SELECT product_id FROM order_items WHERE order_id = NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger on orders (when status changes to 'completed')
DROP TRIGGER IF EXISTS update_total_sales_on_order_status_change ON orders;
CREATE TRIGGER update_total_sales_on_order_status_change
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_all_products_in_order();

-- Step 8: Create index for efficient sorting by total_sales
CREATE INDEX IF NOT EXISTS idx_products_total_sales ON products(total_sales DESC);

-- Step 9: Add comment for documentation
COMMENT ON COLUMN products.total_sales IS 'Total number of sales (sum of order_items.quantity for COMPLETED orders only). Automatically updated by triggers on order_items and orders tables.';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Successfully added total_sales column to products table';
  RAISE NOTICE '   - Added total_sales INTEGER column with default 0';
  RAISE NOTICE '   - Calculated initial values from COMPLETED orders';
  RAISE NOTICE '   - Created triggers for automatic updates (order_items + orders)';
  RAISE NOTICE '   - Added check constraint (total_sales >= 0)';
  RAISE NOTICE '   - Created index idx_products_total_sales for fast sorting';
  RAISE NOTICE '📊 Products table now ready for automatic sales tracking!';
  RAISE NOTICE '⚠️  NOTE: Only COMPLETED orders count towards total_sales';
END $$;
