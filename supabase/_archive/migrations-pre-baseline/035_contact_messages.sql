-- ================================================
-- Migration 035: contact_messages table
-- ================================================
-- Stores submissions from Contact and Collaboration forms.
-- Inserts only via Edge Function (service role, RLS bypass).
-- Admin reads/updates via authenticated user with public.is_admin() check.
-- ================================================

CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_type text NOT NULL CHECK (form_type IN ('contact', 'collaboration')),

  name text NOT NULL,
  email text NOT NULL,
  subject text,
  message text NOT NULL,

  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'in_progress', 'resolved', 'spam')),
  admin_notes text,
  read_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_messages_status ON public.contact_messages(status);
CREATE INDEX idx_contact_messages_created_at ON public.contact_messages(created_at DESC);

CREATE TRIGGER handle_contact_messages_updated_at
  BEFORE UPDATE ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- RLS
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Admin (authenticated user with admin role) can SELECT/UPDATE/DELETE all rows.
CREATE POLICY "contact_messages_admin_select"
  ON public.contact_messages
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));

CREATE POLICY "contact_messages_admin_update"
  ON public.contact_messages
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "contact_messages_admin_delete"
  ON public.contact_messages
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

-- INSERT: no policy. Edge Function uses service-role key, bypasses RLS.
-- Public anon role has no INSERT path on purpose, so spam can't bypass Turnstile.
