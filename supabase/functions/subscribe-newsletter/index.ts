import { verifyTurnstile } from "../_shared/verifyTurnstile.ts";
import { serveEdge } from "../_shared/serveEdge.ts";
import { makeEcomailClient, getEcomailListId } from "../_shared/ecomail/config.ts";
import { processNewsletterSignup } from "./lib.ts";
import { jsonResponse } from "../_shared/http.ts";
import { logWarn, logError } from "../_shared/log.ts";

interface Body { email?: string; captchaToken?: string; privacy_policy_version?: string }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 320;

serveEdge({ auth: "publishable", fnName: "subscribe-newsletter" }, async (req, ctx) => {
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405, {});

  let body: Body;
  try { body = await req.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400, {}); }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
    return jsonResponse({ error: "invalid_email" }, 400, {});
  }
  if (!body.captchaToken || typeof body.captchaToken !== "string") return jsonResponse({ error: "captcha_required" }, 400, {});

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

  let turnstile;
  try {
    turnstile = await verifyTurnstile(body.captchaToken, ip);
  } catch (err) {
    logError("turnstile_verify_error", { message: err instanceof Error ? err.message : String(err) });
    return jsonResponse({ error: "verify_unavailable" }, 503, {});
  }
  if (!turnstile.success) {
    logWarn("turnstile_verification_failed", {
      form: "newsletter",
      errorCodes: turnstile.errorCodes,
      hostname: turnstile.hostname,
      remoteIp: ip,
    });
    return jsonResponse({ error: "captcha_failed" }, 403, {});
  }

  const supabase = ctx.supabaseAdmin;

  try {
    await processNewsletterSignup({
      client: makeEcomailClient(),
      supabase,
      listId: getEcomailListId(),
      email,
      ip,
      userAgent,
      privacyPolicyVersion: body.privacy_policy_version ?? "unknown",
    });
  } catch (_e) {
    // Consent log už zapsán; subscribe selhal → uživatel může zkusit znovu.
    return jsonResponse({ error: "subscribe_failed" }, 502, {});
  }

  // Generická odpověď i u already_subscribed — proti e-mail enumeration.
  return jsonResponse({ success: true }, 200, {});
});
