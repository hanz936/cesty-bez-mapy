-- Enable pg_cron and schedule housekeeping jobs.
-- cleanup_orphaned_anon_users(60): baseline SECURITY DEFINER fn — deletes anonymous
-- auth.users older than 60 days with no orders / custom_itinerary_requests.
-- download_tokens purge: expiry is enforced read-time in get-download-url (fail-closed);
-- expired rows are inert, deleted 30 days after expiry for hygiene. Legacy rows with
-- expires_at IS NULL are kept.

create extension if not exists pg_cron;

select cron.schedule(
  'cleanup-orphaned-anon-users',
  '0 3 * * *',
  $$select public.cleanup_orphaned_anon_users(60)$$
);

select cron.schedule(
  'purge-expired-download-tokens',
  '30 3 * * *',
  $$delete from public.download_tokens where expires_at is not null and expires_at < now() - interval '30 days'$$
);
