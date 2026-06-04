-- ================================================
-- Migration 036: Resend email integration
-- ================================================
-- Created: 2026-05-06
-- Description: Schema changes for transactional email integration via Resend.
--   Part 1: download_tokens — perpetual access + unify standard/custom PDFs
--   Part 2: orders — email tracking columns
--   Part 3: custom_itinerary_requests — email tracking columns
--   Part 4: indexes for email status lookups
-- ================================================

-- ================================================
-- PART 1: download_tokens — perpetual + unified
-- ================================================

ALTER TABLE public.download_tokens
  DROP CONSTRAINT IF EXISTS download_tokens_expires_at_check;

-- Drop policies that reference expires_at (defined in 025) before dropping the column.
-- Recreated below without the expires_at predicate (perpetual access by design).
DROP POLICY IF EXISTS "download_tokens_public_select" ON public.download_tokens;
DROP POLICY IF EXISTS "download_tokens_authenticated_select" ON public.download_tokens;

ALTER TABLE public.download_tokens
  DROP COLUMN IF EXISTS expires_at;
DROP INDEX IF EXISTS idx_download_tokens_expires_at;

-- Recreate SELECT policies without expiration predicate.
-- Tokens are perpetual; revocation is handled via DELETE (admin-only) elsewhere.
CREATE POLICY "download_tokens_public_select"
  ON public.download_tokens
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "download_tokens_authenticated_select"
  ON public.download_tokens
  FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE public.download_tokens
  ALTER COLUMN order_id DROP NOT NULL;

ALTER TABLE public.download_tokens
  ADD COLUMN IF NOT EXISTS asset_type text NOT NULL DEFAULT 'product_pdf'
    CHECK (asset_type IN ('product_pdf', 'custom_itinerary_pdf')),
  ADD COLUMN IF NOT EXISTS custom_itinerary_request_id uuid
    REFERENCES public.custom_itinerary_requests(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS download_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_downloaded_at timestamptz;

UPDATE public.download_tokens
  SET asset_type = 'product_pdf'
  WHERE asset_type IS NULL OR asset_type = '';

ALTER TABLE public.download_tokens
  DROP CONSTRAINT IF EXISTS download_tokens_one_target;
ALTER TABLE public.download_tokens
  ADD CONSTRAINT download_tokens_one_target CHECK (
    (asset_type = 'product_pdf'
       AND order_id IS NOT NULL
       AND custom_itinerary_request_id IS NULL)
    OR
    (asset_type = 'custom_itinerary_pdf'
       AND custom_itinerary_request_id IS NOT NULL
       AND order_id IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_download_tokens_custom_request_id
  ON public.download_tokens(custom_itinerary_request_id)
  WHERE custom_itinerary_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_download_tokens_asset_type
  ON public.download_tokens(asset_type);

COMMENT ON COLUMN public.download_tokens.asset_type IS
  'Discriminator: product_pdf (multi-buyer master from products-pdfs) or custom_itinerary_pdf (per-customer file from custom-itinerary-pdfs).';
COMMENT ON COLUMN public.download_tokens.custom_itinerary_request_id IS
  'Reference to custom_itinerary_requests when asset_type=custom_itinerary_pdf; NULL otherwise.';
COMMENT ON COLUMN public.download_tokens.download_count IS
  'Number of successful download attempts (audit).';
COMMENT ON COLUMN public.download_tokens.last_downloaded_at IS
  'Timestamp of most recent successful download.';

-- ================================================
-- PART 2: orders — email tracking
-- ================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS confirmation_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_email_message_id text,
  ADD COLUMN IF NOT EXISTS refund_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_email_message_id text,
  ADD COLUMN IF NOT EXISTS email_resend_counts jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_orders_confirmation_email_unsent
  ON public.orders(created_at DESC)
  WHERE confirmation_email_sent_at IS NULL;

COMMENT ON COLUMN public.orders.confirmation_email_sent_at IS
  'Timestamp when confirmation email (mail 1a or 1b) was successfully sent.';
COMMENT ON COLUMN public.orders.confirmation_email_message_id IS
  'Resend message ID for confirmation email.';
COMMENT ON COLUMN public.orders.refund_email_sent_at IS
  'Timestamp when refund or payment-failed email (mail 2) was successfully sent.';
COMMENT ON COLUMN public.orders.refund_email_message_id IS
  'Resend message ID for refund/failed email.';
COMMENT ON COLUMN public.orders.email_resend_counts IS
  'Per-email-type retry counter for admin manual resends. Keys: confirmation, refund, payment_failed.';

-- ================================================
-- PART 3: custom_itinerary_requests — email tracking
-- ================================================

ALTER TABLE public.custom_itinerary_requests
  ADD COLUMN IF NOT EXISTS delivery_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_email_message_id text,
  ADD COLUMN IF NOT EXISTS email_resend_counts jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_custom_requests_delivery_email_unsent
  ON public.custom_itinerary_requests(created_at DESC)
  WHERE delivery_email_sent_at IS NULL
    AND final_pdf_url IS NOT NULL;

COMMENT ON COLUMN public.custom_itinerary_requests.delivery_email_sent_at IS
  'Timestamp when custom itinerary delivery email (mail 3) was successfully sent.';
COMMENT ON COLUMN public.custom_itinerary_requests.delivery_email_message_id IS
  'Resend message ID for delivery email.';
COMMENT ON COLUMN public.custom_itinerary_requests.email_resend_counts IS
  'Per-email-type retry counter for admin manual resends. Keys: delivery.';

-- ================================================
-- PART 5: helper RPC for atomic download_count increment
-- ================================================

CREATE OR REPLACE FUNCTION public.increment_download_count(token_id uuid)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = public
AS $$
  UPDATE public.download_tokens
  SET download_count = download_count + 1
  WHERE id = token_id;
$$;

REVOKE ALL ON FUNCTION public.increment_download_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_download_count(uuid) TO service_role;

-- ================================================
-- PART 6: helper RPC for atomic email_resend_counts increment
-- ================================================

CREATE OR REPLACE FUNCTION public.increment_email_resend_count(
  table_name text,
  row_id uuid,
  key text
) RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  IF table_name = 'orders' THEN
    UPDATE public.orders
    SET email_resend_counts = jsonb_set(
      email_resend_counts,
      ARRAY[key],
      to_jsonb(COALESCE((email_resend_counts->>key)::integer, 0) + 1)
    )
    WHERE id = row_id
    RETURNING (email_resend_counts->>key)::integer INTO new_count;
  ELSIF table_name = 'custom_itinerary_requests' THEN
    UPDATE public.custom_itinerary_requests
    SET email_resend_counts = jsonb_set(
      email_resend_counts,
      ARRAY[key],
      to_jsonb(COALESCE((email_resend_counts->>key)::integer, 0) + 1)
    )
    WHERE id = row_id
    RETURNING (email_resend_counts->>key)::integer INTO new_count;
  ELSE
    RAISE EXCEPTION 'Unknown table_name: %', table_name;
  END IF;

  RETURN new_count;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_email_resend_count(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_email_resend_count(text, uuid, text) TO service_role;
