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
}

export async function verifyTurnstile(
  token: string,
  remoteIp?: string | null,
): Promise<TurnstileResult> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) {
    throw new Error("TURNSTILE_SECRET_KEY env var is not configured");
  }

  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (remoteIp) body.append("remoteip", remoteIp);

  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body },
  );

  if (!res.ok) {
    return { success: false, errorCodes: [`http_${res.status}`] };
  }

  const data = await res.json();
  return {
    success: data.success === true,
    errorCodes: data["error-codes"],
  };
}
