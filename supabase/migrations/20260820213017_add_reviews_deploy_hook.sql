-- Rebuild the static output when the set of approved reviews changes.
--
-- Reviews pages are prerendered: a product with no approved reviews ships a
-- noindex in its source HTML, and the number of paginated pages is baked in at
-- build time. Both go stale the moment a review is approved or removed, and a
-- stale noindex cannot be undone client-side because Google may skip rendering
-- entirely when it sees one. Mirrors trg_blog_posts_publish_deploy on blog_posts.
create or replace function "public"."notify_vercel_reviews_change"() returns "trigger"
    language "plpgsql" security definer
    set "search_path" to ''
    as $$
declare
  hook_url text;
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

alter function "public"."notify_vercel_reviews_change"() owner to "postgres";
revoke all on function "public"."notify_vercel_reviews_change"() from public, "anon", "authenticated";
grant all on function "public"."notify_vercel_reviews_change"() to "service_role";

-- Pozn. k pořadí: PostgreSQL spouští AFTER triggery na téže tabulce abecedně, takže
-- trg_reviews_deploy_hook jde PŘED trg_reviews_refresh_product_rating a v okamžiku
-- jeho běhu je products.review_count ještě neaktualizovaný. Nevadí to: net.http_post
-- request jen zařadí do fronty a odesílá se až po commitu, kdy je agregát hotový.
create trigger "trg_reviews_deploy_hook"
  after insert or delete or update of "status" on "public"."reviews"
  for each row execute function "public"."notify_vercel_reviews_change"();
