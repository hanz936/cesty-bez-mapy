BEGIN;
SELECT plan(4);

-- Fixture: produkt (FK pro order_items.product_id)
INSERT INTO public.products (id, title, description, price, slug)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Test produkt', 'Popis', 1490, 'test-idempotence-slug'
);

-- 1. volání RPC → vytvoří objednávku (was_created = true)
SELECT is(
  (public.create_order_with_items('{
    "stripe_payment_id": "pi_test_idem",
    "customer_email": "test@example.com",
    "customer_name": "Test Test",
    "total_amount": 1490,
    "items": [
      {"product_id":"11111111-1111-1111-1111-111111111111","quantity":1,"price_at_purchase":1490,"vat_rate_at_purchase":21}
    ]
  }'::jsonb) ->> 'was_created'),
  'true',
  'prvni volani vytvori objednavku (was_created = true)'
);

-- 2. volání STEJNÉHO payloadu → idempotentní (was_created = false)
SELECT is(
  (public.create_order_with_items('{
    "stripe_payment_id": "pi_test_idem",
    "customer_email": "test@example.com",
    "customer_name": "Test Test",
    "total_amount": 1490,
    "items": [
      {"product_id":"11111111-1111-1111-1111-111111111111","quantity":1,"price_at_purchase":1490,"vat_rate_at_purchase":21}
    ]
  }'::jsonb) ->> 'was_created'),
  'false',
  'druhe volani neduplikuje (was_created = false)'
);

-- Existuje právě jedna objednávka pro dané stripe_payment_id
SELECT is(
  (SELECT count(*)::int FROM public.orders WHERE stripe_payment_id = 'pi_test_idem'),
  1,
  'existuje prave jedna objednavka'
);

-- Existuje právě jedna položka objednávky
SELECT is(
  (SELECT count(*)::int
     FROM public.order_items oi
     JOIN public.orders o ON o.id = oi.order_id
    WHERE o.stripe_payment_id = 'pi_test_idem'),
  1,
  'existuje prave jedna polozka objednavky'
);

SELECT * FROM finish();
ROLLBACK;
