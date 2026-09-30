-- Rebuild the static output when a product or a category changes.
--
-- Product data is baked into the prerendered HTML: the product detail, the catalogue,
-- the reviews pages with their JSON-LD, and the sitemap, which lists live products only.
-- Category names are baked into the catalogue filters. Until now only reviews and blog
-- posts fired the Vercel deploy hook, so adding, editing, hiding or deleting a guide, or
-- renaming a category, reached the static site only with the next unrelated build
-- (audit finding F7, 2026-08-31).
--
-- Both triggers only decide what is relevant and hand the rest to the shared helper
-- public.trigger_vercel_deploy, which records every dispatch and sends at most one
-- request per transaction.

alter table "public"."deploy_hook_dispatches"
    drop constraint if exists "deploy_hook_dispatches_source_check";
alter table "public"."deploy_hook_dispatches"
    add constraint "deploy_hook_dispatches_source_check"
    check ("source" in ('reviews', 'blog_posts', 'products', 'categories'));

comment on column "public"."deploy_hook_dispatches"."source" is 'Which trigger asked for the rebuild: reviews, blog_posts, products, categories';

create or replace function "public"."notify_vercel_products_change"() returns "trigger"
    language "plpgsql" security definer
    set "search_path" to ''
    as $$
declare
  -- Sloupce, které píše strojovna, ne člověk, a které stránku samy nezmění:
  -- `updated_at` (moddatetime při každém UPDATE), `total_sales` (triggery objednávek —
  -- jinak by build spustil každý nákup), `stripe_*` (synchronizace po uložení),
  -- agregáty hodnocení (přepočítá je refresh_product_rating při změně recenze a rebuild
  -- v té transakci obstará trigger recenzí) a `pdf_url` (soubor je neveřejný, na stránce
  -- se neukazuje). Je to schválně VÝČET VÝJIMEK, ne povolených sloupců: nový sloupec
  -- web přestaví, dokud ho sem někdo vědomě nepřidá — horší by bylo tiše zastaralé HTML.
  ignored constant text[] := array['updated_at', 'total_sales', 'stripe_product_id',
    'stripe_price_id', 'stripe_sync_error', 'average_rating', 'review_count', 'pdf_url'];
  was_live boolean;
  is_live boolean;
begin
  -- „Živý" = to, co ukazuje web i build (`contentSlugs.mjs`, katalog, detail):
  -- aktivní a nesmazaný. Úprava konceptu, který nebyl a není vidět, build nespouští.
  was_live := TG_OP in ('UPDATE', 'DELETE') and OLD.is_active and not OLD.is_deleted;
  is_live := TG_OP in ('INSERT', 'UPDATE') and NEW.is_active and not NEW.is_deleted;

  if not (was_live or is_live) then
    return coalesce(NEW, OLD);
  end if;

  -- Uložení formuláře beze změny obsahu (admin posílá celý řádek) build nespouští.
  if TG_OP = 'UPDATE'
     and (pg_catalog.to_jsonb(OLD) - ignored) = (pg_catalog.to_jsonb(NEW) - ignored) then
    return coalesce(NEW, OLD);
  end if;

  perform public.trigger_vercel_deploy('products');
  return coalesce(NEW, OLD);
end;
$$;

alter function "public"."notify_vercel_products_change"() owner to "postgres";
revoke all on function "public"."notify_vercel_products_change"() from public, "anon", "authenticated";

create or replace function "public"."notify_vercel_categories_change"() returns "trigger"
    language "plpgsql" security definer
    set "search_path" to ''
    as $$
begin
  -- Kategorie nemají koncept ani skrytí (`categories_public_select` je `using (true)`),
  -- takže relevantní je každá změna kromě razítka `updated_at`.
  if TG_OP = 'UPDATE'
     and (pg_catalog.to_jsonb(OLD) - 'updated_at') = (pg_catalog.to_jsonb(NEW) - 'updated_at') then
    return coalesce(NEW, OLD);
  end if;

  perform public.trigger_vercel_deploy('categories');
  return coalesce(NEW, OLD);
end;
$$;

alter function "public"."notify_vercel_categories_change"() owner to "postgres";
revoke all on function "public"."notify_vercel_categories_change"() from public, "anon", "authenticated";

create or replace trigger "trg_products_deploy_hook"
  after insert or delete or update on "public"."products"
  for each row execute function "public"."notify_vercel_products_change"();

create or replace trigger "trg_categories_deploy_hook"
  after insert or delete or update on "public"."categories"
  for each row execute function "public"."notify_vercel_categories_change"();
