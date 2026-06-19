-- SEC-01 (best-practices audit 2026-06): enforce MFA (AAL2) at the data layer.
-- is_admin() additionally requires the JWT claim aal = 'aal2'. An admin
-- authenticated with password only (AAL1, no TOTP) is treated as non-admin by
-- every RLS policy that builds on is_admin(). Fail-closed on null/missing.

CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
DECLARE
  jwt_data jsonb;
BEGIN
  -- Cache JWT data in a variable - called only once per query
  jwt_data := (SELECT auth.jwt());

  RETURN
    -- Must have is_admin = true in JWT (from custom_access_token_hook)
    COALESCE((jwt_data->>'is_admin')::boolean, false)
    AND
    -- Must NOT be an anonymous user
    (jwt_data->>'is_anonymous')::boolean IS FALSE
    AND
    -- SEC-01: must be an MFA-verified (aal2) session; missing/aal1 -> deny
    COALESCE((jwt_data->>'aal') = 'aal2', false);
END;
$$;

COMMENT ON FUNCTION "public"."is_admin"() IS 'Checks if current user is admin AND not anonymous AND MFA-verified (aal2). Cached JWT; fail-closed on null/missing. AAL2 requirement added in SEC-01 (best-practices audit 2026-06).';
