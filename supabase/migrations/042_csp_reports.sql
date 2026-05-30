-- ================================================
-- Migration 042: csp_reports table
-- ================================================
-- Fed by the public `csp-report` Edge Function (verify_jwt=false), which
-- browsers POST to via the CSP `report-uri` / `report-to` directives.
-- Edge Function uses the service-role key, so no INSERT policy is needed.
-- Admin reads via authenticated user with public.is_admin() check.
-- ================================================

CREATE TABLE public.csp_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),

  disposition text NOT NULL CHECK (disposition IN ('enforce', 'report')),
  effective_directive text,
  blocked_uri text,
  document_uri text,
  source_file text,
  line_number int,
  column_number int,
  referrer text,
  status_code int,
  sample text,

  user_agent text,
  client_ip inet,

  raw jsonb NOT NULL
);

CREATE INDEX idx_csp_reports_received_at ON public.csp_reports(received_at DESC);
CREATE INDEX idx_csp_reports_disposition_directive_received_at
  ON public.csp_reports(disposition, effective_directive, received_at DESC);

-- RLS
ALTER TABLE public.csp_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "csp_reports_admin_select"
  ON public.csp_reports
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));

-- No INSERT/UPDATE/DELETE policies on purpose.
-- Edge Function uses service-role key (bypasses RLS) for INSERT.
-- Reports are append-only diagnostic data; admin can purge via service role if needed.
