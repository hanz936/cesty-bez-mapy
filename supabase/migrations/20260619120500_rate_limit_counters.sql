-- SEC-03 (best-practices audit 2026-06): shared per-identifier rate limiting
-- for public edge functions. Postgres-backed because edge invocations are
-- stateless/distributed and Supabase has no built-in per-function limit.

CREATE TABLE IF NOT EXISTS "public"."rate_limit_counters" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "bucket" text NOT NULL,
  "window_start" timestamptz NOT NULL DEFAULT now(),
  "request_count" integer NOT NULL DEFAULT 0,
  CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rate_limit_counters_bucket_key" UNIQUE ("bucket")
);

ALTER TABLE "public"."rate_limit_counters" ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE "public"."rate_limit_counters" IS 'Per-identifier fixed-window request counters for edge-function rate limiting (SEC-03). RLS enabled with no policies = deny-all; written only via SECURITY DEFINER check_rate_limit() / service role.';
COMMENT ON COLUMN "public"."rate_limit_counters"."bucket" IS 'Rate-limit identifier, e.g. "checkout:<ip>" or "csp:<ip>".';
COMMENT ON COLUMN "public"."rate_limit_counters"."window_start" IS 'Start of the current fixed window; reset when the window elapses.';
COMMENT ON COLUMN "public"."rate_limit_counters"."request_count" IS 'Requests counted in the current window.';

CREATE OR REPLACE FUNCTION "public"."check_rate_limit"(
  "p_bucket" text,
  "p_limit" integer,
  "p_window_seconds" integer
) RETURNS boolean
    LANGUAGE "plpgsql"
    SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.rate_limit_counters AS c (bucket, window_start, request_count)
  VALUES (p_bucket, now(), 1)
  ON CONFLICT (bucket) DO UPDATE
    SET
      request_count = CASE
        WHEN c.window_start < now() - make_interval(secs => p_window_seconds)
          THEN 1
        ELSE c.request_count + 1
      END,
      window_start = CASE
        WHEN c.window_start < now() - make_interval(secs => p_window_seconds)
          THEN now()
        ELSE c.window_start
      END
  RETURNING request_count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;

COMMENT ON FUNCTION "public"."check_rate_limit"(text, integer, integer) IS 'Atomic fixed-window rate limit. Increments the counter for p_bucket and returns true if within p_limit per p_window_seconds, false if exceeded. SECURITY DEFINER so callers need no direct table grants.';
