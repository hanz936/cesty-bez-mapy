begin;
select plan(56);

-- Opakování neúspěšného deploy hooku a uzavírání deduplikovaných řádků (nálezy M-2 a M-4
-- finální revize, migrace 20260930130503).
--
-- Sběrač se tu volá nad SYNTETICKÝMI řádky: odeslaný požadavek + odpověď v net._http_response,
-- `created_at` vztažené k now(). Syntetické řádky mají vymyšlené transaction_id — v produkci
-- běží sběrač ve vlastní transakci cronu a řádky, které při opakování zapíše, jsou jediné
-- s jejím id. Test je jedna transakce, takže kdyby syntetické řádky nesly id té testovací,
-- označil by je sběrač taky. Mezi scénáři se tabulka vždy vyprázdní ze stejného důvodu.
--
-- Tajemství je potřeba, aby helper opravdu odeslal požadavek. pg_net odesílá až po
-- commitu a tenhle test na konci rolluje zpátky, takže ven žádné HTTP neodejde.
select vault.create_secret('https://example.invalid/deploy-hook', 'vercel_deploy_hook');

-- Odeslaný požadavek (a odpověď, pokud je `p_status` nebo `p_error`). Id požadavku je
-- zároveň syntetické transaction_id; čísla od 9 000 000 se s těmi skutečnými nepotkají.
create function pg_temp.sent(p_request_id bigint, p_age interval, p_status integer,
                             p_headers jsonb default null, p_error text default null,
                             p_retry_of uuid default null) returns uuid
language plpgsql as $$
declare
  new_id uuid := gen_random_uuid();
begin
  insert into public.deploy_hook_dispatches (id, source, transaction_id, request_id, created_at, retry_of)
  values (new_id, 'products', p_request_id::text::xid8, p_request_id, now() - p_age, p_retry_of);
  if p_status is not null or p_error is not null then
    insert into net._http_response (id, status_code, headers, error_msg, timed_out, created)
    values (p_request_id, p_status, p_headers, p_error, p_error is not null, now() - p_age);
  end if;
  return new_id;
end;
$$;

-- Počet automatických opakování (řádků s retry_of), které zapsal sběrač v téhle transakci.
create function pg_temp.retries() returns integer language sql as $$
  select count(*)::int from public.deploy_hook_dispatches
   where retry_of is not null and transaction_id = pg_current_xact_id()
$$;

create function pg_temp.reset() returns void language sql as $$
  delete from public.deploy_hook_dispatches;
  delete from net._http_response where id >= 9000000;
$$;

-- ── Struktura ────────────────────────────────────────────────
select has_column('public'::name, 'deploy_hook_dispatches'::name, 'retry_of'::name, 'sloupec retry_of existuje');
select col_type_is('public'::name, 'deploy_hook_dispatches'::name, 'retry_of'::name, 'uuid', 'retry_of je uuid');
select has_column('public'::name, 'deploy_hook_dispatches'::name, 'retry_allowed_at'::name, 'sloupec retry_allowed_at existuje');
select col_type_is('public'::name, 'deploy_hook_dispatches'::name, 'retry_allowed_at'::name, 'timestamp with time zone',
                   'retry_allowed_at je timestamptz');
select fk_ok('public'::name, 'deploy_hook_dispatches'::name, 'retry_of'::name,
             'public'::name, 'deploy_hook_dispatches'::name, 'id'::name);
select is( (select confdeltype from pg_constraint
             where conname = 'deploy_hook_dispatches_retry_of_fkey'
               and conrelid = 'public.deploy_hook_dispatches'::regclass),
           'n'::"char", 'FK deploy_hook_dispatches_retry_of_fkey má ON DELETE SET NULL (úklid po 90 dnech)' );
select has_index('public'::name, 'deploy_hook_dispatches'::name, 'idx_deploy_hook_dispatches_retry_of'::name,
                 array['retry_of']::name[], 'cizí klíč retry_of má index (Supabase advisor)');
select isnt( col_description('public.deploy_hook_dispatches'::regclass,
               (select attnum from pg_attribute where attrelid = 'public.deploy_hook_dispatches'::regclass and attname = 'retry_of')),
             null, 'retry_of má komentář' );
select isnt( col_description('public.deploy_hook_dispatches'::regclass,
               (select attnum from pg_attribute where attrelid = 'public.deploy_hook_dispatches'::regclass and attname = 'retry_allowed_at')),
             null, 'retry_allowed_at má komentář' );
select matches( col_description('public.deploy_hook_dispatches'::regclass,
                  (select attnum from pg_attribute where attrelid = 'public.deploy_hook_dispatches'::regclass and attname = 'checked_at')),
                'closed immediately', 'komentář checked_at říká, že přeskočené řádky jsou uzavřené hned' );

-- Práva a vlastnosti obou funkcí se znovu-vytvořením nesmí změnit.
select is( has_function_privilege('anon', 'public.trigger_vercel_deploy(text)', 'EXECUTE'),
           false, 'anon nemá EXECUTE na trigger_vercel_deploy' );
select is( has_function_privilege('authenticated', 'public.trigger_vercel_deploy(text)', 'EXECUTE'),
           false, 'authenticated nemá EXECUTE na trigger_vercel_deploy' );
select is( has_function_privilege('anon', 'public.collect_deploy_hook_results()', 'EXECUTE'),
           false, 'anon nemá EXECUTE na collect_deploy_hook_results' );
select is( has_function_privilege('authenticated', 'public.collect_deploy_hook_results()', 'EXECUTE'),
           false, 'authenticated nemá EXECUTE na collect_deploy_hook_results' );
select is( (select array_agg(p.proname::text || ':' || p.prosecdef::text || ':' || pg_get_userbyid(p.proowner)
                             || ':' || array_to_string(p.proconfig, ',') order by p.proname)
              from pg_proc p
             where p.pronamespace = 'public'::regnamespace
               and p.proname in ('trigger_vercel_deploy', 'collect_deploy_hook_results')),
           array['collect_deploy_hook_results:true:postgres:search_path=""',
                 'trigger_vercel_deploy:true:postgres:search_path=""'],
           'obě funkce: SECURITY DEFINER, vlastník postgres, prázdný search_path' );
select is( (select count(*)::int from cron.job
             where jobname = 'collect-deploy-hook-results' and schedule = '*/15 * * * *'),
           1, 'cron sběrače zůstává jediný a každých 15 minut' );

-- ── M-4: deduplikovaný řádek je rovnou uzavřený ──────────────
select pg_temp.reset();
select public.trigger_vercel_deploy('products');
select public.trigger_vercel_deploy('categories');

select is( (select count(*)::int from public.deploy_hook_dispatches where request_id is not null),
           1, 'první volání v transakci odešle požadavek' );
select is( (select count(*)::int from public.deploy_hook_dispatches
             where skip_reason = 'deduplicated' and checked_at is not null),
           1, 'deduplikovaný řádek má checked_at hned — „null" znamená jen čekající odpověď' );

-- ── 503: přechodná chyba → právě jedno opakování ─────────────
select pg_temp.reset();
select pg_temp.sent(9000001, interval '20 minutes', 503);
select public.collect_deploy_hook_results();

select is( (select status_code from public.deploy_hook_dispatches where request_id = 9000001),
           503, '503 se ze sběru zapíše k požadavku' );
select is( pg_temp.retries(), 1, '503 → právě jeden opakovaný požadavek' );
select is( (select retry_of from public.deploy_hook_dispatches where transaction_id = pg_current_xact_id()),
           (select id from public.deploy_hook_dispatches where request_id = 9000001),
           'opakování ukazuje retry_of na neúspěšný požadavek' );
select ok( (select request_id is not null and skip_reason is null and source = 'products'
              from public.deploy_hook_dispatches where transaction_id = pg_current_xact_id()),
           'opakování se opravdu odeslalo (request_id), pod stejným zdrojem' );

-- ── Timeout / síťová chyba (bez status kódu) → opakování ─────
select pg_temp.reset();
select pg_temp.sent(9000002, interval '20 minutes', null, null, 'Timeout of 5000 ms reached');
select public.collect_deploy_hook_results();
select is( pg_temp.retries(), 1, 'požadavek bez odpovědi (timeout) se zopakuje' );

-- ── 408 → opakování ──────────────────────────────────────────
select pg_temp.reset();
select pg_temp.sent(9000003, interval '20 minutes', 408);
select public.collect_deploy_hook_results();
select is( pg_temp.retries(), 1, '408 se zopakuje' );

-- ── 404: trvalá chyba → žádné opakování ──────────────────────
select pg_temp.reset();
select pg_temp.sent(9000004, interval '20 minutes', 404);
select public.collect_deploy_hook_results();
select is( pg_temp.retries(), 0, '404 (smazaný hook) se neopakuje' );

-- ── 2xx → žádné opakování ────────────────────────────────────
select pg_temp.reset();
select pg_temp.sent(9000005, interval '20 minutes', 201);
select public.collect_deploy_hook_results();
select is( pg_temp.retries(), 0, 'úspěšný požadavek se neopakuje' );

-- ── Čekající odpověď → nic ───────────────────────────────────
select pg_temp.reset();
select pg_temp.sent(9000006, interval '20 minutes', 500);
select pg_temp.sent(9000007, interval '5 minutes', null);
select public.collect_deploy_hook_results();
select is( pg_temp.retries(), 0, 'nejnovější požadavek ještě čeká → neopakuje se ani starší 500' );
select is( (select checked_at from public.deploy_hook_dispatches where request_id = 9000007),
           null, 'čekající požadavek zůstává otevřený' );

-- ── 429 s x-ratelimit-reset v budoucnu → čekat ───────────────
select pg_temp.reset();
select pg_temp.sent(9000008, interval '20 minutes', 429,
  jsonb_build_object('x-ratelimit-limit', '60', 'x-ratelimit-remaining', '0',
                     'x-ratelimit-reset', extract(epoch from now() + interval '40 minutes')::bigint::text));
select public.collect_deploy_hook_results();
select is( pg_temp.retries(), 0, '429 s resetem limitu v budoucnu se zatím neopakuje' );
select is( (select retry_allowed_at from public.deploy_hook_dispatches where request_id = 9000008),
           to_timestamp(extract(epoch from now() + interval '40 minutes')::bigint),
           'retry_allowed_at = x-ratelimit-reset (epoch sekundy)' );

-- ── 429 s resetem v minulosti → opakovat ─────────────────────
select pg_temp.reset();
select pg_temp.sent(9000009, interval '20 minutes', 429,
  jsonb_build_object('x-ratelimit-reset', extract(epoch from now() - interval '1 minute')::bigint::text));
select public.collect_deploy_hook_results();
select is( pg_temp.retries(), 1, '429, jehož reset už minul, se zopakuje' );

-- ── Retry-After má přednost před x-ratelimit-reset ───────────
-- Retry-After jsou sekundy „after receiving the response" (RFC 9110), takže se počítají
-- od uložení odpovědi (`created`), ne od běhu sběrače. Obě odpovědi jsou 20 minut staré.
-- Hodina od přijetí ještě neuběhla, i když reset limitu už minul → čekat.
select pg_temp.reset();
select pg_temp.sent(9000010, interval '20 minutes', 429,
  jsonb_build_object('retry-after', '3600',
                     'x-ratelimit-reset', extract(epoch from now() - interval '1 minute')::bigint::text));
select public.collect_deploy_hook_results();
select is( (select retry_allowed_at from public.deploy_hook_dispatches where request_id = 9000010),
           now() - interval '20 minutes' + interval '3600 seconds',
           'Retry-After (sekundy) vyhrává nad x-ratelimit-reset a počítá se od přijetí odpovědi' );
select is( pg_temp.retries(), 0, 'a podle něj se zatím neopakuje' );

-- Dvě minuty od přijetí uběhly dávno, i když reset limitu je až za 40 minut → opakovat.
-- S časem běhu sběrače místo `created` by se čekalo ještě dvě minuty a neopakovalo by se.
select pg_temp.reset();
select pg_temp.sent(9000038, interval '20 minutes', 429,
  jsonb_build_object('retry-after', '120',
                     'x-ratelimit-reset', extract(epoch from now() + interval '40 minutes')::bigint::text));
select public.collect_deploy_hook_results();
select is( (select retry_allowed_at from public.deploy_hook_dispatches where request_id = 9000038),
           now() - interval '20 minutes' + interval '120 seconds',
           'krátký Retry-After vyhrává i nad resetem v budoucnu' );
select is( pg_temp.retries(), 1, 'Retry-After uběhl od přijetí odpovědi → právě jedno opakování' );

-- ── Hlavičky z HTTP/1.1: jména s velkými písmeny ─────────────
-- pg_net ukládá jména hlaviček tak, jak přišla; přes HTTP/1.1 je Vercel posílá s velkými
-- písmeny. RFC 9110: „Field names are case-insensitive".
select pg_temp.reset();
select pg_temp.sent(9000039, interval '20 minutes', 429,
  jsonb_build_object('Retry-After', '3600',
                     'X-Ratelimit-Reset', extract(epoch from now() - interval '1 minute')::bigint::text));
select public.collect_deploy_hook_results();
select is( (select retry_allowed_at from public.deploy_hook_dispatches where request_id = 9000039),
           now() - interval '20 minutes' + interval '3600 seconds',
           '`Retry-After` s velkými písmeny platí stejně jako `retry-after`' );

select pg_temp.reset();
select pg_temp.sent(9000040, interval '20 minutes', 429,
  jsonb_build_object('X-Ratelimit-Limit', '60', 'X-Ratelimit-Remaining', '0',
                     'X-Ratelimit-Reset', extract(epoch from now() + interval '40 minutes')::bigint::text));
select public.collect_deploy_hook_results();
select is( (select retry_allowed_at from public.deploy_hook_dispatches where request_id = 9000040),
           to_timestamp(extract(epoch from now() + interval '40 minutes')::bigint),
           '`X-Ratelimit-Reset` s velkými písmeny platí stejně jako `x-ratelimit-reset`' );
select is( pg_temp.retries(), 0, 'a podle něj se zatím neopakuje' );

-- ── Hlavičky, které nejsou JSON objekt ───────────────────────
-- `jsonb_each_text` na poli skončí chybou; ta by shodila celý běh sběrače každých 15 minut.
select pg_temp.reset();
select pg_temp.sent(9000041, interval '20 minutes', 429, '[]'::jsonb);
select lives_ok( $$ select public.collect_deploy_hook_results() $$,
                 'sběrač nespadne, když hlavičky nejsou JSON objekt' );
select ok( (select status_code = 429 and checked_at is not null and retry_allowed_at is null
              from public.deploy_hook_dispatches where request_id = 9000041),
           'odpověď se sebrala a retry_allowed_at zůstal null' );

-- Nečíselný Retry-After (HTTP datum) se ignoruje a platí x-ratelimit-reset.
select pg_temp.reset();
select pg_temp.sent(9000011, interval '20 minutes', 429,
  jsonb_build_object('retry-after', 'Wed, 21 Oct 2099 07:28:00 GMT',
                     'x-ratelimit-reset', extract(epoch from now() - interval '1 minute')::bigint::text));
select public.collect_deploy_hook_results();
select is( (select retry_allowed_at from public.deploy_hook_dispatches where request_id = 9000011),
           to_timestamp(extract(epoch from now() - interval '1 minute')::bigint),
           'nečíselný Retry-After se ignoruje, platí x-ratelimit-reset' );
select is( pg_temp.retries(), 1, 'a protože reset minul, opakuje se' );

-- 429 bez hlaviček: retry_allowed_at zůstane null a opakuje se podle odstupu.
select pg_temp.reset();
select pg_temp.sent(9000012, interval '20 minutes', 429);
select public.collect_deploy_hook_results();
select is( (select retry_allowed_at from public.deploy_hook_dispatches where request_id = 9000012),
           null, '429 bez hlaviček retry_allowed_at nevyplní' );

-- ── Odstup: 15 → 30 min ──────────────────────────────────────
-- Jedno dřívější opakování před 20 minutami: další je na řadě až po 30 (minus minuta).
select pg_temp.reset();
select pg_temp.sent(9000013, interval '60 minutes', 503);
select pg_temp.sent(9000014, interval '20 minutes', 503, null, null,
                    (select id from public.deploy_hook_dispatches where request_id = 9000013));
select public.collect_deploy_hook_results();
select is( pg_temp.retries(), 0, 'po jednom opakování před 20 min ještě není na řadě další (odstup 30 min)' );

select pg_temp.reset();
select pg_temp.sent(9000015, interval '90 minutes', 503);
select pg_temp.sent(9000016, interval '31 minutes', 503, null, null,
                    (select id from public.deploy_hook_dispatches where request_id = 9000015));
select public.collect_deploy_hook_results();
select is( pg_temp.retries(), 1, 'po 31 minutách už ano' );
select is( (select retry_of from public.deploy_hook_dispatches where transaction_id = pg_current_xact_id()),
           (select id from public.deploy_hook_dispatches where request_id = 9000016),
           'nové opakování ukazuje na nejnovější neúspěšný požadavek' );

-- První pokus: 14 min po neúspěchu ještě ne (odstup 15 min minus minuta rezervy).
select pg_temp.reset();
select pg_temp.sent(9000017, interval '13 minutes', 503);
select public.collect_deploy_hook_results();
select is( pg_temp.retries(), 0, 'první opakování nejdřív 14 minut po neúspěchu' );

-- ── Po 24 hodinách od původního požadavku změny se to vzdá ───
select pg_temp.reset();
select pg_temp.sent(9000018, interval '25 hours', 503);
select pg_temp.sent(9000019, interval '5 hours', 503, null, null,
                    (select id from public.deploy_hook_dispatches where request_id = 9000018));
select public.collect_deploy_hook_results();
select is( pg_temp.retries(), 0, 'změna, jejíž původní požadavek je starší než 24 h, se už neopakuje (ani po pozdějším pokusu)' );

-- ── Novější úspěch → nic ─────────────────────────────────────
select pg_temp.reset();
select pg_temp.sent(9000020, interval '60 minutes', 503);
select pg_temp.sent(9000021, interval '30 minutes', 200);
select public.collect_deploy_hook_results();
select is( pg_temp.retries(), 0, 'po neúspěchu přišel úspěch → web je aktuální, neopakuje se' );

-- Nová změna po úspěchu začíná s odstupem od 15 minut, i když ta předchozí měla opakování
-- (pokusy se počítají od původního požadavku nejnovější změny, ne od posledního úspěchu).
select pg_temp.reset();
select pg_temp.sent(9000022, interval '3 hours', 503);
select pg_temp.sent(9000023, interval '160 minutes', 503, null, null,
                    (select id from public.deploy_hook_dispatches where request_id = 9000022));
select pg_temp.sent(9000024, interval '150 minutes', 200);
select pg_temp.sent(9000025, interval '16 minutes', 503);
select public.collect_deploy_hook_results();
select is( pg_temp.retries(), 1, 'nová změna po úspěchu: pokusy se počítají znovu od nuly' );

-- ── Rozpočet opakování patří jedné změně (N-2) ───────────────
-- Série starší než 24 h to vzdala a od té doby nic neuspělo. Nová změna, jejíž původní
-- požadavek selže přechodně, se přesto zopakuje — má vlastních 24 hodin.
select pg_temp.reset();
select pg_temp.sent(9000030, interval '30 hours', 404);
select pg_temp.sent(9000031, interval '26 hours', 503);
select pg_temp.sent(9000032, interval '25 hours', 503, null, null,
                    (select id from public.deploy_hook_dispatches where request_id = 9000031));
select pg_temp.sent(9000033, interval '20 minutes', 429);
select public.collect_deploy_hook_results();
select is( pg_temp.retries(), 1,
           'nová změna po vzdané sérii (a bez úspěchu mezi tím) dostane vlastní opakování' );

-- Nová změna uprostřed odstupu předchozí: dvě opakování staré změny (další až po 60 min),
-- ale nový původní požadavek selhal před 16 minutami → odstup začíná znovu od 15 minut.
select pg_temp.reset();
select pg_temp.sent(9000034, interval '3 hours', 503);
select pg_temp.sent(9000035, interval '165 minutes', 503, null, null,
                    (select id from public.deploy_hook_dispatches where request_id = 9000034));
select pg_temp.sent(9000036, interval '135 minutes', 503, null, null,
                    (select id from public.deploy_hook_dispatches where request_id = 9000035));
select pg_temp.sent(9000037, interval '16 minutes', 503);
select public.collect_deploy_hook_results();
select is( (select retry_of from public.deploy_hook_dispatches where transaction_id = pg_current_xact_id()),
           (select id from public.deploy_hook_dispatches where request_id = 9000037),
           'nová změna uprostřed odstupu: odstup začíná znovu od 15 minut a opakuje se ona' );

-- ── Chybějící tajemství během opakování ──────────────────────
select pg_temp.reset();
delete from vault.secrets where name = 'vercel_deploy_hook';
-- Helper na chybějící secret schválně hlásí WARNING; tady je to očekávané.
set local client_min_messages = error;
select pg_temp.sent(9000026, interval '60 minutes', 503);
select public.collect_deploy_hook_results();

select is( (select count(*)::int from public.deploy_hook_dispatches
             where skip_reason = 'missing_secret' and checked_at is not null
               and retry_of = (select id from public.deploy_hook_dispatches where request_id = 9000026)),
           1, 'opakování bez tajemství zanechá uzavřený řádek missing_secret s retry_of' );

-- Pokus se počítá, i když se neodeslal: hned další běh nic nepošle…
select public.collect_deploy_hook_results();
select is( pg_temp.retries(), 1, 'další běh hned potom nic nezapíše' );

-- …ani po 20 minutách (odstup je teď 30), ale po 31 ano.
update public.deploy_hook_dispatches set created_at = now() - interval '20 minutes'
 where transaction_id = pg_current_xact_id();
select public.collect_deploy_hook_results();
select is( pg_temp.retries(), 1, 'po nepodařeném opakování se odstup zdvojí (20 min nestačí)' );

update public.deploy_hook_dispatches set created_at = now() - interval '31 minutes'
 where transaction_id = pg_current_xact_id();
select public.collect_deploy_hook_results();
select is( pg_temp.retries(), 2, 'po 31 minutách přijde druhý pokus' );

select * from finish();
rollback;
