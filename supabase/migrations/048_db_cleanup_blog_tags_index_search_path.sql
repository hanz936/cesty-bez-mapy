-- 048_db_cleanup_blog_tags_index_search_path.sql
-- B3 + B4-cleanup security/perf remediation — audit 2026-06-03
-- (docs/superpowers/audits/2026-06-03-supabase-audit.md)

-- F7 [LOW / lint 0006]: blog_tags had TWO permissive policies for authenticated
-- SELECT (blog_tags_admin_all ALL + blog_tags_public_read SELECT). Replace the
-- broad ALL admin policy with write-only admin policies so SELECT is served by a
-- single permissive policy (blog_tags_public_read). is_admin() reference kept
-- unqualified to match the existing policy convention across the project.
drop policy if exists "blog_tags_admin_all" on public.blog_tags;

create policy "blog_tags_admin_insert" on public.blog_tags
  for insert to authenticated
  with check ((select is_admin()));

create policy "blog_tags_admin_update" on public.blog_tags
  for update to authenticated
  using ((select is_admin()))
  with check ((select is_admin()));

create policy "blog_tags_admin_delete" on public.blog_tags
  for delete to authenticated
  using ((select is_admin()));

-- F10 [LOW / lint 0009]: drop redundant plain index that duplicates the UNIQUE
-- constraint index orders_stripe_payment_id_key (both btree on stripe_payment_id).
drop index if exists public.idx_orders_stripe_payment_id;

-- F12 [LOW]: tighten SECURITY DEFINER function search_path to '' (strictest) for
-- functions whose bodies already fully-qualify every public reference. pg_catalog
-- built-ins remain available with an empty search_path.
-- NOTE: create_order_with_items is intentionally left at search_path='public' —
-- its body uses unqualified table names and it is SECURITY INVOKER (lower risk);
-- rewriting it is out of scope for this cosmetic change.
alter function public.increment_download_count(uuid) set search_path = '';
alter function public.increment_email_resend_count(text, uuid, text) set search_path = '';
alter function public.handle_new_permanent_user() set search_path = '';
