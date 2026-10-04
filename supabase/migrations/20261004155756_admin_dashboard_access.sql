-- Admin dashboard (ADM repo docs/superpowers/specs/2026-08-29-admin-dashboard-design.md §5.2, §6, §10, §16).
--
-- 1) download_tokens: admin could INSERT/DELETE but never SELECT — the "Stažení PDF" panel reads it.
-- 2) products: the only SELECT policy was products_public_select (is_deleted = false) for anon AND
--    authenticated, so the admin never saw soft-deleted products (ProductList "Smazáno" filter returned
--    nothing) and SECURITY INVOKER dashboard functions would read through the same predicate.
--    House pattern (blog_posts, reviews): public policy for anon; authenticated policy = public
--    predicate OR is_admin(). Exactly one permissive SELECT policy per role → no advisor lint 0006.
-- 3) products.category_ids NOT NULL: the "Produkty bez PDF" count leaves out the custom-itinerary
--    category with category_ids=not.cs.{<id>}, i.e. NOT (category_ids @> '{<id>}'), which is NULL for
--    a NULL array, so such a product would silently drop out of the count (spec §3.1). No writer
--    sends NULL (column default '{}', the admin array inputs send []), so backfill + constraint.
-- 4) Indexes for filters that already run every 30 s (menu badge) and the 30-day e-mail window.
--
-- Re-runnable: applied remotely via MCP apply_migration, so a retry after a partial failure must
-- not stop on "already exists" (house pattern: drop policy if exists in 20260610230500,
-- create index if not exists in 20260901075731); alter policy … to anon, the backfill and
-- set not null are idempotent by themselves. Every intermediate state of a first run is safe:
-- products_authenticated_select exists before products_public_select is narrowed to anon, so
-- authenticated never lacks a SELECT policy (for a moment it has two permissive ones whose union is
-- the target predicate). A re-run over a partly applied file (possible only if the statements were
-- committed one by one) drops products_authenticated_select for a moment before recreating it.
--
-- Locks: the two index builds come first; each takes only a ShareLock on its own table
-- (contact_messages, email_events; inside a transaction it blocks writes there until the end), so
-- no lock on products, download_tokens, auth or storage is held while they build or wait. Run as
-- postgres, every policy statement takes AccessExclusiveLock on its table and on the auth.* and
-- storage.* tables listed in supautils.policy_grants — the first one already, even drop policy if
-- exists for a policy that does not exist — so the backfill and SET NOT NULL never upgrade the lock
-- on products. Production runs with lock_timeout = 0; lock_timeout 5 s as the first and last
-- statement (FE house pattern since 20260930125902): behind a long transaction the migration fails
-- fast instead of queueing sign-ins and catalog reads behind itself; then just run it again. Plain
-- SET/RESET, not SET LOCAL, which has no effect outside a transaction block.
--
-- Row triggers on products (updated_at, deploy hook, rating guard) fire only for backfilled rows:
-- with no NULL category_ids the UPDATE touches nothing. A live product with NULL would get updated_at
-- bumped and one site rebuild requested — harmless.
--
-- Rollback: alter policy products_public_select on public.products to anon, authenticated; drop policy
-- products_authenticated_select; alter table public.products alter column category_ids drop not null;
-- drop policy download_tokens_admin_select; drop both indexes.

set lock_timeout = '5s';

create index if not exists "idx_contact_messages_read_at" on "public"."contact_messages"
  using btree ("read_at") where ("read_at" is null);

create index if not exists "idx_email_events_created_at" on "public"."email_events"
  using btree ("created_at" desc);

drop policy if exists "download_tokens_admin_select" on "public"."download_tokens";
create policy "download_tokens_admin_select" on "public"."download_tokens"
  for select to "authenticated" using ((select "public"."is_admin"()));

comment on policy "download_tokens_admin_select" on "public"."download_tokens" is
  'Admins can read tokens (system-health downloads panel: issued / link issued / expired unused).';

drop policy if exists "products_authenticated_select" on "public"."products";
create policy "products_authenticated_select" on "public"."products"
  for select to "authenticated"
  using (("is_deleted" = false) or (select "public"."is_admin"()));

comment on policy "products_authenticated_select" on "public"."products" is
  'Authenticated non-admins (anonymous checkout sessions) see live products; admins also see soft-deleted ones.';

alter policy "products_public_select" on "public"."products" to "anon";

update "public"."products" set "category_ids" = '{}' where "category_ids" is null;
alter table "public"."products" alter column "category_ids" set not null;

reset lock_timeout;
