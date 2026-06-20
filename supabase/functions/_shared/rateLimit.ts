// ================================================
// Shared helper: per-identifier rate limiting (SEC-02 / SEC-03)
// ================================================
// Backed by the Postgres function public.check_rate_limit(). Edge invocations
// are stateless/distributed, so the counter lives in the DB. Fails OPEN: a
// transient DB error must never block a legitimate user — abuse protection is
// best-effort.
// ================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface RateLimitOptions {
  bucket: string; // e.g. "checkout:1.2.3.4"
  limit: number; // max requests per window
  windowSeconds: number; // window length in seconds
}

// Returns true if the request is ALLOWED, false if it exceeds the limit.
export async function enforceRateLimit(
  client: SupabaseClient,
  { bucket, limit, windowSeconds }: RateLimitOptions,
): Promise<boolean> {
  try {
    const { data, error } = await client.rpc("check_rate_limit", {
      p_bucket: bucket,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("[rate-limit] check failed, failing open", {
        bucket,
        error: error.message,
      });
      return true;
    }
    return data === true;
  } catch (err) {
    console.error("[rate-limit] unexpected error, failing open", { bucket, err });
    return true;
  }
}

// Best-effort client IP from edge headers (Cloudflare first, then proxy hop).
export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
