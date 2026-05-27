-- ================================================
-- Migration 041: Resend webhook events + suppression list
-- ================================================
-- Two tables for tracking Resend deliverability:
--   email_events: append-only audit log of every webhook event
--   email_suppressions: addresses we must NOT send to (hard bounce / complaint / manual)
-- Inserts only via Edge Function `resend-webhook` (service role).
-- Admin reads via authenticated user with public.is_admin() check.
-- ================================================

CREATE TABLE public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_email_id text NOT NULL,
  event_type text NOT NULL,
  email_to text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (resend_email_id, event_type)
);

CREATE INDEX idx_email_events_to_created
  ON public.email_events(email_to, created_at DESC);

CREATE TABLE public.email_suppressions (
  email text PRIMARY KEY,
  reason text NOT NULL CHECK (reason IN ('hard_bounce', 'complaint', 'manual')),
  source_event_id text,
  suppressed_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

-- RLS
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

-- Admin SELECT only — webhook writes via service role (RLS bypass).
CREATE POLICY "email_events_admin_select"
  ON public.email_events
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));

CREATE POLICY "email_suppressions_admin_select"
  ON public.email_suppressions
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));

COMMENT ON TABLE public.email_events IS
  'Append-only log of every Resend webhook event. Unique (resend_email_id, event_type) for idempotent inserts.';
COMMENT ON TABLE public.email_suppressions IS
  'Addresses we must not send to. First reason wins (never demote). Manual entries inserted out-of-band.';
COMMENT ON COLUMN public.email_suppressions.email IS
  'Recipient address, lowercased by caller.';
COMMENT ON COLUMN public.email_suppressions.source_event_id IS
  'Resend webhook event id that triggered this entry. NULL for manual entries.';
