begin;
select plan(83);

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
-- RLS je druha vrstva jen pod security invoker; security definer by ji potichu obesel (spec §5.2)
select isnt_definer('public'::name, 'get_admin_dashboard_overview'::name, array[]::name[],
                    'get_admin_dashboard_overview() je security invoker');
select volatility_is('public'::name, 'get_admin_dashboard_overview'::name, array[]::name[], 'stable',
                     'get_admin_dashboard_overview() je stable');

-- ── Prazdna data: bez objednavek a recenzi same nuly, zadne deleni nulou ──
-- Smazani objednavek kaskadou smaze polozky, tokeny a recenze; rollback to savepoint vse vrati.
-- pgTAP cisluje testy sekvenci, kterou rollback nevraci: dalsi test pokracuje spravnym cislem.
savepoint b_empty;
delete from public.reviews;
delete from public.orders;
set local role authenticated;
set local request.jwt.claims = '{"is_admin": true, "is_anonymous": false, "aal": "aal2"}';
select is( public.get_admin_dashboard_overview(),
           '{"totals": {"revenue": 0, "orders": 0, "customers_with_purchase": 0, "avg_rating": 0},
             "refunds": {"count": 0, "rate": 0},
             "revenue_split": {"guides": 0, "custom_itineraries": 0}}'::jsonb,
           'prazdna data: same nuly, zadne deleni nulou' );
reset role;
rollback to savepoint b_empty;

-- ── Vychozi stav pred fixtures bloku B (blok A a pripadna seed data) ──
-- Hodnoty nize jsou prirustky proti nemu, takze test nezavisi na datech, ktera uz v DB jsou.
create temp table t_overview_before (v jsonb);
grant insert, select on t_overview_before to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"is_admin": true, "is_anonymous": false, "aal": "aal2"}';
insert into t_overview_before select public.get_admin_dashboard_overview();
reset role;
-- Prumer neni soucet: k nemu soucet a pocet schvalenych hodnoceni pred fixtures
create temp table t_ratings_before as
  select coalesce(sum(r.rating), 0)::numeric as total, count(*) as n
    from public.reviews r
   where r.status = 'approved';

-- ── Fixtures (jako postgres) — doplnuji blok A ───────────────
insert into public.products (id, title, description, price, slug, pdf_url)
values ('00000000-0000-0000-0000-0000000000a3', 'Dash Guide With PDF', 'Test description', 500, 'dash-pdf-guide', 'products-pdfs/dash.pdf'),
       ('00000000-0000-0000-0000-0000000000a4', 'Dash Itinerar na miru', 'Service product', 1500, 'dash-itinerar-na-miru', null);

insert into public.custom_itinerary_requests (id, customer_email, customer_name, form_data, status)
values ('00000000-0000-0000-0000-0000000000c1', 'dash-b@example.com', 'B', '{}'::jsonb, 'paid'),
       ('00000000-0000-0000-0000-0000000000c2', 'dash-d@example.com', 'D', '{}'::jsonb, 'completed');

-- b1 completed 1000 (guide) · b2 completed 2500 (2x guide 500 + itinerary 1500)
-- b3 refunded 700 (tyz kupujici jako b1, e-mail velkymi pismeny) · b4 completed 300 (soft-deleted
-- guide, 40 days old, bez e-mailu jako fallback stripe-webhook) · b5 completed 600 (itinerary only)
insert into public.orders (id, customer_email, total_amount, status, created_at)
values ('00000000-0000-0000-0000-0000000000b1', 'dash-a@example.com', 1000, 'completed', now()),
       ('00000000-0000-0000-0000-0000000000b2', 'dash-b@example.com', 2500, 'completed', now()),
       ('00000000-0000-0000-0000-0000000000b3', 'DASH-A@example.com', 700, 'refunded', now()),
       ('00000000-0000-0000-0000-0000000000b4', '', 300, 'completed', now() - interval '40 days'),
       ('00000000-0000-0000-0000-0000000000b5', 'dash-d@example.com', 600, 'completed', now());

insert into public.order_items (order_id, product_id, quantity, price_at_purchase, vat_rate_at_purchase, custom_itinerary_request_id)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 1, 1000, 21, null),
       ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a3', 2, 500, 21, null),
       ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a4', 1, 1500, 21, '00000000-0000-0000-0000-0000000000c1'),
       ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000a1', 1, 700, 21, null),
       ('00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000a2', 1, 300, 21, null),
       ('00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-0000000000a4', 1, 600, 21, '00000000-0000-0000-0000-0000000000c2');

-- Deploy-hook trigger na reviews by zapisoval do deploy_hook_dispatches a rozbil blok C;
-- rating trigger zustava (neskodny). Vse se rolluje zpet.
alter table public.reviews disable trigger trg_reviews_deploy_hook;
insert into public.reviews (product_id, order_id, reviewer_name, rating, review_text, status, approved_at)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'A', 4, 'Deset znaku minimalne, super.', 'approved', now()),
       ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b2', 'B', 5, 'Deset znaku minimalne, vyborne.', 'approved', now()),
       ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b0', 'Z', 5, 'Deset znaku minimalne, skvele.', 'approved', now()),
       ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b4', 'C', 1, 'Deset znaku minimalne, ceka.', 'pending', null);

-- ── Gate: neadmin dostane 42501, ne data ani nuly ────────────
set local role anon;
select throws_ok( $$ select public.get_admin_dashboard_overview() $$, '42501',
                  'permission denied for function get_admin_dashboard_overview',
                  'anon: volani selze 42501 (EXECUTE odebran)' );
reset role;

set local role authenticated;
set local request.jwt.claims = '{"is_admin": false, "is_anonymous": true, "aal": "aal1"}';
select throws_ok( $$ select public.get_admin_dashboard_overview() $$, '42501', 'forbidden',
                  'anonymni authenticated session: 42501 forbidden' );
set local request.jwt.claims = '{"is_admin": true, "is_anonymous": false, "aal": "aal1"}';
select throws_ok( $$ select public.get_admin_dashboard_overview() $$, '42501', 'forbidden',
                  'admin bez MFA (aal1): 42501 forbidden' );
reset role;

-- ── Admin aal2 pod roli authenticated (RLS plati) ────────────
create temp table t_overview (v jsonb);
grant insert, select on t_overview to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"is_admin": true, "is_anonymous": false, "aal": "aal2"}';
insert into t_overview select public.get_admin_dashboard_overview();
reset role;

-- Prirustky proti vychozimu stavu. Completed: b1 1000 + b2 2500 + b4 300 + b5 600 = 4400
select is( (select (a.v->'totals'->>'revenue')::numeric - (b.v->'totals'->>'revenue')::numeric
              from t_overview a, t_overview_before b), 4400::numeric,
           'revenue +4400 = soucet completed (refunded vyloucena)' );
select is( (select (a.v->'totals'->>'orders')::int - (b.v->'totals'->>'orders')::int
              from t_overview a, t_overview_before b), 5, 'orders +5 = vsechny objednavky' );
select is( (select (a.v->'totals'->>'customers_with_purchase')::int - (b.v->'totals'->>'customers_with_purchase')::int
              from t_overview a, t_overview_before b), 3,
           'customers_with_purchase +3 = distinct e-maily bez ohledu na velikost pismen, prazdny se nepocita (a, b, d)' );
-- Schvalene 4, 5, 5 (pending ignorovan); bez starsich recenzi 14/3 = 4.666666666667 na 12 mist
-- (D-06), zaokrouhleni na 2 mista by dalo 4.67
select is( (select (v->'totals'->>'avg_rating')::numeric from t_overview),
           (select round((total + 14) / (n + 3), 12) from t_ratings_before),
           'avg_rating = prumer schvalenych na 12 mist, pending ignorovan' );
select is( (select (a.v->'refunds'->>'count')::int - (b.v->'refunds'->>'count')::int
              from t_overview a, t_overview_before b), 1, 'refunds.count +1' );
-- Bez starsich objednavek 1 vracena z 6 (b0 z bloku A + b1..b5) = 0.1667
select is( (select (v->'refunds'->>'rate')::numeric from t_overview),
           (select round(((v->'refunds'->>'count')::numeric + 1) / ((v->'totals'->>'orders')::numeric + 5), 4)
              from t_overview_before),
           'refunds.rate = vracene / vsechny, zaokrouhleno na 4 mista' );
-- guides: b1 1000 + b2 2x500 + b4 300 = 2300 · itinerare: b2 1500 + b5 600 = 2100; ruzne castky,
-- takze prohozene nebo zdvojene podminky rozpadu test shodi
select is( (select (a.v->'revenue_split'->>'guides')::numeric - (b.v->'revenue_split'->>'guides')::numeric
              from t_overview a, t_overview_before b), 2300::numeric,
           'revenue_split.guides +2300 = polozky bez vazby na itinerar' );
select is( (select (a.v->'revenue_split'->>'custom_itineraries')::numeric
                 - (b.v->'revenue_split'->>'custom_itineraries')::numeric
              from t_overview a, t_overview_before b), 2100::numeric,
           'revenue_split.custom_itineraries +2100 = polozky s custom_itinerary_request_id' );
select is( (select (a.v->'revenue_split'->>'guides')::numeric + (a.v->'revenue_split'->>'custom_itineraries')::numeric
                 - (b.v->'revenue_split'->>'guides')::numeric - (b.v->'revenue_split'->>'custom_itineraries')::numeric
              from t_overview a, t_overview_before b),
           (select (a.v->'totals'->>'revenue')::numeric - (b.v->'totals'->>'revenue')::numeric
              from t_overview a, t_overview_before b),
           'prirustek guides + custom_itineraries = prirustek revenue' );

-- ══════════════════════════════════════════════════════════════════════
-- Blok C: get_system_health_overview(p_days) (migrace get_system_health_overview)
-- ══════════════════════════════════════════════════════════════════════

select has_function('public'::name, 'get_system_health_overview'::name, array['integer']::name[],
                    'get_system_health_overview(integer) existuje');
select is( has_function_privilege('anon', 'public.get_system_health_overview(integer)', 'EXECUTE'),
           false, 'anon nema EXECUTE na get_system_health_overview' );
select is( has_function_privilege('authenticated', 'public.get_system_health_overview(integer)', 'EXECUTE'),
           true, 'authenticated ma EXECUTE na get_system_health_overview' );
-- RLS je druha vrstva jen pod security invoker; security definer by ji potichu obesel (spec §5.2)
select isnt_definer('public'::name, 'get_system_health_overview'::name, array['integer']::name[],
                    'get_system_health_overview(integer) je security invoker');
select volatility_is('public'::name, 'get_system_health_overview'::name, array['integer']::name[], 'stable',
                     'get_system_health_overview(integer) je stable');

-- ── Logove tabulky plni blok C od nuly ───────────────────────
-- Pocty jsou absolutni, radky z drivejska by je menily. Do deploy_hook_dispatches navic pri fixtures
-- zivych produktu v blocich A a B zapsal trigger trg_products_deploy_hook (FE 20260930130239; bez
-- tajemstvi jako missing_secret). Vse se na konci rolluje (stejne jako FE test 08). Objednavky
-- a tokeny bloku A a B zustavaji: test predpoklada, ze v okne jine objednavky nejsou (CI ani
-- izolovany projekt seed data nemaji).
delete from public.integration_logs;
delete from public.email_events;
delete from public.email_suppressions;
delete from public.csp_reports;
delete from public.newsletter_consent_log;
delete from public.deploy_hook_dispatches;

-- ── Prazdna data: plny tvar payloadu (vsechny klice, pole v pevnem poradi), same nuly ──
-- Bez polozek objednavek nema zadna objednavka pruvodce a bez tokenu neni nic vydano; objednavky
-- samy mazat netreba. Rollback to savepoint vse vrati.
savepoint c_empty;
delete from public.download_tokens;
delete from public.order_items;
set local role authenticated;
set local request.jwt.claims = '{"is_admin": true, "is_anonymous": false, "aal": "aal2"}';
select is( public.get_system_health_overview(30),
           '{"window_days": 30,
             "integrations": [{"service": "ecomail", "status": "failed", "count": 0},
                              {"service": "ecomail", "status": "pending", "count": 0},
                              {"service": "ecomail", "status": "success", "count": 0},
                              {"service": "fakturoid", "status": "failed", "count": 0},
                              {"service": "fakturoid", "status": "pending", "count": 0},
                              {"service": "fakturoid", "status": "success", "count": 0},
                              {"service": "other", "status": "failed", "count": 0},
                              {"service": "other", "status": "pending", "count": 0},
                              {"service": "other", "status": "success", "count": 0},
                              {"service": "stripe", "status": "failed", "count": 0},
                              {"service": "stripe", "status": "pending", "count": 0},
                              {"service": "stripe", "status": "success", "count": 0}],
             "emails": {"delivered": 0, "bounced": 0, "complained": 0, "suppressions": 0},
             "downloads": {"orders_without_token": 0,
                           "by_asset_type": [{"asset_type": "custom_itinerary_pdf", "issued": 0, "link_issued": 0, "expired_unused": 0},
                                             {"asset_type": "product_pdf", "issued": 0, "link_issued": 0, "expired_unused": 0}]},
             "deploy_hooks": [{"source": "blog_posts", "changes": 0, "retries": 0, "ok": 0, "rejected": 0, "no_response": 0, "pending": 0, "deduplicated": 0, "missing_secret": 0},
                              {"source": "categories", "changes": 0, "retries": 0, "ok": 0, "rejected": 0, "no_response": 0, "pending": 0, "deduplicated": 0, "missing_secret": 0},
                              {"source": "products", "changes": 0, "retries": 0, "ok": 0, "rejected": 0, "no_response": 0, "pending": 0, "deduplicated": 0, "missing_secret": 0},
                              {"source": "reviews", "changes": 0, "retries": 0, "ok": 0, "rejected": 0, "no_response": 0, "pending": 0, "deduplicated": 0, "missing_secret": 0}],
             "deploy_hooks_latest": null,
             "csp_reports": 0,
             "csp_window_days": 7,
             "newsletter_consents": {"opt_in": 0, "opt_out": 0}}'::jsonb,
           'prazdna data: plny tvar payloadu, same nuly, deploy_hooks_latest null' );
reset role;
rollback to savepoint c_empty;

-- ── Fixtures (jako postgres) — okno 30 dni; radky "40 days" jsou mimo okno ──
-- Tokeny (k dash-token-0 z bloku A: b0, nevyuzity, platny):
--   t1 b2 — odkaz vydan, platnost uz vyprsela (prosly, ale vyuzity: do expired_unused nepatri)
--   t2 c2 — itinerar jako v produkci bez expires_at (send-custom-itinerary-email): 9 dni stary
--           a nevyuzity, a presto nikdy prosly (spec §6)
--   t3 b0 — mimo okno (40 dni) · t4 b2 — prosly a nevyuzity
--   → product_pdf issued 3 (t0, t1, t4), link_issued 1 (t1), expired_unused 1 (t4)
insert into public.download_tokens (order_id, custom_itinerary_request_id, asset_type, token, download_count, expires_at, created_at)
values ('00000000-0000-0000-0000-0000000000b2', null, 'product_pdf', 'dash-token-1', 1, now() - interval '1 day', now() - interval '8 days'),
       (null, '00000000-0000-0000-0000-0000000000c2', 'custom_itinerary_pdf', 'dash-token-2', 0, null, now() - interval '9 days'),
       ('00000000-0000-0000-0000-0000000000b0', null, 'product_pdf', 'dash-token-3', 0, now() - interval '33 days', now() - interval '40 days'),
       ('00000000-0000-0000-0000-0000000000b2', null, 'product_pdf', 'dash-token-4', 0, now() - interval '1 day', now() - interval '8 days');

insert into public.integration_logs (service, action, status, created_at)
values ('fakturoid', 'create_invoice', 'failed', now()),
       ('fakturoid', 'create_invoice', 'failed', now()),
       ('stripe', 'create_product', 'success', now()),
       ('ecomail', 'subscribe', 'failed', now() - interval '40 days');

-- Kazdy typ udalosti ma i radek mimo okno (40 dni); dash-re-8 (10 dni) je v okne 30 dni, ne 7 dni
insert into public.email_events (resend_email_id, event_type, email_to, payload, created_at)
values ('dash-re-1', 'email.delivered', 'dash-a@example.com', '{}'::jsonb, now()),
       ('dash-re-2', 'email.delivered', 'dash-b@example.com', '{}'::jsonb, now()),
       ('dash-re-3', 'email.bounced', 'dash-c@example.com', '{}'::jsonb, now()),
       ('dash-re-4', 'email.delivered', 'dash-d@example.com', '{}'::jsonb, now() - interval '40 days'),
       ('dash-re-5', 'email.complained', 'dash-a@example.com', '{}'::jsonb, now()),
       ('dash-re-6', 'email.bounced', 'dash-c@example.com', '{}'::jsonb, now() - interval '40 days'),
       ('dash-re-7', 'email.complained', 'dash-b@example.com', '{}'::jsonb, now() - interval '40 days'),
       ('dash-re-8', 'email.delivered', 'dash-e@example.com', '{}'::jsonb, now() - interval '10 days');

insert into public.email_suppressions (email, reason, created_at)
values ('dash-bounce@example.com', 'hard_bounce', now()),
       ('dash-old@example.com', 'hard_bounce', now() - interval '40 days');

-- reviews: prijato (200) · odmitnuto (500) · opakovani po 500 neodeslane, chybelo tajemstvi
--          (retry_of + missing_secret: do retries nepatri) · sloucena zmena (deduplicated,
--          nejnovejsi radek vubec) · mimo okno (40 dni)
-- products: zmena bez odpovedi (timeout pg_net) -> opakovani bez odpovedi -> opakovani 201
--           (retezec retry_of jako v produkci 2026-10-02)
-- categories: chybi tajemstvi (nic neodeslano) · blog_posts: odeslano pred 5 min, odpoved nesebrana
insert into public.deploy_hook_dispatches
  (id, source, transaction_id, request_id, skip_reason, status_code, error_message, checked_at, retry_of, created_at)
values ('00000000-0000-0000-0000-0000000000d1', 'reviews', pg_current_xact_id(), 101, null, 200, null, now(), null, now() - interval '3 hours'),
       ('00000000-0000-0000-0000-0000000000d2', 'reviews', pg_current_xact_id(), 102, null, 500, null, now(), null, now() - interval '170 minutes'),
       ('00000000-0000-0000-0000-0000000000d5', 'reviews', pg_current_xact_id(), null, 'missing_secret', null, null, now(), '00000000-0000-0000-0000-0000000000d2', now() - interval '155 minutes'),
       ('00000000-0000-0000-0000-0000000000d3', 'reviews', pg_current_xact_id(), null, 'deduplicated', null, null, now(), null, now() - interval '1 minute'),
       ('00000000-0000-0000-0000-0000000000d4', 'reviews', pg_current_xact_id(), 104, null, 200, null, now(), null, now() - interval '40 days'),
       ('00000000-0000-0000-0000-0000000000e1', 'products', pg_current_xact_id(), 201, null, null, 'Timeout of 5000 ms reached', now(), null, now() - interval '2 hours'),
       ('00000000-0000-0000-0000-0000000000e2', 'products', pg_current_xact_id(), 202, null, null, 'Timeout of 5000 ms reached', now(), '00000000-0000-0000-0000-0000000000e1', now() - interval '90 minutes'),
       ('00000000-0000-0000-0000-0000000000e3', 'products', pg_current_xact_id(), 203, null, 201, null, now(), '00000000-0000-0000-0000-0000000000e2', now() - interval '1 hour'),
       ('00000000-0000-0000-0000-0000000000f1', 'categories', pg_current_xact_id(), null, 'missing_secret', null, null, now(), null, now() - interval '30 minutes'),
       ('00000000-0000-0000-0000-0000000000f2', 'blog_posts', pg_current_xact_id(), 301, null, null, null, null, null, now() - interval '5 minutes');

insert into public.csp_reports (disposition, raw, created_at)
values ('enforce', '{}'::jsonb, now()),
       ('enforce', '{}'::jsonb, now() - interval '10 days');

insert into public.newsletter_consent_log (email, consent_given, source, created_at)
values ('dash-n1@example.com', true, 'checkout', now()),
       ('dash-n2@example.com', false, 'footer', now()),
       ('dash-n3@example.com', true, 'checkout', now() - interval '40 days'),
       ('dash-n4@example.com', false, 'footer', now() - interval '40 days');

-- ── Gate ─────────────────────────────────────────────────────
set local role anon;
select throws_ok( $$ select public.get_system_health_overview(30) $$, '42501',
                  'permission denied for function get_system_health_overview',
                  'anon: 42501 (EXECUTE odebran)' );
reset role;

set local role authenticated;
set local request.jwt.claims = '{"is_admin": false, "is_anonymous": true, "aal": "aal1"}';
select throws_ok( $$ select public.get_system_health_overview(30) $$, '42501', 'forbidden',
                  'anonymni authenticated session: 42501 forbidden' );
set local request.jwt.claims = '{"is_admin": true, "is_anonymous": false, "aal": "aal1"}';
select throws_ok( $$ select public.get_system_health_overview(30) $$, '42501', 'forbidden',
                  'admin bez MFA (aal1): 42501 forbidden' );
set local request.jwt.claims = '{"is_admin": true, "is_anonymous": false, "aal": "aal2"}';
select throws_ok( $$ select public.get_system_health_overview(0) $$, '22023', 'p_days must be between 1 and 30',
                  'p_days = 0 odmitnuto (22023)' );
select throws_ok( $$ select public.get_system_health_overview(31) $$, '22023', 'p_days must be between 1 and 30',
                  'p_days = 31 odmitnuto (22023; tokeny se mazou ~37 dni po vydani)' );
select throws_ok( $$ select public.get_system_health_overview(null) $$, '22023', 'p_days must be between 1 and 30',
                  'p_days = null odmitnuto (22023, ne tiche nuly)' );
reset role;

-- ── Admin aal2 pod roli authenticated ────────────────────────
create temp table t_health (v jsonb);
grant insert, select on t_health to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"is_admin": true, "is_anonymous": false, "aal": "aal2"}';
insert into t_health select public.get_system_health_overview(30);
reset role;

select is( (select (v->>'window_days')::int from t_health), 30, 'window_days = 30' );
select is( (select jsonb_array_length(v->'integrations') from t_health), 12,
           'integrations: 4 sluzby x 3 stavy vcetne nul' );
-- Vycty ve funkci = CHECK omezeni tabulek: hodnota pridana do CHECK by z payloadu potichu vypadla
select is( (select array_agg(distinct e->>'service' order by e->>'service')
              from t_health, jsonb_array_elements(v->'integrations') e),
           (select array_agg(m[1] order by m[1])
              from pg_constraint c, regexp_matches(pg_get_constraintdef(c.oid), '''([^'']*)''', 'g') m
             where c.conrelid = 'public.integration_logs'::regclass and c.conname = 'integration_logs_service_check'),
           'integrations: sluzby = CHECK integration_logs_service_check' );
select is( (select array_agg(distinct e->>'status' order by e->>'status')
              from t_health, jsonb_array_elements(v->'integrations') e),
           (select array_agg(m[1] order by m[1])
              from pg_constraint c, regexp_matches(pg_get_constraintdef(c.oid), '''([^'']*)''', 'g') m
             where c.conrelid = 'public.integration_logs'::regclass and c.conname = 'integration_logs_status_check'),
           'integrations: stavy = CHECK integration_logs_status_check' );
select is( (select array_agg(e->>'asset_type' order by e->>'asset_type')
              from t_health, jsonb_array_elements(v->'downloads'->'by_asset_type') e),
           (select array_agg(m[1] order by m[1])
              from pg_constraint c, regexp_matches(pg_get_constraintdef(c.oid), '''([^'']*)''', 'g') m
             where c.conrelid = 'public.download_tokens'::regclass and c.conname = 'download_tokens_asset_type_check'),
           'by_asset_type: typy = CHECK download_tokens_asset_type_check' );
select is( (select array_agg(e->>'source' order by e->>'source')
              from t_health, jsonb_array_elements(v->'deploy_hooks') e),
           (select array_agg(m[1] order by m[1])
              from pg_constraint c, regexp_matches(pg_get_constraintdef(c.oid), '''([^'']*)''', 'g') m
             where c.conrelid = 'public.deploy_hook_dispatches'::regclass and c.conname = 'deploy_hook_dispatches_source_check'),
           'deploy_hooks: zdroje = CHECK deploy_hook_dispatches_source_check' );
select is( (select (e->>'count')::int from t_health, jsonb_array_elements(v->'integrations') e
             where e->>'service' = 'fakturoid' and e->>'status' = 'failed'), 2,
           'fakturoid/failed = 2' );
select is( (select (e->>'count')::int from t_health, jsonb_array_elements(v->'integrations') e
             where e->>'service' = 'stripe' and e->>'status' = 'success'), 1,
           'stripe/success = 1' );
select is( (select (e->>'count')::int from t_health, jsonb_array_elements(v->'integrations') e
             where e->>'service' = 'ecomail' and e->>'status' = 'failed'), 0,
           'ecomail/failed = 0 (radek 40 dni stary je mimo okno, nulovy radek existuje)' );

select is( (select (v->'emails'->>'delivered')::int from t_health), 3,
           'emails.delivered = 3 (radek 10 dni stary je v okne, 40 dni stary ne)' );
select is( (select (v->'emails'->>'bounced')::int from t_health), 1,
           'emails.bounced = 1 (radek 40 dni stary je mimo okno)' );
select is( (select (v->'emails'->>'complained')::int from t_health), 1,
           'emails.complained = 1 (radek 40 dni stary je mimo okno)' );
select is( (select (v->'emails'->>'suppressions')::int from t_health), 1, 'emails.suppressions = 1' );

-- b1 (bez tokenu) ano; b0/b2 maji token; b4 (40 dni, bez tokenu) vyradi jen okno; b3 (refunded,
-- bez tokenu) vyradi jen stav; b5 jen itinerar
select is( (select (v->'downloads'->>'orders_without_token')::int from t_health), 1,
           'orders_without_token = 1 (jen b1)' );
select is( (select (e->>'issued')::int from t_health, jsonb_array_elements(v->'downloads'->'by_asset_type') e
             where e->>'asset_type' = 'product_pdf'), 3, 'product_pdf issued = 3 (token-0, token-1, token-4)' );
select is( (select (e->>'link_issued')::int from t_health, jsonb_array_elements(v->'downloads'->'by_asset_type') e
             where e->>'asset_type' = 'product_pdf'), 1, 'product_pdf link_issued = 1 (token-1)' );
select is( (select (e->>'expired_unused')::int from t_health, jsonb_array_elements(v->'downloads'->'by_asset_type') e
             where e->>'asset_type' = 'product_pdf'), 1,
           'product_pdf expired_unused = 1 (token-4; token-1 prosly, ale vyuzity; token-0 platny)' );
select is( (select (e->>'expired_unused')::int from t_health, jsonb_array_elements(v->'downloads'->'by_asset_type') e
             where e->>'asset_type' = 'custom_itinerary_pdf'), 0,
           'custom_itinerary_pdf expired_unused = 0 (token bez expirace nikdy nevyprsi, spec §6)' );
select is( (select jsonb_array_length(v->'downloads'->'by_asset_type') from t_health), 2,
           'by_asset_type: vzdy 2 typy (custom_itinerary_pdf, product_pdf)' );

select is( (select jsonb_array_length(v->'deploy_hooks') from t_health), 4,
           'deploy_hooks: vzdy 4 zdroje (blog_posts, categories, products, reviews)' );
select is( (select e from t_health, jsonb_array_elements(v->'deploy_hooks') e where e->>'source' = 'reviews'),
           '{"source": "reviews", "changes": 2, "retries": 0, "ok": 1, "rejected": 1, "no_response": 0, "pending": 0, "deduplicated": 1, "missing_secret": 1}'::jsonb,
           'reviews: 2 zmeny (200, 500), neodeslane opakovani jen jako missing_secret, 1 sloucena; radek mimo okno se nepocita' );
select is( (select e from t_health, jsonb_array_elements(v->'deploy_hooks') e where e->>'source' = 'products'),
           '{"source": "products", "changes": 1, "retries": 2, "ok": 1, "rejected": 0, "no_response": 2, "pending": 0, "deduplicated": 0, "missing_secret": 0}'::jsonb,
           'products: zmena + 2 opakovani; 2x bez odpovedi (timeout), posledni 201' );
select is( (select e from t_health, jsonb_array_elements(v->'deploy_hooks') e where e->>'source' = 'categories'),
           '{"source": "categories", "changes": 0, "retries": 0, "ok": 0, "rejected": 0, "no_response": 0, "pending": 0, "deduplicated": 0, "missing_secret": 1}'::jsonb,
           'categories: chybi tajemstvi (nic neodeslano)' );
select is( (select e from t_health, jsonb_array_elements(v->'deploy_hooks') e where e->>'source' = 'blog_posts'),
           '{"source": "blog_posts", "changes": 1, "retries": 0, "ok": 0, "rejected": 0, "no_response": 0, "pending": 1, "deduplicated": 0, "missing_secret": 0}'::jsonb,
           'blog_posts: odeslano, odpoved nesebrana (ceka)' );
-- Stav webu = nejnovejsi rozhodujici radek; sloucena zmena d3 je novejsi, ale nic nerozhoduje.
-- nullif: bez rozhodujiciho radku je stav webu JSON null a `- 'created_at'` by misto selhani assertu
-- shodil cely soubor chybou "cannot delete from scalar"
select is( (select nullif(v->'deploy_hooks_latest', 'null'::jsonb) - 'created_at' from t_health),
           '{"source": "blog_posts", "is_retry": false, "outcome": "pending"}'::jsonb,
           'deploy_hooks_latest: nejnovejsi odeslany radek (blog_posts, ceka), deduplicated preskocen' );
select is( (select (v->'deploy_hooks_latest'->>'created_at')::timestamptz from t_health), now() - interval '5 minutes',
           'deploy_hooks_latest.created_at = cas toho radku' );

select is( (select (v->>'csp_reports')::int from t_health), 1, 'csp_reports = 1 (7denni okno)' );
select is( (select (v->>'csp_window_days')::int from t_health), 7, 'csp_window_days = 7' );
select is( (select (v->'newsletter_consents'->>'opt_in')::int from t_health), 1, 'opt_in = 1' );
select is( (select (v->'newsletter_consents'->>'opt_out')::int from t_health), 1,
           'opt_out = 1 (radek 40 dni stary je mimo okno)' );

-- Stav webu v dalsich scenarich: bez cekajiciho radku rozhoduje chybejici tajemstvi, bez nej
-- automaticke opakovani s 201 a pred nim opakovani bez odpovedi (timeout) — retezec jako v produkci
-- 2026-10-02 —, pak odmitnuti (500); okno stav webu nema (rozhoduje i radek 40 dni stary); prazdna
-- tabulka = null.
-- retry_of ma on delete set null, proto se radek mazne az spolu s opakovanimi, ktere na nej ukazuji.
delete from public.deploy_hook_dispatches where id = '00000000-0000-0000-0000-0000000000f2';
set local role authenticated;
set local request.jwt.claims = '{"is_admin": true, "is_anonymous": false, "aal": "aal2"}';
select is( nullif(public.get_system_health_overview(30)->'deploy_hooks_latest', 'null'::jsonb) - 'created_at',
           '{"source": "categories", "is_retry": false, "outcome": "missing_secret"}'::jsonb,
           'deploy_hooks_latest: chybi tajemstvi (web se neprestavi)' );
reset role;

delete from public.deploy_hook_dispatches where id = '00000000-0000-0000-0000-0000000000f1';
set local role authenticated;
set local request.jwt.claims = '{"is_admin": true, "is_anonymous": false, "aal": "aal2"}';
select is( nullif(public.get_system_health_overview(30)->'deploy_hooks_latest', 'null'::jsonb) - 'created_at',
           '{"source": "products", "is_retry": true, "outcome": "ok"}'::jsonb,
           'deploy_hooks_latest: automaticke opakovani prijato (201), web aktualni' );
reset role;

delete from public.deploy_hook_dispatches where id = '00000000-0000-0000-0000-0000000000e3';
set local role authenticated;
set local request.jwt.claims = '{"is_admin": true, "is_anonymous": false, "aal": "aal2"}';
select is( nullif(public.get_system_health_overview(30)->'deploy_hooks_latest', 'null'::jsonb) - 'created_at',
           '{"source": "products", "is_retry": true, "outcome": "no_response"}'::jsonb,
           'deploy_hooks_latest: opakovani bez odpovedi (timeout) je no_response, ne rejected' );
reset role;

delete from public.deploy_hook_dispatches
 where id in ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2',
              '00000000-0000-0000-0000-0000000000d5');
set local role authenticated;
set local request.jwt.claims = '{"is_admin": true, "is_anonymous": false, "aal": "aal2"}';
select is( nullif(public.get_system_health_overview(30)->'deploy_hooks_latest', 'null'::jsonb) - 'created_at',
           '{"source": "reviews", "is_retry": false, "outcome": "rejected"}'::jsonb,
           'deploy_hooks_latest: Vercel odpovedel 500 je rejected' );
reset role;

delete from public.deploy_hook_dispatches
 where id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2',
              '00000000-0000-0000-0000-0000000000d3');
set local role authenticated;
set local request.jwt.claims = '{"is_admin": true, "is_anonymous": false, "aal": "aal2"}';
select is( nullif(public.get_system_health_overview(30)->'deploy_hooks_latest', 'null'::jsonb) - 'created_at',
           '{"source": "reviews", "is_retry": false, "outcome": "ok"}'::jsonb,
           'deploy_hooks_latest: okno nema, rozhoduje i radek 40 dni stary' );
reset role;

delete from public.deploy_hook_dispatches;
set local role authenticated;
set local request.jwt.claims = '{"is_admin": true, "is_anonymous": false, "aal": "aal2"}';
select is( public.get_system_health_overview(30)->'deploy_hooks_latest', 'null'::jsonb,
           'deploy_hooks_latest: bez rozhodujiciho radku null' );

-- p_days: 7denni okno vyradi dash-re-8 (10 dni stary); vychozi p_days je 30
select is( (public.get_system_health_overview(7)->'emails'->>'delivered')::int, 2,
           'p_days = 7: emails.delivered = 2 (radek 10 dni stary je mimo 7denni okno)' );
select is( (public.get_system_health_overview(7)->>'window_days')::int, 7, 'p_days = 7: window_days = 7' );
select is( (select (public.get_system_health_overview()->>'window_days')::int), 30,
           'vychozi p_days = 30' );
reset role;

select * from finish();
rollback;
