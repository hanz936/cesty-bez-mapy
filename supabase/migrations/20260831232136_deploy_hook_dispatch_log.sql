-- One deploy hook request per transaction, plus a durable record of every dispatch.
--
-- Two problems with the row-level triggers that fire the Vercel deploy hook:
--
--   1. No debounce. `for each row` sent one request per changed row, so a single bulk
--      statement (the admin Datagrid issues one PostgREST DELETE/PATCH with `id=in.(…)`)
--      spent one deploy hook trigger per row. Vercel allows 60 triggers per hour **per
--      project, across all deploy hooks** (docs re-read 2026-08-31) — a budget the
--      reviews trigger shares with the blog trigger, because both read the same
--      `vercel_deploy_hook` vault secret.
--   2. Silent failure. `net.http_post` returns a request id that was thrown away, and a
--      missing vault secret was an `if` branch that did nothing at all. Responses live in
--      `net._http_response` for 6 hours and then vanish (unlogged table), so a hook that
--      never fired left no trace anywhere.
--
-- The fix follows the `request_wrapper` / `request_tracker` pattern from pg_net's own
-- README: a shared helper records every dispatch in a durable table and uses that same
-- table to send at most one request per transaction.
--
-- Deduplikace je schválně per TRANSAKCE, ne časová. Časové okno („neposílej dřív než za
-- minutu") umí zahodit poslední změnu a nechat web natrvalo zastaralý; per-transakční
-- pojistka rebuild nikdy neztratí — každá transakce, která sáhne na veřejný obsah, pošle
-- právě jeden požadavek. Sekvenční schvalování (pět kliknutí po sobě) tedy pošle pět
-- požadavků, a to je správně: Vercel předchozí nasazení pro tentýž hook sám ruší, takže
-- se srazí v jeden build.

create table if not exists "public"."deploy_hook_dispatches" (
    "id" "uuid" default "gen_random_uuid"() not null,
    "source" "text" not null,
    "transaction_id" "xid8" not null,
    "request_id" bigint,
    "skip_reason" "text",
    "status_code" integer,
    "error_message" "text",
    "created_at" timestamp with time zone default "now"() not null,
    "checked_at" timestamp with time zone,
    constraint "deploy_hook_dispatches_pkey" primary key ("id"),
    constraint "deploy_hook_dispatches_source_check"
        check ("source" in ('reviews', 'blog_posts')),
    constraint "deploy_hook_dispatches_skip_reason_check"
        check ("skip_reason" is null or "skip_reason" in ('deduplicated', 'missing_secret')),
    -- Buď se požadavek odeslal (request_id), nebo je zapsáno proč ne (skip_reason).
    -- Nikdy obojí a nikdy ani jedno.
    constraint "deploy_hook_dispatches_request_id_check"
        check (("request_id" is null) <> ("skip_reason" is null))
);

alter table "public"."deploy_hook_dispatches" owner to "postgres";

comment on table "public"."deploy_hook_dispatches" is 'Durable record of every Vercel deploy hook dispatch (pg_net keeps responses for 6 hours only)';
comment on column "public"."deploy_hook_dispatches"."source" is 'Which trigger asked for the rebuild: reviews, blog_posts';
comment on column "public"."deploy_hook_dispatches"."transaction_id" is 'Transaction that caused the change; at most one request is sent per transaction';
comment on column "public"."deploy_hook_dispatches"."request_id" is 'net.http_post request id; null when no request was sent (see skip_reason)';
comment on column "public"."deploy_hook_dispatches"."skip_reason" is 'Why no request was sent: deduplicated (an earlier change in the same transaction already sent one), missing_secret';
comment on column "public"."deploy_hook_dispatches"."status_code" is 'HTTP status collected from net._http_response by collect_deploy_hook_results()';
comment on column "public"."deploy_hook_dispatches"."checked_at" is 'When the outcome was collected; null means the response is still pending';

-- Horká cesta: pojistku čte trigger u KAŽDÉHO dotčeného řádku, proto parciální index
-- jen nad řádky, které opravdu něco odeslaly — jen ty pojistka hledá.
create index if not exists "idx_deploy_hook_dispatches_transaction_id_sent"
    on "public"."deploy_hook_dispatches" using "btree" ("transaction_id")
    where ("request_id" is not null);
create index if not exists "idx_deploy_hook_dispatches_created_at"
    on "public"."deploy_hook_dispatches" using "btree" ("created_at" desc);

alter table "public"."deploy_hook_dispatches" enable row level security;

-- Provozní záznam, ne veřejná data. `ALTER DEFAULT PRIVILEGES` v baseline dává nové
-- tabulce GRANT ALL i anonovi, takže se to musí výslovně odebrat — RLS by ho sice
-- zastavila, ale spoléhat se na jedinou vrstvu tu nechceme.
revoke all on table "public"."deploy_hook_dispatches" from "anon";
revoke all on table "public"."deploy_hook_dispatches" from "authenticated";
grant select on table "public"."deploy_hook_dispatches" to "authenticated";

drop policy if exists "deploy_hook_dispatches_admin_select" on "public"."deploy_hook_dispatches";
create policy "deploy_hook_dispatches_admin_select" on "public"."deploy_hook_dispatches"
    for select to "authenticated" using ((select "public"."is_admin"()));

-- Jediné místo, které umí poslat deploy hook. Oba triggery (recenze i blog) si dál samy
-- rozhodují, co je pro ně relevantní změna, a tuhle funkci pak jen zavolají.
--
-- Vědomě BEZ `exception when others` kolem zápisu: obal by sice ochránil schválení
-- recenze před chybou při logování, ale plpgsql blok s výjimkou je subtransakce, takže
-- by při rollbacku zahodil i zařazený net.http_post — zůstal by zapsaný obsah, nepřestavěný
-- web a jen warning, který nikdo nečte. To je přesně ta tichost, kterou tahle migrace ruší.
-- Cesty k selhání jsou tu navíc jen schémové (chybějící tabulka, porušený check), a ty mají
-- padat hlasitě a hned.
create or replace function "public"."trigger_vercel_deploy"("p_source" "text") returns void
    language "plpgsql" security definer
    set "search_path" to ''
    as $$
declare
  hook_url text;
  sent_request_id bigint;
begin
  -- Poslali jsme už v téhle transakci? Pak jen zapiš, že se změna svezla s předchozím
  -- požadavkem: jeden build přestaví celý web, víc jich nic nepřidá.
  if exists (
    select 1 from public.deploy_hook_dispatches
     where transaction_id = pg_catalog.pg_current_xact_id()
       and request_id is not null
  ) then
    insert into public.deploy_hook_dispatches ("source", "transaction_id", "skip_reason")
    values (p_source, pg_catalog.pg_current_xact_id(), 'deduplicated');
    return;
  end if;

  select decrypted_secret into hook_url
  from vault.decrypted_secrets
  where name = 'vercel_deploy_hook';

  if hook_url is null then
    -- Nahlas. Bez tajemství se web nepřestaví NIKDY a dřív po tom nezůstala ani stopa.
    raise warning 'deploy hook secret "vercel_deploy_hook" is missing; % change will not be published', p_source;
    insert into public.deploy_hook_dispatches ("source", "transaction_id", "skip_reason", "checked_at")
    values (p_source, pg_catalog.pg_current_xact_id(), 'missing_secret', pg_catalog.now());
    return;
  end if;

  sent_request_id := net.http_post(
    url := hook_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );

  insert into public.deploy_hook_dispatches ("source", "transaction_id", "request_id")
  values (p_source, pg_catalog.pg_current_xact_id(), sent_request_id);
end;
$$;

alter function "public"."trigger_vercel_deploy"("p_source" "text") owner to "postgres";
-- Volají ji jen SECURITY DEFINER triggery běžící jako postgres; přes RPC nemá co dělat.
revoke all on function "public"."trigger_vercel_deploy"("p_source" "text") from public, "anon", "authenticated";

-- Výsledek požadavku žije v net._http_response jen 6 hodin (unlogged tabulka), takže ho
-- včas přepíšeme k sobě. Bez toho se o 429 z Vercelu (vyčerpaný limit 60/h) ani o výpadek
-- nikdo nikdy nedozví — přesně to je nález R-3.
create or replace function "public"."collect_deploy_hook_results"() returns void
    language "plpgsql" security definer
    set "search_path" to ''
    as $$
begin
  update public.deploy_hook_dispatches d
     set status_code = r.status_code,
         error_message = r.error_msg,
         checked_at = pg_catalog.now()
    from net._http_response r
   where r.id = d.request_id
     and d.checked_at is null;

  -- Co do TTL nedorazilo, už nedorazí — ať to nezůstane viset navždy jako „čeká".
  update public.deploy_hook_dispatches
     set error_message = 'response expired before it was collected',
         checked_at = pg_catalog.now()
   where checked_at is null
     and request_id is not null
     and created_at < pg_catalog.now() - interval '6 hours';

  delete from public.deploy_hook_dispatches
   where created_at < pg_catalog.now() - interval '90 days';
end;
$$;

alter function "public"."collect_deploy_hook_results"() owner to "postgres";
revoke all on function "public"."collect_deploy_hook_results"() from public, "anon", "authenticated";

-- Každých 15 minut, tedy hluboko pod šestihodinovou TTL odpovědí.
select "cron"."schedule"(
  'collect-deploy-hook-results',
  '*/15 * * * *',
  $$select public.collect_deploy_hook_results()$$
);

-- Oba triggery nově jen rozhodnou o relevanci a zbytek předají sdílenému helperu.
-- Logika relevance zůstává BEZE ZMĚNY.
create or replace function "public"."notify_vercel_reviews_change"() returns "trigger"
    language "plpgsql" security definer
    set "search_path" to ''
    as $$
declare
  is_relevant boolean;
begin
  -- Only approved rows are public, so only transitions into or out of
  -- 'approved' can change what the prerendered pages contain.
  -- `is distinct from` je nutné: `UPDATE OF status` firuje, kdykoli je sloupec
  -- v SET listu, i když se hodnota nemění. Admin formulář (ReviewEdit transform)
  -- posílá `status` při KAŽDÉM uložení, takže bez téhle podmínky by i pouhá
  -- úprava interní poznámky spustila produkční build.
  is_relevant :=
       (TG_OP = 'INSERT' and NEW.status = 'approved')
    or (TG_OP = 'UPDATE' and OLD.status is distinct from NEW.status
        and (NEW.status = 'approved' or OLD.status = 'approved'))
    or (TG_OP = 'DELETE' and OLD.status = 'approved');

  if is_relevant then
    perform public.trigger_vercel_deploy('reviews');
  end if;

  return coalesce(NEW, OLD);
end;
$$;

create or replace function "public"."notify_vercel_blog_publish"() returns "trigger"
    language "plpgsql" security definer
    set "search_path" to ''
    as $$
declare
  is_relevant boolean;
begin
  -- Rebuild jen kdyz se to dotyka publikovaneho obsahu
  -- (novy/upraveny/smazany publikovany, vc. prechodu koncept<->publikovano).
  is_relevant :=
       (TG_OP = 'INSERT' and NEW.published_at is not null)
    or (TG_OP = 'UPDATE' and (NEW.published_at is not null or OLD.published_at is not null))
    or (TG_OP = 'DELETE' and OLD.published_at is not null);

  if is_relevant then
    perform public.trigger_vercel_deploy('blog_posts');
  end if;

  return coalesce(NEW, OLD);
end;
$$;
