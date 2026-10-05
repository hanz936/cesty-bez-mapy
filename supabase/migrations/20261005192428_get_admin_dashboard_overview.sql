-- Admin dashboard "Přehled": totals strip + revenue split (spec §3.3, §3.4, §5.1, §5.2).
-- SECURITY INVOKER (default) so RLS stays the second layer; the explicit is_admin() gate is the
-- first: orders_owner_select would otherwise return the caller's own rows and every checkout
-- visitor holds the authenticated role (signInAnonymously). Non-admins get 42501, never data.
-- Aggregates live here because PostgREST aggregates are disabled on this project (PGRST123).

create or replace function public.get_admin_dashboard_overview()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_orders_total bigint;
  v_refunded bigint;
begin
  if not (select public.is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select count(*), count(*) filter (where o.status = 'refunded')
    into v_orders_total, v_refunded
    from public.orders o;

  return jsonb_build_object(
    'totals', jsonb_build_object(
      -- Net revenue after refunds: a refund rewrites the order status in place (no refunded_at).
      'revenue', coalesce((select sum(o.total_amount) from public.orders o where o.status = 'completed'), 0),
      'orders', v_orders_total,
      -- Buyers = distinct e-mails in orders, not rows in customers (that table also holds
      -- registered-only users and misses one buyer).
      'customers_with_purchase', (select count(distinct o.customer_email) from public.orders o),
      -- Rounded for display only once, in the UI: round(avg, 2) here plus one decimal in the UI
      -- pushed x.x5 up (the double rounding FE fixed in 20260930130116, 820 cases for 1-100 reviews).
      -- 12 places pass the JSON round trip through a JavaScript double unchanged; avg(smallint) is
      -- already numeric.
      'avg_rating', coalesce((select round(avg(r.rating), 12) from public.reviews r where r.status = 'approved'), 0)
    ),
    'refunds', jsonb_build_object(
      'count', v_refunded,
      'rate', case when v_orders_total = 0 then 0
                   else round(v_refunded::numeric / v_orders_total::numeric, 4) end
    ),
    -- Itinerary = order item linked to custom_itinerary_requests (FK); guides = the rest.
    -- Same "completed only" rule as totals.revenue so guides + custom_itineraries = revenue always.
    'revenue_split', jsonb_build_object(
      'guides', coalesce((
        select sum(oi.price_at_purchase * oi.quantity)
          from public.order_items oi
          join public.orders o on o.id = oi.order_id
         where o.status = 'completed' and oi.custom_itinerary_request_id is null), 0),
      'custom_itineraries', coalesce((
        select sum(oi.price_at_purchase * oi.quantity)
          from public.order_items oi
          join public.orders o on o.id = oi.order_id
         where o.status = 'completed' and oi.custom_itinerary_request_id is not null), 0)
    )
  );
end;
$$;

comment on function public.get_admin_dashboard_overview() is
  'Admin dashboard totals: net revenue after refunds, order count, distinct buyers, avg approved rating (12 decimal places; the UI rounds it once for display) and refund rate as a fraction; revenue split guides vs custom itineraries (order_items.custom_itinerary_request_id). Raises 42501 for non-admins. SECURITY INVOKER; reads through admin RLS.';

revoke all on function public.get_admin_dashboard_overview() from public, anon;
grant execute on function public.get_admin_dashboard_overview() to authenticated;
