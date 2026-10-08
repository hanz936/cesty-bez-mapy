-- Admin "Zdraví systému" page (spec §4, §5.2, §6, §16). Silent business failures that neither
-- Sentry nor anyone else sees today: integration errors, bounces, orders without a download token,
-- failed Vercel rebuilds. SECURITY INVOKER + explicit is_admin() gate (see get_admin_dashboard_overview).
-- All windows start at Prague midnight (spec §5.3); the CSP window is fixed at 7 days (spec §4).
-- p_days is capped at 30 (the UI always asks for 30): download tokens are deleted about 37 days after
-- they are issued (cleanup cron, 30 days after the 7-day expiry) and deploy_hook_dispatches after
-- 90 days, so a longer window would count orders whose token was cleaned up as "without token".

create or replace function public.get_system_health_overview(p_days integer default 30)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_since timestamptz;
  v_csp_since timestamptz;
begin
  if not (select public.is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_days is null or p_days < 1 or p_days > 30 then
    raise exception 'p_days must be between 1 and 30' using errcode = '22023';
  end if;

  v_since := ((now() at time zone 'Europe/Prague')::date - p_days)::timestamp at time zone 'Europe/Prague';
  v_csp_since := ((now() at time zone 'Europe/Prague')::date - 7)::timestamp at time zone 'Europe/Prague';

  return jsonb_build_object(
    'window_days', p_days,
    -- Closed enums (CHECK constraints) cross-joined so every service/status pair is present even
    -- with 0 rows: the UI must tell "fakturoid: 0 failures" from "fakturoid logged nothing".
    'integrations', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'service', s.service, 'status', st.status, 'count', coalesce(c.cnt, 0))
               order by s.service, st.status), '[]'::jsonb)
        from (values ('ecomail'), ('fakturoid'), ('stripe'), ('other')) as s(service)
        cross join (values ('success'), ('failed'), ('pending')) as st(status)
        left join (
          select l.service, l.status, count(*) as cnt
            from public.integration_logs l
           where l.created_at >= v_since
           group by l.service, l.status
        ) c on c.service = s.service and c.status = st.status
    ),
    -- resend-webhook stores Resend's event.type verbatim (dotted prefix); UNIQUE (resend_email_id,
    -- event_type) makes "delivered" a count of distinct e-mails.
    'emails', jsonb_build_object(
      'delivered', (select count(*) from public.email_events e where e.event_type = 'email.delivered' and e.created_at >= v_since),
      'bounced', (select count(*) from public.email_events e where e.event_type = 'email.bounced' and e.created_at >= v_since),
      'complained', (select count(*) from public.email_events e where e.event_type = 'email.complained' and e.created_at >= v_since),
      'suppressions', (select count(*) from public.email_suppressions s where s.created_at >= v_since)
    ),
    'downloads', jsonb_build_object(
      -- Completed orders with at least one guide item and no product_pdf token: the customer paid
      -- and got no file. Itinerary-only orders never get a product_pdf token and are excluded.
      -- Known limitation (spec §3.7): deleting a paid itinerary request sets its order item's
      -- custom_itinerary_request_id to null (on delete set null), so that itinerary-only order then
      -- counts here until it leaves the window.
      'orders_without_token', (
        select count(*)
          from public.orders o
         where o.status = 'completed'
           and o.created_at >= v_since
           and exists (select 1 from public.order_items oi
                        where oi.order_id = o.id and oi.custom_itinerary_request_id is null)
           and not exists (select 1 from public.download_tokens t
                            where t.order_id = o.id and t.asset_type = 'product_pdf')
      ),
      -- download_count is written when a signed URL is issued, not when the file is downloaded.
      -- custom_itinerary_pdf tokens are issued without expires_at (send-custom-itinerary-email;
      -- null = no expiry in get-download-url), so their expired_unused is always 0 (spec §6).
      'by_asset_type', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'asset_type', a.asset_type,
                 'issued', coalesce(d.issued, 0),
                 'link_issued', coalesce(d.link_issued, 0),
                 'expired_unused', coalesce(d.expired_unused, 0))
                 order by a.asset_type), '[]'::jsonb)
          from (values ('product_pdf'), ('custom_itinerary_pdf')) as a(asset_type)
          left join (
            select t.asset_type,
                   count(*) as issued,
                   count(*) filter (where t.download_count > 0) as link_issued,
                   count(*) filter (where t.expires_at < now() and t.download_count = 0) as expired_unused
              from public.download_tokens t
             where t.created_at >= v_since
             group by t.asset_type
          ) d on d.asset_type = a.asset_type
      )
    ),
    -- Durable record of every Vercel deploy-hook call, kept 90 days (pg_net keeps responses only
    -- 6 hours). Per source: changes = first requests sent (retry_of is null), retries = automatic
    -- re-sends by collect_deploy_hook_results() that were sent (retry_of is not null; a retry the
    -- helper skipped for lack of the secret counts only as missing_secret), so changes + retries
    -- = ok + rejected + no_response + pending. Outcome of every sent row, the same rules as
    -- deploy_hooks_latest below: pending (not collected yet, checked_at is null), ok (2xx without
    -- error), rejected (any other HTTP status: Vercel answered and refused), no_response (no status:
    -- pg_net timeout, network error, response expired — the build may well have run; the collector
    -- retries it). Rows not sent: deduplicated (rode along with an earlier request in the same
    -- transaction) and missing_secret (no vault secret: the site is never rebuilt).
    'deploy_hooks', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'source', s.source,
               'changes', coalesce(d.changes, 0),
               'retries', coalesce(d.retries, 0),
               'ok', coalesce(d.ok, 0),
               'rejected', coalesce(d.rejected, 0),
               'no_response', coalesce(d.no_response, 0),
               'pending', coalesce(d.pending, 0),
               'deduplicated', coalesce(d.deduplicated, 0),
               'missing_secret', coalesce(d.missing_secret, 0))
               order by s.source), '[]'::jsonb)
        from (values ('blog_posts'), ('categories'), ('products'), ('reviews')) as s(source)
        left join (
          select h.source,
                 count(*) filter (where h.request_id is not null and h.retry_of is null) as changes,
                 count(*) filter (where h.request_id is not null and h.retry_of is not null) as retries,
                 count(*) filter (where h.request_id is not null and h.checked_at is not null
                                    and h.error_message is null and h.status_code between 200 and 299) as ok,
                 count(*) filter (where h.request_id is not null and h.checked_at is not null
                                    and h.status_code is not null
                                    and (h.error_message is not null or h.status_code not between 200 and 299)) as rejected,
                 count(*) filter (where h.request_id is not null and h.checked_at is not null
                                    and h.status_code is null) as no_response,
                 count(*) filter (where h.request_id is not null and h.checked_at is null) as pending,
                 count(*) filter (where h.skip_reason = 'deduplicated') as deduplicated,
                 count(*) filter (where h.skip_reason = 'missing_secret') as missing_secret
            from public.deploy_hook_dispatches h
           where h.created_at >= v_since
           group by h.source
        ) d on d.source = s.source
    ),
    -- Is the site up to date? Every build rebuilds the whole site, so it is as fresh as the newest
    -- row that decided something: a sent request or a change not sent for lack of the secret
    -- (deduplicated rows ride on an earlier request). The collector judges the same newest sent row.
    -- Not limited to the window (only by the 90-day cleanup); null when there is no such row.
    'deploy_hooks_latest', (
      select jsonb_build_object(
               'created_at', l.created_at,
               'source', l.source,
               'is_retry', l.retry_of is not null,
               'outcome', case
                 when l.skip_reason = 'missing_secret' then 'missing_secret'
                 when l.checked_at is null then 'pending'
                 when l.error_message is null and l.status_code between 200 and 299 then 'ok'
                 when l.status_code is not null then 'rejected'
                 else 'no_response' end)
        from public.deploy_hook_dispatches l
       where l.request_id is not null or l.skip_reason = 'missing_secret'
       order by l.created_at desc, l.id desc
       limit 1
    ),
    'csp_reports', (select count(*) from public.csp_reports c where c.created_at >= v_csp_since),
    'csp_window_days', 7,
    'newsletter_consents', jsonb_build_object(
      'opt_in', (select count(*) from public.newsletter_consent_log n where n.consent_given and n.created_at >= v_since),
      'opt_out', (select count(*) from public.newsletter_consent_log n where not n.consent_given and n.created_at >= v_since)
    )
  );
end;
$$;

comment on function public.get_system_health_overview(integer) is
  'Admin system-health counters for the last p_days (Prague-midnight window; CSP fixed 7 days): integration_logs per service/status (all pairs, zeros included), Resend e-mail events, completed orders without a product_pdf download token, download tokens per asset type, Vercel deploy-hook requests per source (changes, sent retries, outcomes, rows not sent) and the outcome of the newest one (deploy_hooks_latest), CSP reports, newsletter opt-in/opt-out. Raises 42501 for non-admins, 22023 for p_days outside 1..30.';

revoke all on function public.get_system_health_overview(integer) from public, anon;
grant execute on function public.get_system_health_overview(integer) to authenticated;
