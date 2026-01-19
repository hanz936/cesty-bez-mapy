-- ================================================
-- Migration 014: Security Fixes and Policy Cleanup
-- ================================================
-- Created: 2026-01-10
-- Description: Comprehensive security fixes based on Supabase 2026 best practices
--              and cleanup of duplicate RLS policies
-- ================================================
-- FIXES:
--   1. search_path security: SET search_path = '' (empty string)
--   2. Fully qualified names: Use public.table_name everywhere
--   3. Duplicate policies: Remove old policies from migration 002
--   4. Newsletter policy: Add validation (not just WITH CHECK true)
--   5. Trigger conflict: Merge role assignment into handle_new_permanent_user()
-- ================================================
-- KEY INSIGHT: Using CREATE OR REPLACE FUNCTION updates the function.
--              Existing triggers automatically use the new version!
--              NO NEED to drop/create triggers on auth.users!
-- ================================================
-- BASED ON: Supabase 2026 Best Practices
--   - https://supabase.com/docs/guides/database/functions
--   - https://supabase.com/docs/guides/database/database-advisors
-- ================================================

-- ================================================
-- PART 1: Fix search_path for functions from migration 010
-- ================================================

CREATE OR REPLACE FUNCTION update_product_total_sales()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''  -- ✅ Empty string for maximum security
AS $$
BEGIN
  -- Handle INSERT or UPDATE
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE') THEN
    UPDATE public.products
    SET total_sales = (
      SELECT COALESCE(SUM(oi.quantity), 0)
      FROM public.order_items oi
      JOIN public.orders o ON oi.order_id = o.id
      WHERE oi.product_id = NEW.product_id
        AND o.status = 'completed'
    )
    WHERE id = NEW.product_id;

    -- If UPDATE changed product_id, update old product too
    IF (TG_OP = 'UPDATE') AND (OLD.product_id IS DISTINCT FROM NEW.product_id) THEN
      UPDATE public.products
      SET total_sales = (
        SELECT COALESCE(SUM(oi.quantity), 0)
        FROM public.order_items oi
        JOIN public.orders o ON oi.order_id = o.id
        WHERE oi.product_id = OLD.product_id
          AND o.status = 'completed'
      )
      WHERE id = OLD.product_id;
    END IF;
  END IF;

  -- Handle DELETE
  IF (TG_OP = 'DELETE') THEN
    UPDATE public.products
    SET total_sales = (
      SELECT COALESCE(SUM(oi.quantity), 0)
      FROM public.order_items oi
      JOIN public.orders o ON oi.order_id = o.id
      WHERE oi.product_id = OLD.product_id
        AND o.status = 'completed'
    )
    WHERE id = OLD.product_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION update_all_products_in_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''  -- ✅ Empty string for maximum security
AS $$
BEGIN
  UPDATE public.products
  SET total_sales = (
    SELECT COALESCE(SUM(oi.quantity), 0)
    FROM public.order_items oi
    JOIN public.orders o ON oi.order_id = o.id
    WHERE oi.product_id = public.products.id
      AND o.status = 'completed'
  )
  WHERE id IN (
    SELECT product_id FROM public.order_items WHERE order_id = NEW.id
  );

  RETURN NEW;
END;
$$;

-- ================================================
-- PART 2: Fix functions from migration 013
-- ================================================
-- Update existing functions with secure search_path
-- Existing triggers will automatically use updated versions!

CREATE OR REPLACE FUNCTION public.handle_new_permanent_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''  -- ✅ CRITICAL: Empty string + fully qualified names
AS $$
BEGIN
  -- STEP 1: Assign default role (from migration 002)
  -- This was previously done by handle_new_user() which migration 013 overwrote
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- STEP 2: Create customer record if permanent user (from migration 013)
  IF COALESCE((NEW.raw_user_meta_data->>'is_anonymous')::boolean, false) = false THEN
    INSERT INTO public.customers (
      id,
      email,
      name,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', 'Nepojmenovaný zákazník'),
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Created customer record for user: %', NEW.email;
  ELSE
    RAISE NOTICE 'Skipped customer creation for anonymous user: %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_permanent_user IS
  'Automatically create customer record AND assign role for new permanent users (merged from migrations 002 + 013)';

CREATE OR REPLACE FUNCTION public.handle_user_email_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''  -- ✅ CRITICAL: Empty string + fully qualified names
AS $$
BEGIN
  -- When anonymous user adds email (upgrade to permanent)
  IF OLD.email IS NULL AND NEW.email IS NOT NULL THEN
    INSERT INTO public.customers (
      id,
      email,
      name,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', 'Nepojmenovaný zákazník'),
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = COALESCE(EXCLUDED.name, public.customers.name),
      updated_at = NOW();

    RAISE NOTICE 'Upgraded anonymous user to permanent customer: %', NEW.email;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_user_email_update IS
  'Create customer record when anonymous user upgrades to permanent (adds email)';

CREATE OR REPLACE FUNCTION public.link_requests_to_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''  -- ✅ CRITICAL: Empty string + fully qualified names
AS $$
DECLARE
  updated_count int;
BEGIN
  -- Link all requests with matching auth_user_id
  UPDATE public.custom_itinerary_requests
  SET customer_id = NEW.id,
      updated_at = NOW()
  WHERE auth_user_id = NEW.id
    AND customer_id IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count > 0 THEN
    RAISE NOTICE 'Linked % custom itinerary request(s) to customer: %', updated_count, NEW.email;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.link_requests_to_customer IS
  'Automatically link existing requests to newly created customer record';

CREATE OR REPLACE FUNCTION public.link_orders_to_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''  -- ✅ CRITICAL: Empty string + fully qualified names
AS $$
DECLARE
  updated_count int;
BEGIN
  -- Link all orders with matching email
  UPDATE public.orders
  SET customer_id = NEW.id,
      updated_at = NOW()
  WHERE customer_email = NEW.email
    AND customer_id IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count > 0 THEN
    RAISE NOTICE 'Linked % order(s) to customer: %', updated_count, NEW.email;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.link_orders_to_customer IS
  'Automatically link existing orders to newly created customer record (by email)';

-- ================================================
-- PART 3: Cleanup Duplicate Policies
-- ================================================
-- Remove old policies from migration 002 that conflict with migration 012

DROP POLICY IF EXISTS "custom_requests_public_insert" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "custom_requests_admin_select" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "custom_requests_admin_update" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "custom_requests_admin_delete" ON custom_itinerary_requests;

-- ================================================
-- PART 4: Strengthen Newsletter Policy
-- ================================================
-- Replace WITH CHECK (true) with minimal validation

DROP POLICY IF EXISTS "newsletter_consent_public_insert" ON newsletter_consent_log;

CREATE POLICY "newsletter_consent_public_insert"
  ON newsletter_consent_log
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND consent_given IS NOT NULL
    AND source IS NOT NULL
  );

-- ================================================
-- SUCCESS MESSAGE
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 014 completed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 SECURITY FIXES (search_path = ''''):';
  RAISE NOTICE '   1. update_product_total_sales()';
  RAISE NOTICE '   2. update_all_products_in_order()';
  RAISE NOTICE '   3. handle_new_permanent_user() (NOW INCLUDES role assignment!)';
  RAISE NOTICE '   4. handle_user_email_update()';
  RAISE NOTICE '   5. link_requests_to_customer()';
  RAISE NOTICE '   6. link_orders_to_customer()';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 TRIGGER CONFLICT RESOLVED:';
  RAISE NOTICE '   ✅ Updated handle_new_permanent_user() to do BOTH:';
  RAISE NOTICE '      - Assign user role (from migration 002)';
  RAISE NOTICE '      - Create customer record (from migration 013)';
  RAISE NOTICE '   ✅ Existing trigger on_auth_user_created uses updated function automatically!';
  RAISE NOTICE '   ✅ JWT claims (is_admin) will work correctly for NEW users';
  RAISE NOTICE '';
  RAISE NOTICE '🔗 AUTOMATIC LINKAGE:';
  RAISE NOTICE '   ✅ All existing triggers continue to work:';
  RAISE NOTICE '      - on_auth_user_created → handle_new_permanent_user()';
  RAISE NOTICE '      - on_auth_user_email_set → handle_user_email_update()';
  RAISE NOTICE '      - on_customer_created → link_requests_to_customer()';
  RAISE NOTICE '      - on_customer_created_link_orders → link_orders_to_customer()';
  RAISE NOTICE '';
  RAISE NOTICE '🧹 POLICY CLEANUP:';
  RAISE NOTICE '   ✅ Removed 4 duplicate policies from custom_itinerary_requests';
  RAISE NOTICE '   ✅ Strengthened newsletter_consent_log policy';
  RAISE NOTICE '';
  RAISE NOTICE '📊 All functions now use:';
  RAISE NOTICE '   - SET search_path = '''' (empty string)';
  RAISE NOTICE '   - Fully qualified names (public.table_name)';
  RAISE NOTICE '   - Maximum security according to Supabase 2026 best practices';
  RAISE NOTICE '';
  RAISE NOTICE '✅ All Supabase Advisor security warnings should now be resolved!';
  RAISE NOTICE '';
  RAISE NOTICE '📚 References:';
  RAISE NOTICE '   - https://supabase.com/docs/guides/database/functions';
  RAISE NOTICE '   - https://supabase.com/docs/guides/database/database-advisors';
END $$;
