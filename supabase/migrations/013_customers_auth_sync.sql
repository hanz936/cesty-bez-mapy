-- ================================================
-- Migration 013: Customer Auth Sync Triggers
-- ================================================
-- Created: 2026-01-10
-- Description: Automated customer lifecycle management with auth.users sync
--              Creates customer records automatically when users sign up or upgrade
-- ================================================
-- WORKFLOW:
--   1. Permanent user signs up → Customer record created immediately
--   2. Anonymous user signs in → No customer record (guest checkout)
--   3. Anonymous upgrades (adds email) → Customer record created + requests linked
-- ================================================

-- ================================================
-- STEP 1: Modify customers table to use auth.users.id as PK
-- ================================================
-- IMPORTANT: customers.id must match auth.users.id for this to work!

-- ⚠️ MIGRATION PREREQUISITE CHECK ⚠️
-- This migration assumes the customers table is either:
--   1. Empty (fresh installation)
--   2. Contains only test data that can be cleared
--
-- For production databases with existing customer data:
--   STOP! Contact dev team for custom data migration script.
--   Mixing old UUID pattern (gen_random_uuid) with new pattern (auth.users.id)
--   will cause data inconsistency!

DO $$
DECLARE
  customer_count int;
BEGIN
  -- Check if customers table has existing data
  SELECT COUNT(*) INTO customer_count FROM customers;

  IF customer_count > 0 THEN
    RAISE WARNING '⚠️  WARNING: Found % existing customer records!', customer_count;
    RAISE WARNING '⚠️  This migration will change customer.id pattern from gen_random_uuid() to auth.users.id';
    RAISE WARNING '⚠️  Existing records will have OLD pattern, new records will have NEW pattern';
    RAISE WARNING '⚠️  For production: Backup customers table and contact dev team!';
    RAISE WARNING '⚠️  For test data: Run TRUNCATE customers CASCADE; before continuing';
    RAISE WARNING '';
    RAISE WARNING 'To proceed with FRESH START (test environments only):';
    RAISE WARNING '  -- CREATE TABLE customers_backup AS SELECT * FROM customers;';
    RAISE WARNING '  -- TRUNCATE customers CASCADE;';
    RAISE WARNING '  -- Then re-run this migration';
    RAISE WARNING '';

    -- Uncomment the next line to BLOCK migration if customers exist
    -- RAISE EXCEPTION 'Migration blocked: customers table not empty. See warnings above.';
  ELSE
    RAISE NOTICE '✅ customers table is empty - safe to proceed';
  END IF;
END $$;

-- First, check if we need to update the customers table structure
DO $$
BEGIN
  -- Add helpful comment about the relationship
  COMMENT ON TABLE customers IS
    'Customer profiles - id matches auth.users.id (created via triggers from auth events)';

  -- Ensure id column doesn't have DEFAULT (we'll set it from auth.users.id)
  ALTER TABLE customers
    ALTER COLUMN id DROP DEFAULT;

  RAISE NOTICE '✅ Updated customers table structure';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️  Note: customers.id already configured';
END $$;

-- ================================================
-- STEP 2: Function - Handle New Permanent User
-- ================================================
-- Automatically create customer record when permanent user signs up

CREATE OR REPLACE FUNCTION public.handle_new_permanent_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER  -- ✅ CRITICAL: Allows auth schema to write to public schema
SET search_path = public
AS $$
BEGIN
  -- Only create customer for NON-anonymous users
  -- Anonymous users have is_anonymous = true in their JWT
  IF COALESCE((NEW.raw_user_meta_data->>'is_anonymous')::boolean, false) = false THEN
    INSERT INTO public.customers (
      id,           -- ✅ Use same UUID as auth.users.id
      email,
      name,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,       -- ✅ Primary key matches auth.users.id
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', 'Nepojmenovaný zákazník'),
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;  -- Prevent duplicates

    RAISE NOTICE 'Created customer record for user: %', NEW.email;
  ELSE
    RAISE NOTICE 'Skipped customer creation for anonymous user: %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_permanent_user IS
  'Automatically create customer record for new permanent users (not anonymous)';

-- ================================================
-- STEP 3: Trigger - On New User Created
-- ================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_permanent_user();

-- ================================================
-- STEP 4: Function - Handle Anonymous → Permanent Upgrade
-- ================================================
-- When anonymous user adds email (upgrade to permanent), create customer

CREATE OR REPLACE FUNCTION public.handle_user_email_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER  -- ✅ CRITICAL: Allows auth schema to write to public schema
SET search_path = public
AS $$
BEGIN
  -- When anonymous user adds email (upgrade to permanent)
  -- OLD.email IS NULL → anonymous
  -- NEW.email IS NOT NULL → permanent
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
      name = COALESCE(EXCLUDED.name, customers.name),
      updated_at = NOW();

    RAISE NOTICE 'Upgraded anonymous user to permanent customer: %', NEW.email;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_user_email_update IS
  'Create customer record when anonymous user upgrades to permanent (adds email)';

-- ================================================
-- STEP 5: Trigger - On User Email Update
-- ================================================

DROP TRIGGER IF EXISTS on_auth_user_email_set ON auth.users;

CREATE TRIGGER on_auth_user_email_set
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)  -- Only when email actually changes
  EXECUTE FUNCTION public.handle_user_email_update();

-- ================================================
-- STEP 6: Function - Link Requests to Customer
-- ================================================
-- Automatically link existing custom_itinerary_requests when customer created

CREATE OR REPLACE FUNCTION public.link_requests_to_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count int;
BEGIN
  -- Link all requests with matching auth_user_id
  UPDATE custom_itinerary_requests
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

-- ================================================
-- STEP 7: Trigger - On Customer Created
-- ================================================

DROP TRIGGER IF EXISTS on_customer_created ON customers;

CREATE TRIGGER on_customer_created
  AFTER INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION public.link_requests_to_customer();

-- ================================================
-- STEP 8: Update Existing Orders (if any)
-- ================================================
-- Link existing orders to customers using the same pattern

CREATE OR REPLACE FUNCTION public.link_orders_to_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count int;
BEGIN
  -- Link all orders with matching email
  UPDATE orders
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
-- STEP 9: Trigger - Link Orders on Customer Created
-- ================================================

DROP TRIGGER IF EXISTS on_customer_created_link_orders ON customers;

CREATE TRIGGER on_customer_created_link_orders
  AFTER INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION public.link_orders_to_customer();

-- ================================================
-- SUCCESS MESSAGE
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 013 completed successfully!';
  RAISE NOTICE '🔄 Created 4 functions with SECURITY DEFINER:';
  RAISE NOTICE '   1. handle_new_permanent_user() - Create customer on sign up';
  RAISE NOTICE '   2. handle_user_email_update() - Create customer on upgrade';
  RAISE NOTICE '   3. link_requests_to_customer() - Auto-link requests';
  RAISE NOTICE '   4. link_orders_to_customer() - Auto-link orders';
  RAISE NOTICE '⚡ Created 4 triggers:';
  RAISE NOTICE '   1. on_auth_user_created - When new user signs up';
  RAISE NOTICE '   2. on_auth_user_email_set - When anonymous upgrades';
  RAISE NOTICE '   3. on_customer_created - Link requests';
  RAISE NOTICE '   4. on_customer_created_link_orders - Link orders';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Customer lifecycle fully automated!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 WORKFLOWS:';
  RAISE NOTICE '   Anonymous User → No customer record';
  RAISE NOTICE '   Anonymous → Permanent → Customer created + requests linked';
  RAISE NOTICE '   Permanent Sign Up → Customer created immediately';
END $$;
