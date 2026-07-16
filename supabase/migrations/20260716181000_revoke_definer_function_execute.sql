-- Supabase advisor lint 0028/0029 (found during reviews-system live verification):
-- SECURITY DEFINER functions in the exposed public schema must not be executable
-- by anon/authenticated. House pattern per baseline (e.g. handle_new_permanent_user,
-- increment_download_count): REVOKE ALL FROM PUBLIC + grant service_role only.
--
-- refresh_product_rating: trigger-only function; firing a trigger never checks the
-- DML caller's EXECUTE privilege, so the reviews aggregate trigger keeps working
-- (proven by the baseline trigger functions with the same grants + pgTAP suite).
-- check_rate_limit: called exclusively via ctx.supabaseAdmin (service role) from
-- edge functions (create-checkout-session, submit-review, get-review-request,
-- csp-report) — anon/authenticated never call it.

REVOKE ALL ON FUNCTION "public"."refresh_product_rating"() FROM PUBLIC, "anon", "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_product_rating"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."check_rate_limit"("p_bucket" "text", "p_limit" integer, "p_window_seconds" integer) FROM PUBLIC, "anon", "authenticated";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_bucket" "text", "p_limit" integer, "p_window_seconds" integer) TO "service_role";
