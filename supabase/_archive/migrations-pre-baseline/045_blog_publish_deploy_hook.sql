-- ================================================
-- Migration: 045_blog_publish_deploy_hook
-- Created: 2026-05-30
-- Description: Po změně PUBLIKOVANÉHO článku zavolá Vercel Deploy Hook
--   (rebuild build-time prerenderu). URL je v Supabase Vault.
-- ================================================

create extension if not exists pg_net;

create or replace function notify_vercel_blog_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hook_url text;
  is_relevant boolean;
begin
  -- Rebuild jen když se to dotýká publikovaného obsahu
  -- (nový/upravený/smazaný publikovaný, vč. přechodů koncept<->publikováno).
  is_relevant :=
       (TG_OP = 'INSERT' and NEW.published_at is not null)
    or (TG_OP = 'UPDATE' and (NEW.published_at is not null or OLD.published_at is not null))
    or (TG_OP = 'DELETE' and OLD.published_at is not null);
  if not is_relevant then
    return coalesce(NEW, OLD);
  end if;

  select decrypted_secret into hook_url
  from vault.decrypted_secrets
  where name = 'vercel_deploy_hook';

  if hook_url is not null then
    perform net.http_post(
      url := hook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  end if;

  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_blog_publish_deploy on public.blog_posts;
create trigger trg_blog_publish_deploy
  after insert or update or delete on public.blog_posts
  for each row execute function notify_vercel_blog_publish();
