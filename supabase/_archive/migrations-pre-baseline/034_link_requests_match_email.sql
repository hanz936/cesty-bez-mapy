-- ================================================
-- Migration 034: link_requests_to_customer also matches by email
-- ================================================
-- Created: 2026-04-30
-- Description: Audit follow-up — fix asymmetry mezi link_orders_to_customer
--              (email-based) a link_requests_to_customer (UUID-only).
--              Po této migraci se request napojí na nového customera i v
--              případě, že se uživatel zaregistroval samostatně (s novým
--              auth UUID), pokud použije stejný email jako v request formuláři.
--              Pre-launch riziko: nulové (žádná existující data se nemění,
--              jen budoucí registrace mají rozšířený match).
-- ================================================

CREATE OR REPLACE FUNCTION public.link_requests_to_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  updated_count int;
BEGIN
  -- Link requests by either auth_user_id (in-place anon→permanent conversion)
  -- OR customer_email (separate-account registration with same email).
  -- Mirrors the email-based pattern from link_orders_to_customer.
  UPDATE public.custom_itinerary_requests
  SET customer_id = NEW.id,
      updated_at = NOW()
  WHERE (auth_user_id = NEW.id OR customer_email = NEW.email)
    AND customer_id IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count > 0 THEN
    RAISE NOTICE 'Linked % custom itinerary request(s) to customer: %', updated_count, NEW.email;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.link_requests_to_customer IS
  'Automatically link existing requests to newly created customer record (matches by auth_user_id OR customer_email)';

-- ================================================
-- SUCCESS MESSAGE
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ Migration 034 completed!';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE '🔗 ZMĚNY:';
  RAISE NOTICE '   1. public.link_requests_to_customer() nyní páruje requesty';
  RAISE NOTICE '      podle auth_user_id NEBO customer_email (dříve jen UUID).';
  RAISE NOTICE '   2. Symetrie s link_orders_to_customer (email-based).';
  RAISE NOTICE '   3. Žádná existující data se nemění — efekt jen pro budoucí';
  RAISE NOTICE '      INSERTy do public.customers (trigger on_customer_created).';
  RAISE NOTICE '';
END $$;
