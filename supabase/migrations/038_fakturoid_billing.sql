-- ================================================
-- Migration 038: Fakturoid billing integration
-- ================================================
-- Created: 2026-05-16
-- Description: Schema changes for automated invoice issuance via Fakturoid.
--   Part 1: orders — billing fields (B2B) + invoice tracking columns
--   Part 2: fakturoid_tokens — singleton OAuth token cache
--   Part 3: integration_logs — already accepts 'facturoid' service (migration 001), no change
--   Part 4: create_order_with_items RPC — accept billing fields in payload
-- ================================================

-- ================================================
-- PART 1: orders — billing + invoice columns
-- ================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS facturoid_invoice_url text,
  ADD COLUMN IF NOT EXISTS facturoid_credit_note_id text,
  ADD COLUMN IF NOT EXISTS facturoid_credit_note_number text,
  ADD COLUMN IF NOT EXISTS invoice_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_error text,
  ADD COLUMN IF NOT EXISTS is_company boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS company_ico text,
  ADD COLUMN IF NOT EXISTS company_dic text,
  ADD COLUMN IF NOT EXISTS billing_street text,
  ADD COLUMN IF NOT EXISTS billing_city text,
  ADD COLUMN IF NOT EXISTS billing_zip text;

COMMENT ON COLUMN public.orders.facturoid_invoice_url IS 'Public HTML URL of invoice in Fakturoid app';
COMMENT ON COLUMN public.orders.invoice_error IS 'Last error from Fakturoid API; NULL when success or not yet attempted';
COMMENT ON COLUMN public.orders.is_company IS 'True if buyer purchased as a company (B2B with IČO)';

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_company_billing_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_company_billing_check
  CHECK (
    is_company = false
    OR (
      company_name IS NOT NULL
      AND company_ico IS NOT NULL
      AND billing_street IS NOT NULL
      AND billing_city IS NOT NULL
      AND billing_zip IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS idx_orders_invoice_status
  ON public.orders (facturoid_invoice_id, invoice_sent, invoice_error)
  WHERE facturoid_invoice_id IS NULL OR invoice_error IS NOT NULL;

-- ================================================
-- PART 2: fakturoid_tokens — singleton OAuth cache
-- ================================================

CREATE TABLE IF NOT EXISTS public.fakturoid_tokens (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  access_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.fakturoid_tokens IS 'Singleton row storing the current Fakturoid OAuth access token. Only service_role can access (RLS denies everyone else).';

ALTER TABLE public.fakturoid_tokens ENABLE ROW LEVEL SECURITY;
-- No policies defined → only service_role bypasses RLS.

-- ================================================
-- PART 4: create_order_with_items RPC — accept billing fields
-- ================================================

CREATE OR REPLACE FUNCTION public.create_order_with_items(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_was_created boolean;
  v_customer_id uuid;
  v_total_amount numeric;
  v_download_token text;
  v_linked_request_ids uuid[];
  v_item jsonb;
BEGIN
  v_customer_id := NULLIF(p_payload->>'customer_id', '')::uuid;
  v_total_amount := (p_payload->>'total_amount')::numeric;
  v_download_token := NULLIF(p_payload->>'download_token', '');

  -- Vložení objednávky; při kolizi (retry) jen načteme existující id.
  INSERT INTO orders (
    auth_user_id,
    customer_id,
    customer_email,
    customer_name,
    total_amount,
    stripe_payment_id,
    status,
    is_company,
    company_name,
    company_ico,
    company_dic,
    billing_street,
    billing_city,
    billing_zip
  ) VALUES (
    NULLIF(p_payload->>'auth_user_id', '')::uuid,
    v_customer_id,
    p_payload->>'customer_email',
    p_payload->>'customer_name',
    v_total_amount,
    p_payload->>'stripe_payment_id',
    'completed',
    COALESCE((p_payload->>'is_company')::boolean, false),
    NULLIF(p_payload->>'company_name', ''),
    NULLIF(p_payload->>'company_ico', ''),
    NULLIF(p_payload->>'company_dic', ''),
    NULLIF(p_payload->>'billing_street', ''),
    NULLIF(p_payload->>'billing_city', ''),
    NULLIF(p_payload->>'billing_zip', '')
  )
  ON CONFLICT (stripe_payment_id) DO NOTHING
  RETURNING id INTO v_order_id;

  IF v_order_id IS NOT NULL THEN
    v_was_created := true;
  ELSE
    v_was_created := false;
    SELECT id INTO v_order_id
      FROM orders
      WHERE stripe_payment_id = p_payload->>'stripe_payment_id';
  END IF;

  -- Vložení položek; ON CONFLICT zajišťuje idempotenci při retry.
  v_linked_request_ids := ARRAY[]::uuid[];
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items')
  LOOP
    INSERT INTO order_items (
      order_id,
      product_id,
      quantity,
      price_at_purchase,
      vat_rate_at_purchase,
      custom_itinerary_request_id
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::int,
      (v_item->>'price_at_purchase')::numeric,
      (v_item->>'vat_rate_at_purchase')::numeric,
      NULLIF(v_item->>'custom_itinerary_request_id', '')::uuid
    )
    ON CONFLICT (order_id, product_id) DO NOTHING;

    IF NULLIF(v_item->>'custom_itinerary_request_id', '') IS NOT NULL THEN
      v_linked_request_ids := v_linked_request_ids
        || (v_item->>'custom_itinerary_request_id')::uuid;
    END IF;
  END LOOP;

  -- Posun navázaných custom_itinerary_requests na 'paid'; guard 'new'
  -- chrání před přepsáním stavu, který už Jana ručně posunula dál.
  IF array_length(v_linked_request_ids, 1) IS NOT NULL THEN
    UPDATE custom_itinerary_requests
       SET status = 'paid',
           updated_at = now()
     WHERE id = ANY(v_linked_request_ids)
       AND status = 'new';
  END IF;

  -- Download token vytvoříme jen pokud pro objednávku ještě žádný není.
  -- Po migraci 036 jsou tokeny perpetual (žádné expires_at), asset_type
  -- má default 'product_pdf'. Případný 'download_expires_at' v payloadu
  -- je tiše ignorován kvůli zpětné kompatibilitě se starším volajícím.
  IF v_download_token IS NOT NULL THEN
    INSERT INTO download_tokens (order_id, token)
    SELECT v_order_id, v_download_token
    WHERE NOT EXISTS (
      SELECT 1 FROM download_tokens WHERE order_id = v_order_id
    );
  END IF;

  -- total_spent navyšujeme jen při prvním vytvoření, aby retry nezdvojil součet.
  IF v_was_created AND v_customer_id IS NOT NULL THEN
    UPDATE customers
       SET total_spent = COALESCE(total_spent, 0) + v_total_amount,
           last_purchase_at = now()
     WHERE id = v_customer_id;
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'was_created', v_was_created
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_order_with_items(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_order_with_items(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(jsonb) TO service_role;

COMMENT ON FUNCTION public.create_order_with_items(jsonb) IS
  'Atomické vytvoření objednávky s položkami; idempotentní podle stripe_payment_id. Po 038: přijímá B2B billing pole (is_company, company_name, company_ico, company_dic, billing_street, billing_city, billing_zip) pro Fakturoid fakturaci.';
