-- Standardize create_order_with_items on search_path='' + fully schema-qualified references.
-- Behavior-preserving: identical logic, only adds public. qualification (verified via rolled-back runtime probe).
-- Brings the last remaining function in line with the project standard (all functions search_path='').
create or replace function public.create_order_with_items(p_payload jsonb) returns jsonb
    language plpgsql
    set search_path to ''
    as $$
declare
  v_order_id uuid;
  v_was_created boolean;
  v_customer_id uuid;
  v_total_amount numeric;
  v_download_token text;
  v_linked_request_ids uuid[];
  v_item jsonb;
begin
  v_customer_id := nullif(p_payload->>'customer_id', '')::uuid;
  v_total_amount := (p_payload->>'total_amount')::numeric;
  v_download_token := nullif(p_payload->>'download_token', '');

  insert into public.orders (
    auth_user_id, customer_id, customer_email, customer_name, total_amount,
    stripe_payment_id, status, is_company, company_name, company_ico,
    company_dic, billing_street, billing_city, billing_zip
  ) values (
    nullif(p_payload->>'auth_user_id', '')::uuid,
    v_customer_id,
    p_payload->>'customer_email',
    p_payload->>'customer_name',
    v_total_amount,
    p_payload->>'stripe_payment_id',
    'completed',
    coalesce((p_payload->>'is_company')::boolean, false),
    nullif(p_payload->>'company_name', ''),
    nullif(p_payload->>'company_ico', ''),
    nullif(p_payload->>'company_dic', ''),
    nullif(p_payload->>'billing_street', ''),
    nullif(p_payload->>'billing_city', ''),
    nullif(p_payload->>'billing_zip', '')
  )
  on conflict (stripe_payment_id) do nothing
  returning id into v_order_id;

  if v_order_id is not null then
    v_was_created := true;
  else
    v_was_created := false;
    select id into v_order_id
      from public.orders
      where stripe_payment_id = p_payload->>'stripe_payment_id';
  end if;

  v_linked_request_ids := array[]::uuid[];
  for v_item in select * from jsonb_array_elements(p_payload->'items')
  loop
    insert into public.order_items (
      order_id, product_id, quantity, price_at_purchase,
      vat_rate_at_purchase, custom_itinerary_request_id
    ) values (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::int,
      (v_item->>'price_at_purchase')::numeric,
      (v_item->>'vat_rate_at_purchase')::numeric,
      nullif(v_item->>'custom_itinerary_request_id', '')::uuid
    )
    on conflict (order_id, product_id) do nothing;

    if nullif(v_item->>'custom_itinerary_request_id', '') is not null then
      v_linked_request_ids := v_linked_request_ids
        || (v_item->>'custom_itinerary_request_id')::uuid;
    end if;
  end loop;

  if array_length(v_linked_request_ids, 1) is not null then
    update public.custom_itinerary_requests
       set status = 'paid', updated_at = now()
     where id = any(v_linked_request_ids)
       and status = 'new';
  end if;

  if v_download_token is not null then
    insert into public.download_tokens (order_id, token)
    select v_order_id, v_download_token
    where not exists (
      select 1 from public.download_tokens where order_id = v_order_id
    );
  end if;

  if v_was_created and v_customer_id is not null then
    update public.customers
       set total_spent = coalesce(total_spent, 0) + v_total_amount,
           last_purchase_at = now()
     where id = v_customer_id;
  end if;

  return jsonb_build_object(
    'order_id', v_order_id,
    'was_created', v_was_created
  );
end;
$$;

comment on function public.create_order_with_items(jsonb) is 'Atomické vytvoření objednávky s položkami; idempotentní podle stripe_payment_id. Přijímá B2B billing pole (is_company, company_name, company_ico, company_dic, billing_street, billing_city, billing_zip) pro Fakturoid fakturaci. search_path='''' + plně kvalifikované reference (project standard).';
