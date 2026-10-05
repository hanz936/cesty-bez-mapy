begin;
select plan(29);

-- ══════════════════════════════════════════════════════════════════════
-- Blok A: přístupová migrace admin_dashboard_access
-- ══════════════════════════════════════════════════════════════════════

-- ── Struktura ────────────────────────────────────────────────
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'download_tokens'
      and policyname = 'download_tokens_admin_select' and cmd = 'SELECT'),
  1, 'download_tokens_admin_select existuje (SELECT)' );

select is(
  (select roles::text from pg_policies
    where schemaname = 'public' and tablename = 'products' and policyname = 'products_public_select'),
  '{anon}', 'products_public_select je uz jen pro anon' );

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'products'
      and policyname = 'products_authenticated_select' and cmd = 'SELECT'
      and 'authenticated' = any(roles)),
  1, 'products_authenticated_select existuje (SELECT, authenticated)' );

-- Advisor 0006: pro roli authenticated presne jedna permissive policy, ktera plati pro SELECT;
-- jako lint (splinter) pocita i FOR ALL a policies pro PUBLIC
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'products' and cmd in ('SELECT', 'ALL')
      and permissive = 'PERMISSIVE' and roles && array['authenticated', 'public']::name[]),
  1, 'products: jedina permissive SELECT policy pro authenticated (lint 0006)' );

-- Parcialni index: predikat overuje zaroven existenci (chybejici index = NULL)
select is(
  (select pg_get_expr(i.indpred, i.indrelid) from pg_index i
    where i.indexrelid = to_regclass('public.idx_contact_messages_read_at')),
  '(read_at IS NULL)', 'idx_contact_messages_read_at existuje a je parcialni (read_at is null)' );
select has_index('public', 'email_events', 'idx_email_events_created_at',
                 'idx_email_events_created_at existuje');
select col_not_null('public', 'products', 'category_ids',
                    'products.category_ids je NOT NULL (category_ids@not.cs nikdy neskryje produkt)');

-- ── Fixtures (jako postgres, RLS bypass) — sdileji je i bloky B a C ──
insert into public.products (id, title, description, price, slug, is_deleted, deleted_at)
values ('00000000-0000-0000-0000-0000000000a1', 'Dash Live Guide', 'Test description', 1000, 'dash-live-guide', false, null),
       ('00000000-0000-0000-0000-0000000000a2', 'Dash Deleted Guide', 'Test description', 300, 'dash-deleted-guide', true, now());

insert into public.orders (id, customer_email, total_amount, status)
values ('00000000-0000-0000-0000-0000000000b0', 'dash-z@example.com', 100, 'completed');

insert into public.order_items (order_id, product_id, quantity, price_at_purchase, vat_rate_at_purchase)
values ('00000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-0000000000a1', 1, 100, 21);

insert into public.download_tokens (order_id, asset_type, token, download_count, expires_at)
values ('00000000-0000-0000-0000-0000000000b0', 'product_pdf', 'dash-token-0', 0, now() + interval '7 days');

-- ── RLS: anon vidi jen zivy produkt ──────────────────────────
set local role anon;
select is(
  (select count(*)::int from public.products
    where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2')),
  1, 'anon vidi jen nesmazany produkt' );
reset role;

-- ── RLS: authenticated ne-admin (anonymni checkout session) ──
set local role authenticated;
set local request.jwt.claims = '{"is_admin": false, "is_anonymous": true, "aal": "aal1"}';
select is(
  (select count(*)::int from public.products
    where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2')),
  1, 'authenticated ne-admin vidi jen nesmazany produkt' );
select is(
  (select count(*)::int from public.download_tokens where token = 'dash-token-0'),
  0, 'ne-admin nevidi download_tokens (RLS prazdna mnozina, bez chyby)' );

-- ── RLS: admin bez MFA (aal1) je pro obe policies ne-admin ───
set local request.jwt.claims = '{"is_admin": true, "is_anonymous": false, "aal": "aal1"}';
select is(
  (select count(*)::int from public.products
    where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2')),
  1, 'admin bez MFA (aal1) vidi jen nesmazany produkt' );
select is(
  (select count(*)::int from public.download_tokens where token = 'dash-token-0'),
  0, 'admin bez MFA (aal1) nevidi download_tokens' );

-- ── RLS: admin aal2 vidi i soft-smazane a tokeny ─────────────
set local request.jwt.claims = '{"is_admin": true, "is_anonymous": false, "aal": "aal2"}';
select is(
  (select count(*)::int from public.products
    where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2')),
  2, 'admin vidi i soft-smazany produkt (products_authenticated_select)' );
select is(
  (select count(*)::int from public.download_tokens where token = 'dash-token-0'),
  1, 'admin vidi download_tokens (download_tokens_admin_select)' );
reset role;

-- ══════════════════════════════════════════════════════════════════════
-- Blok B: get_admin_dashboard_overview() (migrace get_admin_dashboard_overview)
-- ══════════════════════════════════════════════════════════════════════

select has_function('public'::name, 'get_admin_dashboard_overview'::name, array[]::name[],
                    'get_admin_dashboard_overview() existuje');
select is( has_function_privilege('anon', 'public.get_admin_dashboard_overview()', 'EXECUTE'),
           false, 'anon nema EXECUTE na get_admin_dashboard_overview' );
select is( has_function_privilege('authenticated', 'public.get_admin_dashboard_overview()', 'EXECUTE'),
           true, 'authenticated ma EXECUTE na get_admin_dashboard_overview' );

-- ── Fixtures (jako postgres) — doplnuji blok A ───────────────
insert into public.products (id, title, description, price, slug, pdf_url)
values ('00000000-0000-0000-0000-0000000000a3', 'Dash Guide With PDF', 'Test description', 500, 'dash-pdf-guide', 'products-pdfs/dash.pdf'),
       ('00000000-0000-0000-0000-0000000000a4', 'Dash Itinerar na miru', 'Service product', 1500, 'dash-itinerar-na-miru', null);

insert into public.custom_itinerary_requests (id, customer_email, customer_name, form_data, status)
values ('00000000-0000-0000-0000-0000000000c1', 'dash-b@example.com', 'B', '{}'::jsonb, 'paid'),
       ('00000000-0000-0000-0000-0000000000c2', 'dash-d@example.com', 'D', '{}'::jsonb, 'completed');

-- b1 completed 1000 (guide) · b2 completed 2500 (2x guide 500 + itinerary 1500) · b3 refunded 700
-- b4 completed 300 (soft-deleted guide, 40 days old) · b5 completed 900 (itinerary only)
insert into public.orders (id, customer_email, total_amount, status, created_at)
values ('00000000-0000-0000-0000-0000000000b1', 'dash-a@example.com', 1000, 'completed', now()),
       ('00000000-0000-0000-0000-0000000000b2', 'dash-b@example.com', 2500, 'completed', now()),
       ('00000000-0000-0000-0000-0000000000b3', 'dash-a@example.com', 700, 'refunded', now()),
       ('00000000-0000-0000-0000-0000000000b4', 'dash-c@example.com', 300, 'completed', now() - interval '40 days'),
       ('00000000-0000-0000-0000-0000000000b5', 'dash-d@example.com', 900, 'completed', now());

insert into public.order_items (order_id, product_id, quantity, price_at_purchase, vat_rate_at_purchase, custom_itinerary_request_id)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 1, 1000, 21, null),
       ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a3', 2, 500, 21, null),
       ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a4', 1, 1500, 21, '00000000-0000-0000-0000-0000000000c1'),
       ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000a1', 1, 700, 21, null),
       ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000a2', 1, 300, 21, null),
       ('00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-0000000000a4', 1, 900, 21, '00000000-0000-0000-0000-0000000000c2');

-- Deploy-hook trigger na reviews by zapisoval do deploy_hook_dispatches a rozbil blok C;
-- rating trigger zustava (neskodny). Vse se rolluje zpet.
alter table public.reviews disable trigger trg_reviews_deploy_hook;
insert into public.reviews (product_id, order_id, reviewer_name, rating, review_text, status, approved_at)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'A', 4, 'Deset znaku minimalne, super.', 'approved', now()),
       ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b2', 'B', 5, 'Deset znaku minimalne, vyborne.', 'approved', now()),
       ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b4', 'C', 1, 'Deset znaku minimalne, ceka.', 'pending', null);

-- ── Gate: neadmin dostane 42501, ne data ani nuly ────────────
set local role anon;
select throws_ok( $$ select public.get_admin_dashboard_overview() $$, '42501', null,
                  'anon: volani selze 42501 (EXECUTE odebran)' );
reset role;

set local role authenticated;
set local request.jwt.claims = '{"is_admin": false, "is_anonymous": true, "aal": "aal1"}';
select throws_ok( $$ select public.get_admin_dashboard_overview() $$, '42501', null,
                  'anonymni authenticated session: 42501' );
set local request.jwt.claims = '{"is_admin": true, "is_anonymous": false, "aal": "aal1"}';
select throws_ok( $$ select public.get_admin_dashboard_overview() $$, '42501', null,
                  'admin bez MFA (aal1): 42501' );
reset role;

-- ── Admin aal2 pod roli authenticated (RLS plati) ────────────
create temp table t_overview (v jsonb);
grant insert, select on t_overview to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"is_admin": true, "is_anonymous": false, "aal": "aal2"}';
insert into t_overview select public.get_admin_dashboard_overview();
reset role;

-- completed: b0 100 + b1 1000 + b2 2500 + b4 300 + b5 900 = 4800
select is( (select (v->'totals'->>'revenue')::numeric from t_overview), 4800::numeric,
           'revenue = soucet completed (refunded vylouceno)' );
select is( (select (v->'totals'->>'orders')::int from t_overview), 6, 'orders = vsechny objednavky' );
select is( (select (v->'totals'->>'customers_with_purchase')::int from t_overview), 5,
           'customers_with_purchase = distinct e-maily (z,a,b,c,d)' );
select is( (select (v->'totals'->>'avg_rating')::numeric from t_overview), 4.5::numeric,
           'avg_rating = prumer schvalenych (4,5), pending ignorovan' );
select is( (select (v->'refunds'->>'count')::int from t_overview), 1, 'refunds.count = 1' );
select is( (select (v->'refunds'->>'rate')::numeric from t_overview), 0.1667::numeric,
           'refunds.rate = 1/6 zaokrouhleno na 4 mista' );
-- guides: b0 100 + b1 1000 + b2 2x500 + b4 300 = 2400 · itinerare: b2 1500 + b5 900 = 2400
select is( (select (v->'revenue_split'->>'guides')::numeric from t_overview), 2400::numeric,
           'revenue_split.guides = polozky bez vazby na itinerar' );
select is( (select (v->'revenue_split'->>'custom_itineraries')::numeric from t_overview), 2400::numeric,
           'revenue_split.custom_itineraries = polozky s custom_itinerary_request_id' );
select is( (select (v->'revenue_split'->>'guides')::numeric + (v->'revenue_split'->>'custom_itineraries')::numeric
              from t_overview),
           (select (v->'totals'->>'revenue')::numeric from t_overview),
           'guides + custom_itineraries = revenue' );

select * from finish();
rollback;
