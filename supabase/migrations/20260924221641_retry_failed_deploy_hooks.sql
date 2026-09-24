-- Retry a deploy hook request that failed for a transient reason, and close deduplicated rows.
--
-- M-2 (final review 2026-09-24): after 20260923202547 every save of a live product, a
-- category, a review or a blog post sends one deploy hook request. Vercel allows 60 hook
-- triggers per hour per project, across all deploy hooks (docs re-read 2026-09-24), and the
-- Hobby plan 100 deployments per day. If the LAST request of an editing session fails
-- (a 429 from that limit, a 5xx, a timeout), nothing rebuilds the static site until some
-- unrelated change comes along — the collector recorded the status, but nobody acted on it.
--
-- Oprava: sběrač (pg_cron každých 15 minut) teď po sběru výsledků nejnovější odeslaný
-- požadavek zkontroluje a když skončil PŘECHODNOU chybou, pošle ho znovu. Je to obnova po
-- chybě, ne časový debounce — per-transakční deduplikace z 20260901075731 zůstává, jak je.
-- Znovu stačí poslat jen ten poslední: build přestaví celý web a Vercel předchozí nasazení
-- pro tentýž hook sám ruší („previous deployments for the same Deploy Hook will be
-- canceled"), takže starší neúspěchy nic nepřidají.
--
-- Pravidla (rozhodnutí usera 2026-09-24):
--   * jen přechodné chyby: bez odpovědi (síť, timeout, propadlá odpověď), 408, 429, 5xx.
--     Jiné 4xx (třeba 404 = smazaný hook) jsou trvalé, opakování by jen pálilo limit
--     (Google Cloud, retry strategy: 408/429/5xx a timeouty ano, ostatní chtějí změnu konfigurace);
--   * exponenciální odstup 15 → 30 → 60 → 120 → 240 min… od posledního pokusu, minuta
--     rezervy na rozjezd cronu;
--   * 429 nese `Retry-After` nebo `x-ratelimit-reset` (Vercel posílá `x-ratelimit-limit: 60`,
--     `x-ratelimit-remaining`, `x-ratelimit-reset` v epoch sekundách, ≈ +3600 s; ověřeno
--     v produkci) → dřív se neposílá;
--   * po 24 hodinách od prvního neúspěšného požadavku série to vzdá — dál je to věc pro
--     člověka (plánovaný panel v adminu), ne pro nekonečné opakování;
--   * nejvýš jeden opakovaný požadavek na běh sběrače.
--
-- M-4: řádky `deduplicated` zůstávaly navždy s `checked_at = null`, přestože komentář
-- sloupce říká, že null = odpověď ještě čeká. `missing_secret` se uzavíral rovnou, teď
-- i `deduplicated` — a dosavadní řádky se dorovnají.
--
-- Migrace je OPAKOVATELNÁ a bez vlastního BEGIN/COMMIT, stejně jako ostatní dosud
-- nenasazené migrace této větve (`apply_migration` transakčnost nedokumentuje).

-- ── 1. Nové sloupce ─────────────────────────────────────────────────────────
alter table "public"."deploy_hook_dispatches" add column if not exists "retry_of" "uuid";
alter table "public"."deploy_hook_dispatches" add column if not exists "retry_allowed_at" timestamp with time zone;

alter table "public"."deploy_hook_dispatches"
    drop constraint if exists "deploy_hook_dispatches_retry_of_fkey";
alter table "public"."deploy_hook_dispatches"
    add constraint "deploy_hook_dispatches_retry_of_fkey"
    foreign key ("retry_of") references "public"."deploy_hook_dispatches"("id") on delete set null;

-- Supabase advisor hlásí cizí klíče bez indexu (a mazání po 90 dnech by bez něj
-- u každého řádku procházelo celou tabulku kvůli `on delete set null`).
create index if not exists "idx_deploy_hook_dispatches_retry_of"
    on "public"."deploy_hook_dispatches" using "btree" ("retry_of");

comment on column "public"."deploy_hook_dispatches"."retry_of" is 'Dispatch this row automatically retries (set by collect_deploy_hook_results, counted under the same source); null for dispatches caused by a content change';
comment on column "public"."deploy_hook_dispatches"."retry_allowed_at" is 'Earliest time a retry may be sent, from the Retry-After or x-ratelimit-reset header of a 429 response; null when the response set none';
comment on column "public"."deploy_hook_dispatches"."checked_at" is 'When the outcome was known; skipped rows (deduplicated, missing_secret) are closed immediately, so null means a sent request whose response is still pending';

-- ── 2. Deduplikované řádky se uzavírají hned (M-4) ─────────────────────────
update "public"."deploy_hook_dispatches"
   set "checked_at" = "created_at"
 where "skip_reason" = 'deduplicated'
   and "checked_at" is null;

-- Helper z 20260901075731 beze změny, jen `deduplicated` teď nese `checked_at`: není co
-- sbírat, výsledek nese požadavek, se kterým se změna svezla.
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
    insert into public.deploy_hook_dispatches ("source", "transaction_id", "skip_reason", "checked_at")
    values (p_source, pg_catalog.pg_current_xact_id(), 'deduplicated', pg_catalog.now());
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

-- ── 3. Sběrač: sběr, propadlé odpovědi, opakování, úklid ───────────────────
-- Vědomě BEZ `exception when others` (stejný důvod jako u helperu výš): chyba má shodit
-- běh cronu hlasitě, ne tiše spolknout opakovaný požadavek.
create or replace function "public"."collect_deploy_hook_results"() returns void
    language "plpgsql" security definer
    set "search_path" to ''
    as $$
declare
  latest public.deploy_hook_dispatches%rowtype;
  last_success_at timestamp with time zone;
  streak_started_at timestamp with time zone;
  attempts integer;
  last_retry_at timestamp with time zone;
  last_attempt_at timestamp with time zone;
begin
  -- Výsledek požadavku žije v net._http_response jen 6 hodin (unlogged tabulka), takže ho
  -- včas přepíšeme k sobě. U 429 si navíc poznamenáme, kdy Vercel dovolí další pokus:
  -- `Retry-After` v celých sekundách má přednost, jinak `x-ratelimit-reset` (epoch sekundy).
  -- Nečíselné hodnoty (např. `Retry-After` jako HTTP datum) se ignorují; počet číslic je
  -- omezený, aby absurdní hodnota nepřetekla interval a neshodila celý běh sběrače.
  update public.deploy_hook_dispatches d
     set status_code = r.status_code,
         error_message = r.error_msg,
         checked_at = pg_catalog.now(),
         retry_allowed_at = case when r.status_code = 429 then coalesce(
             case when pg_catalog.btrim(r.headers ->> 'retry-after') ~ '^[0-9]{1,10}$'
                  then pg_catalog.now() + pg_catalog.make_interval(
                         secs => pg_catalog.btrim(r.headers ->> 'retry-after')::double precision)
             end,
             case when pg_catalog.btrim(r.headers ->> 'x-ratelimit-reset') ~ '^[0-9]{1,12}$'
                  then pg_catalog.to_timestamp(pg_catalog.btrim(r.headers ->> 'x-ratelimit-reset')::double precision)
             end)
         end
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

  -- Opakování: rozhoduje jen NEJNOVĚJŠÍ odeslaný požadavek. Když uspěl nebo ještě čeká,
  -- web je (nebo bude) aktuální a není co dělat.
  select * into latest
    from public.deploy_hook_dispatches
   where request_id is not null
   order by created_at desc, id desc
   limit 1;

  if found
     and latest.checked_at is not null
     and not coalesce(latest.status_code between 200 and 299 and latest.error_message is null, false)
     and (latest.status_code is null
          or latest.status_code in (408, 429)
          or latest.status_code >= 500)
  then
    -- Série = všechno od posledního úspěšně odeslaného požadavku. Pokusy jsou její řádky
    -- s `retry_of` (odeslané i přeskočené, třeba bez tajemství) — podle nich roste odstup.
    select max(created_at) into last_success_at
      from public.deploy_hook_dispatches
     where request_id is not null
       and status_code between 200 and 299
       and error_message is null;

    select min(created_at) filter (where request_id is not null),
           count(*) filter (where retry_of is not null),
           max(created_at) filter (where retry_of is not null)
      into streak_started_at, attempts, last_retry_at
      from public.deploy_hook_dispatches
     where created_at > coalesce(last_success_at, '-infinity'::timestamp with time zone);

    -- `greatest` nulls ignoruje: bez dřívějšího pokusu se počítá od neúspěšného požadavku.
    last_attempt_at := greatest(latest.created_at, last_retry_at);

    -- Mocnina je shora omezená jen proti přetečení intervalu: 2^10 × 15 min je přes
    -- 10 dní, takže uvnitř 24hodinového okna se tím nic nemění.
    if coalesce(streak_started_at, latest.created_at) > pg_catalog.now() - interval '24 hours'
       and pg_catalog.now() >= last_attempt_at
                              + interval '15 minutes' * pg_catalog.power(2, least(attempts, 10))
                              - interval '1 minute'
       and pg_catalog.now() >= coalesce(latest.retry_allowed_at, '-infinity'::timestamp with time zone)
    then
      -- Stejný `source`, aby statistika podle zdroje seděla. Sběrač běží ve vlastní
      -- transakci cronu, takže řádek(y), které helper teď zapíše, jsou jediné s tímhle
      -- transaction_id — podle toho se označí jako opakování.
      perform public.trigger_vercel_deploy(latest.source);

      update public.deploy_hook_dispatches
         set retry_of = latest.id
       where transaction_id = pg_catalog.pg_current_xact_id()
         and retry_of is null;

      raise log 'deploy hook retry: re-sent % after dispatch % failed (status %, attempt %)',
        latest.source, latest.id, coalesce(latest.status_code::text, 'none'), attempts + 1;
    end if;
  end if;

  delete from public.deploy_hook_dispatches
   where created_at < pg_catalog.now() - interval '90 days';
end;
$$;

alter function "public"."collect_deploy_hook_results"() owner to "postgres";
revoke all on function "public"."collect_deploy_hook_results"() from public, "anon", "authenticated";

-- Cron (`collect-deploy-hook-results`, */15) zůstává, jak ho založila 20260901075731:
-- volá funkci jménem, takže nové tělo převezme sám.
