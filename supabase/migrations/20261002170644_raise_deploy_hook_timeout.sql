-- Delší timeout požadavku na deploy hook Vercelu: 30 s místo výchozích 5 s (nález K7-3).
--
-- E2E test 2026-10-02 (úprava testovacího produktu): Vercel požadavek přijal a nasazení
-- založil zhruba 7,3 s po odeslání (dva vzorky), jenže pg_net čeká na odpověď jen 5 s.
-- To je výchozí `timeout_milliseconds` v pg_net 0.19.5 a helper ho dosud nenastavoval.
-- Každý požadavek tak v `net._http_response` skončil jako timeout, i když se web postavil.
-- Sběrač z 20260930130503 bere chybějící odpověď jako přechodnou chybu a požadavek pošle
-- znovu, takže z jedné úpravy bylo až sedm buildů za 24 hodin a v logu samé falešné chyby.
--
-- Proč 30 s: víc než čtyřnásobná rezerva nad naměřenou latencí a zároveň hranice, nad kterou
-- dokumentace pg_net považuje timeout za velký (troubleshooting hledá požadavky
-- s `timeout_milliseconds > 30000`). Worker pg_net posílá až po commitu a asynchronně, takže
-- delší čekání nezdrží transakci, která helper zavolala (uložení produktu, recenze, článku).
--
-- Tělo funkce je jinak beze změny proti 20260930130503. `create or replace` zachová vlastníka
-- i práva, ale ostatní vlastnosti bere z příkazu (PostgreSQL, CREATE FUNCTION), proto je
-- hlavička vypsaná celá. Vlastník a revoke se opakují stejně jako tam.
--
-- Migrace je OPAKOVATELNÁ a bez vlastního BEGIN/COMMIT.
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

  -- 30 s: Vercel odpovídá déle než výchozích 5 s pg_net a sběrač by požadavek, na který
  -- odpověď nedorazila, zbytečně posílal znovu.
  sent_request_id := net.http_post(
    url := hook_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );

  insert into public.deploy_hook_dispatches ("source", "transaction_id", "request_id")
  values (p_source, pg_catalog.pg_current_xact_id(), sent_request_id);
end;
$$;

alter function "public"."trigger_vercel_deploy"("p_source" "text") owner to "postgres";
-- Volají ji jen SECURITY DEFINER triggery běžící jako postgres; přes RPC nemá co dělat.
revoke all on function "public"."trigger_vercel_deploy"("p_source" "text") from public, "anon", "authenticated";
