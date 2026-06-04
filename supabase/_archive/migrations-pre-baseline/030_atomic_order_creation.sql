-- ================================================
-- Migration 030: Atomic order creation
-- ================================================
-- Created: 2026-04-27
-- Description: Atomické vytvoření objednávky + položek + souvisejících
--              updateů v jedné PL/pgSQL transakci. Idempotentní podle
--              stripe_payment_id, aby se webhook při retry vždy sblížil
--              do stejného finálního stavu (žádné částečné stavy).
-- ================================================

-- Unikátní páry (order_id, product_id) - košík dovoluje max 1 kus
-- daného produktu na objednávku, takže ON CONFLICT je bezpečný.
ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_order_product_unique;

ALTER TABLE order_items
  ADD CONSTRAINT order_items_order_product_unique
  UNIQUE (order_id, product_id);

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
  v_download_expires timestamptz;
  v_linked_request_ids uuid[];
  v_item jsonb;
BEGIN
  v_customer_id := NULLIF(p_payload->>'customer_id', '')::uuid;
  v_total_amount := (p_payload->>'total_amount')::numeric;
  v_download_token := NULLIF(p_payload->>'download_token', '');
  v_download_expires := NULLIF(p_payload->>'download_expires_at', '')::timestamptz;

  -- Vložení objednávky; při kolizi (retry) jen načteme existující id.
  INSERT INTO orders (
    auth_user_id,
    customer_id,
    customer_email,
    customer_name,
    total_amount,
    stripe_payment_id,
    status
  ) VALUES (
    NULLIF(p_payload->>'auth_user_id', '')::uuid,
    v_customer_id,
    p_payload->>'customer_email',
    p_payload->>'customer_name',
    v_total_amount,
    p_payload->>'stripe_payment_id',
    'completed'
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
  IF v_download_token IS NOT NULL THEN
    INSERT INTO download_tokens (order_id, token, expires_at)
    SELECT v_order_id, v_download_token, v_download_expires
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
  'Atomické vytvoření objednávky s položkami; idempotentní podle stripe_payment_id.';
