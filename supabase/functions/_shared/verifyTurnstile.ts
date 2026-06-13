// ================================================
// Shared helper: verify a Cloudflare Turnstile token
// ================================================
// Used by Edge Functions that accept user-submitted forms protected by
// Turnstile. Calls Cloudflare's siteverify endpoint and returns a
// normalized result.
// ================================================

export interface TurnstileResult {
  success: boolean;
  errorCodes?: string[];
  // Surfaced for monitoring/logging by callers (log-only; not enforced —
  // standard widgets are already hostname-scoped by Cloudflare).
  hostname?: string;
  action?: string;
  challengeTs?: string;
}

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const SITEVERIFY_TIMEOUT_MS = 10_000;
const MAX_TOKEN_LENGTH = 2048;

export async function verifyTurnstile(
  token: string,
  remoteIp?: string | null,
): Promise<TurnstileResult> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) {
    throw new Error("TURNSTILE_SECRET_KEY env var is not configured");
  }

  // Guard token length before calling siteverify (cheap rejection of junk).
  if (
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > MAX_TOKEN_LENGTH
  ) {
    return { success: false, errorCodes: ["invalid-token-length"] };
  }

  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (remoteIp) body.append("remoteip", remoteIp);
  // Idempotency key so a safe retry of the same verification is not penalized.
  body.append("idempotency_key", crypto.randomUUID());

  let res: Response;
  try {
    // Hard timeout: a hanging siteverify must not block the edge function.
    res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === "TimeoutError";
    return {
      success: false,
      errorCodes: [timedOut ? "timeout" : "network_error"],
    };
  }

  if (!res.ok) {
    return { success: false, errorCodes: [`http_${res.status}`] };
  }

  const data = await res.json();
  return {
    success: data.success === true,
    errorCodes: data["error-codes"],
    hostname: data.hostname,
    action: data.action,
    challengeTs: data["challenge_ts"],
  };
}
