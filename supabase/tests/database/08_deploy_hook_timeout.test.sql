begin;
select plan(2);

-- Timeout požadavku na deploy hook (nález K7-3, migrace `…_raise_deploy_hook_timeout.sql`).
--
-- Vercel na hook odpovídá déle než výchozích 5 s pg_net; s nimi končil každý požadavek jako
-- timeout a sběrač ho zbytečně opakoval. Ověřuje se na požadavku, který helper opravdu zařadil
-- do fronty pg_net: s těmihle parametry ho worker po commitu odešle.
--
-- Tajemství je potřeba, aby helper opravdu odeslal požadavek. pg_net odesílá až po
-- commitu a tenhle test na konci rolluje zpátky, takže ven žádné HTTP neodejde.
select vault.create_secret('https://example.invalid/deploy-hook', 'vercel_deploy_hook');
delete from public.deploy_hook_dispatches;

select public.trigger_vercel_deploy('products');

select is( (select q.timeout_milliseconds
              from net.http_request_queue q
              join public.deploy_hook_dispatches d on d.request_id = q.id
             where d.transaction_id = pg_current_xact_id()),
           30000, 'požadavek na deploy hook čeká na odpověď až 30 s' );

-- Helper se kvůli timeoutu přepsal celý, tak ať se nic dalšího v požadavku nezměnilo.
select is( (select q.method || ' ' || q.url || ' ' || q.headers::text || ' ' || convert_from(q.body, 'UTF8')
              from net.http_request_queue q
              join public.deploy_hook_dispatches d on d.request_id = q.id
             where d.transaction_id = pg_current_xact_id()),
           'POST https://example.invalid/deploy-hook {"Content-Type": "application/json"} {}',
           'jinak je požadavek stejný: POST na adresu z vaultu, JSON hlavička, prázdné tělo' );

select * from finish();
rollback;
