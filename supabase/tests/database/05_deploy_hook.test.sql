begin;
select plan(20);

-- ── Struktura ────────────────────────────────────────────────
select has_table('public'::name, 'deploy_hook_dispatches'::name);
select has_function('public'::name, 'trigger_vercel_deploy'::name, array['text']::name[],
                    'sdílený helper deploy hooku existuje');
select has_function('public'::name, 'collect_deploy_hook_results'::name,
                    'sběrač výsledků deploy hooku existuje');

-- Advisor 0028/0029: SECURITY DEFINER funkce, které volá jen trigger nebo cron,
-- nesmí jít zavolat přes RPC anon/authenticated rolemi.
select is( has_function_privilege('anon', 'public.trigger_vercel_deploy(text)', 'EXECUTE'),
           false, 'anon nemá EXECUTE na trigger_vercel_deploy' );
select is( has_function_privilege('authenticated', 'public.trigger_vercel_deploy(text)', 'EXECUTE'),
           false, 'authenticated nemá EXECUTE na trigger_vercel_deploy' );
select is( has_function_privilege('anon', 'public.collect_deploy_hook_results()', 'EXECUTE'),
           false, 'anon nemá EXECUTE na collect_deploy_hook_results' );
select is( has_function_privilege('authenticated', 'public.collect_deploy_hook_results()', 'EXECUTE'),
           false, 'authenticated nemá EXECUTE na collect_deploy_hook_results' );
select is( has_function_privilege('anon', 'public.notify_vercel_blog_publish()', 'EXECUTE'),
           false, 'anon nemá EXECUTE na notify_vercel_blog_publish' );
select is( has_function_privilege('authenticated', 'public.notify_vercel_blog_publish()', 'EXECUTE'),
           false, 'authenticated nemá EXECUTE na notify_vercel_blog_publish' );

-- Baseline dává `ALTER DEFAULT PRIVILEGES … GRANT ALL ON TABLES TO anon`, takže odebrání
-- práv musí být výslovné — tohle je test, že se na to nezapomnělo.
select is( has_table_privilege('anon', 'public.deploy_hook_dispatches', 'SELECT'),
           false, 'anon na záznam dispatchů vůbec nevidí' );
select is( has_table_privilege('authenticated', 'public.deploy_hook_dispatches', 'INSERT'),
           false, 'authenticated do záznamu dispatchů nesmí zapisovat' );
select is( has_table_privilege('authenticated', 'public.deploy_hook_dispatches', 'SELECT'),
           true, 'authenticated smí číst (RLS pak pustí jen admina)' );

-- ── Fixtures ─────────────────────────────────────────────────
-- Tajemství je potřeba, aby helper opravdu odeslal požadavek. pg_net odesílá až po
-- commitu a tenhle test na konci rolluje zpátky, takže ven žádné HTTP neodejde.
select vault.create_secret('https://example.invalid/deploy-hook', 'vercel_deploy_hook');

insert into public.products (id, title, description, price, slug)
values ('00000000-0000-0000-0000-0000000000fa', 'Hook Guide', 'Test description', 100, 'test-guide-deploy-hook');

insert into public.orders (id, customer_email, total_amount, status)
values ('00000000-0000-0000-0000-0000000000f1', 'hook-test1@example.com', 100, 'completed'),
       ('00000000-0000-0000-0000-0000000000f2', 'hook-test2@example.com', 100, 'completed'),
       ('00000000-0000-0000-0000-0000000000f3', 'hook-test3@example.com', 100, 'completed');

-- Přidání živého produktu samo vyžádá rebuild (trigger katalogu, testuje ho 06), a tím by
-- se všechny změny níž jen svezly. Počítání tady začíná až od recenzí.
delete from public.deploy_hook_dispatches;

-- ── Hromadná změna = jediný požadavek (nález R-2) ────────────
-- Tři schválené recenze jedním příkazem: přesně to dělá hromadná akce v adminu
-- (PostgREST pošle jeden DELETE/PATCH s `id=in.(…)`). Dřív to spotřebovalo tři
-- z šedesáti hodinových triggerů Vercelu.
insert into public.reviews (id, product_id, order_id, reviewer_name, rating, review_text, status, approved_at)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000fa',
        '00000000-0000-0000-0000-0000000000f1', 'Tester A', 5, 'Deset znaku minimalne, prvni.', 'approved', now()),
       ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000fa',
        '00000000-0000-0000-0000-0000000000f2', 'Tester B', 4, 'Deset znaku minimalne, druha.', 'approved', now()),
       ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000fa',
        '00000000-0000-0000-0000-0000000000f3', 'Tester C', 5, 'Deset znaku minimalne, treti.', 'approved', now());

select is( (select count(*) from public.deploy_hook_dispatches where request_id is not null)::int,
           1, 'hromadné schválení tří recenzí pošle jediný požadavek' );
select is( (select count(*) from public.deploy_hook_dispatches where skip_reason = 'deduplicated')::int,
           2, 'zbylé dvě změny jsou zapsané jako svezené s prvním požadavkem' );

-- ── Uložení beze změny stavu nedělá nic (regrese `is distinct from`) ──
update public.reviews set status = 'approved'
 where id = '00000000-0000-0000-0000-0000000000e1';

select is( (select count(*) from public.deploy_hook_dispatches)::int,
           3, 'uložení, které stav nemění, nezaloží žádný záznam' );

-- ── Další relevantní změna v téže transakci se sveze ─────────
update public.reviews set status = 'rejected'
 where id = '00000000-0000-0000-0000-0000000000e1';

select is( (select count(*) from public.deploy_hook_dispatches where request_id is not null)::int,
           1, 'i další relevantní změna ve stejné transakci se sveze s prvním požadavkem' );

-- ── Blog sdílí tentýž rozpočet (60 triggerů/h na projekt) ────
insert into public.blog_posts (title, content, slug, published_at)
values ('Hook test', 'Obsah clanku pro test deploy hooku.', 'test-deploy-hook-post', now());

select is( (select count(*) from public.deploy_hook_dispatches
             where source = 'blog_posts' and skip_reason = 'deduplicated')::int,
           1, 'publikace článku v téže transakci se sveze taky — rozpočet je společný' );

-- ── Sběrač: co do TTL nedorazilo, nezůstane viset jako „čeká" ──
update public.deploy_hook_dispatches
   set created_at = now() - interval '7 hours'
 where request_id is not null;

select public.collect_deploy_hook_results();

select is( (select count(*) from public.deploy_hook_dispatches
             where error_message = 'response expired before it was collected'
               and checked_at is not null)::int,
           1, 'odpověď, která nedorazila do šesti hodin, se označí a přestane být otevřená' );

-- ── Chybějící tajemství je vidět (nález R-3) ─────────────────
delete from public.deploy_hook_dispatches;
delete from vault.secrets where name = 'vercel_deploy_hook';
-- Helper na chybějící secret schválně hlásí WARNING; tady je to očekávané, ať to
-- nezaplevelí výstup testů.
set local client_min_messages = error;

update public.reviews set status = 'approved', approved_at = now()
 where id = '00000000-0000-0000-0000-0000000000e1';

select is( (select count(*) from public.deploy_hook_dispatches where skip_reason = 'missing_secret')::int,
           1, 'chybějící vault secret zanechá záznam místo ticha' );
-- `checked_at` se u chybějícího tajemství plní rovnou: není co sbírat, a bez toho by
-- záznam navždy vypadal jako požadavek, který pořád čeká na odpověď.
select is( (select count(*) from public.deploy_hook_dispatches
             where skip_reason = 'missing_secret' and checked_at is not null)::int,
           1, 'a je rovnou uzavřený, ne věčně čekající' );

select * from finish();
rollback;
