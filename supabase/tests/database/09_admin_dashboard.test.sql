begin;
select plan(14);

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

select * from finish();
rollback;
