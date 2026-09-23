begin;
select plan(26);

-- Změny produktů a kategorií přestavují web (nález F7 auditu 2026-08-31, migrace
-- 20260923202547). Test běží BEZ vault secretu: helper pak každé vyžádání zapíše jako
-- `missing_secret` a deduplikace v rámci transakce nic nespolkne — dá se tedy spočítat,
-- kolikrát si který trigger o rebuild řekl.
delete from vault.secrets where name = 'vercel_deploy_hook';
delete from public.deploy_hook_dispatches;
-- Helper na chybějící secret schválně hlásí WARNING; tady je to očekávané.
set local client_min_messages = error;

-- ── Struktura ────────────────────────────────────────────────
select has_function('public'::name, 'notify_vercel_products_change'::name, 'deploy-hook funkce pro produkty existuje');
select has_trigger('public'::name, 'products'::name, 'trg_products_deploy_hook'::name, 'produkty mají deploy-hook trigger');
select has_function('public'::name, 'notify_vercel_categories_change'::name, 'deploy-hook funkce pro kategorie existuje');
select has_trigger('public'::name, 'categories'::name, 'trg_categories_deploy_hook'::name, 'kategorie mají deploy-hook trigger');

-- Advisor 0028/0029: SECURITY DEFINER funkce volané jen triggerem nesmí jít přes RPC.
select is( has_function_privilege('anon', 'public.notify_vercel_products_change()', 'EXECUTE'),
           false, 'anon nemá EXECUTE na notify_vercel_products_change' );
select is( has_function_privilege('authenticated', 'public.notify_vercel_products_change()', 'EXECUTE'),
           false, 'authenticated nemá EXECUTE na notify_vercel_products_change' );
select is( has_function_privilege('anon', 'public.notify_vercel_categories_change()', 'EXECUTE'),
           false, 'anon nemá EXECUTE na notify_vercel_categories_change' );
select is( has_function_privilege('authenticated', 'public.notify_vercel_categories_change()', 'EXECUTE'),
           false, 'authenticated nemá EXECUTE na notify_vercel_categories_change' );

-- ── Produkty ─────────────────────────────────────────────────
-- `updated_at` o den zpátky: moddatetime zapisuje čas ZAČÁTKU transakce, takže v jediné
-- testovací transakci by se jinak nepohnul a vynechání `updated_at` z porovnání by nešlo
-- ověřit. INSERT moddatetime nespouští (trigger je jen BEFORE UPDATE).
insert into public.products (id, title, description, price, slug, updated_at)
values ('00000000-0000-0000-0000-0000000006a1', 'Katalog Live', 'Test description', 100, 'test-catalog-live',
        now() - interval '1 day');

select is( (select count(*) from public.deploy_hook_dispatches where source = 'products')::int,
           1, 'přidání živého průvodce přestaví web' );

-- Uložení formuláře beze změny: moddatetime posune jen `updated_at`.
update public.products set title = title
 where id = '00000000-0000-0000-0000-0000000006a1';

select is( (select count(*) from public.deploy_hook_dispatches where source = 'products')::int,
           1, 'uložení beze změny build nespouští' );

insert into public.products (id, title, description, price, slug, is_active)
values ('00000000-0000-0000-0000-0000000006a2', 'Katalog Draft', 'Test description', 100, 'test-catalog-draft', false);
update public.products set title = 'Katalog Draft 2'
 where id = '00000000-0000-0000-0000-0000000006a2';

select is( (select count(*) from public.deploy_hook_dispatches where source = 'products')::int,
           1, 'přidání ani úprava konceptu build nespouští' );

update public.products set price = 120
 where id = '00000000-0000-0000-0000-0000000006a1';

select is( (select count(*) from public.deploy_hook_dispatches where source = 'products')::int,
           2, 'změna ceny živého průvodce přestaví web' );

update public.products set total_sales = total_sales + 1
 where id = '00000000-0000-0000-0000-0000000006a1';

select is( (select count(*) from public.deploy_hook_dispatches where source = 'products')::int,
           2, 'prodej (total_sales) build nespouští' );

update public.products
   set stripe_product_id = 'prod_test', stripe_price_id = 'price_test', stripe_sync_error = 'x'
 where id = '00000000-0000-0000-0000-0000000006a1';

select is( (select count(*) from public.deploy_hook_dispatches where source = 'products')::int,
           2, 'synchronizace se Stripem build nespouští' );

update public.products set pdf_url = 'guides/test.pdf'
 where id = '00000000-0000-0000-0000-0000000006a1';

select is( (select count(*) from public.deploy_hook_dispatches where source = 'products')::int,
           2, 'výměna neveřejného PDF build nespouští' );

-- Agregáty hodnocení přepisuje refresh_product_rating při schválení recenze; rebuild
-- obstará trigger recenzí, produktový se nesmí přidat.
insert into public.orders (id, customer_email, total_amount, status)
values ('00000000-0000-0000-0000-0000000006f1', 'catalog-test@example.com', 100, 'completed');
insert into public.reviews (id, product_id, order_id, reviewer_name, rating, review_text, status, approved_at)
values ('00000000-0000-0000-0000-0000000006e1', '00000000-0000-0000-0000-0000000006a1',
        '00000000-0000-0000-0000-0000000006f1', 'Tester', 5, 'Deset znaku minimalne, katalog.', 'approved', now());

select is( (select review_count from public.products where id = '00000000-0000-0000-0000-0000000006a1'),
           1, 'fixture: schválení recenze agregáty opravdu přepsalo' );
select is( (select count(*) from public.deploy_hook_dispatches where source = 'products')::int,
           2, 'přepočet agregátů hodnocení produktový build nepřidá (obstará ho trigger recenzí)' );

update public.products set is_active = false
 where id = '00000000-0000-0000-0000-0000000006a1';

select is( (select count(*) from public.deploy_hook_dispatches where source = 'products')::int,
           3, 'skrytí průvodce přestaví web (stránka a položka sitemapy musí zmizet)' );

update public.products set is_active = true
 where id = '00000000-0000-0000-0000-0000000006a2';

select is( (select count(*) from public.deploy_hook_dispatches where source = 'products')::int,
           4, 'zveřejnění konceptu přestaví web' );

update public.products set is_deleted = true, deleted_at = now()
 where id = '00000000-0000-0000-0000-0000000006a2';

select is( (select count(*) from public.deploy_hook_dispatches where source = 'products')::int,
           5, 'smazání (soft delete) živého průvodce přestaví web' );

insert into public.products (id, title, description, price, slug)
values ('00000000-0000-0000-0000-0000000006a3', 'Katalog Gone', 'Test description', 100, 'test-catalog-gone');
delete from public.products where id = '00000000-0000-0000-0000-0000000006a3';

select is( (select count(*) from public.deploy_hook_dispatches where source = 'products')::int,
           7, 'přidání a pak tvrdé smazání živého průvodce — každé přestaví web' );
select is( (select count(*) from public.deploy_hook_dispatches
             where source = 'products' and transaction_id = pg_current_xact_id())::int,
           7, 'všechna vyžádání jsou zapsaná k téhle transakci' );

-- ── Kategorie ────────────────────────────────────────────────
insert into public.categories (id, name, slug, updated_at)
values ('00000000-0000-0000-0000-0000000006c1', 'Katalog Test', 'test-catalog-category', now() - interval '1 day');

select is( (select count(*) from public.deploy_hook_dispatches where source = 'categories')::int,
           1, 'nová kategorie přestaví web' );

update public.categories set name = name
 where id = '00000000-0000-0000-0000-0000000006c1';

select is( (select count(*) from public.deploy_hook_dispatches where source = 'categories')::int,
           1, 'uložení kategorie beze změny build nespouští' );

update public.categories set name = 'Katalog Test 2'
 where id = '00000000-0000-0000-0000-0000000006c1';

select is( (select count(*) from public.deploy_hook_dispatches where source = 'categories')::int,
           2, 'přejmenování kategorie přestaví web' );

delete from public.categories where id = '00000000-0000-0000-0000-0000000006c1';

select is( (select count(*) from public.deploy_hook_dispatches where source = 'categories')::int,
           3, 'smazání kategorie přestaví web' );

select * from finish();
rollback;
