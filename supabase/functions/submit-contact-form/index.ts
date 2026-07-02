// ================================================
// Edge Function: submit-contact-form
// ================================================
// Public endpoint that receives Contact and Collaboration form submissions
// from the frontend. Verifies Cloudflare Turnstile token, validates input,
// and inserts a row into contact_messages using service role.
// ================================================

import { verifyTurnstile } from "../_shared/verifyTurnstile.ts";
import { serveEdge } from "../_shared/serveEdge.ts";
import { jsonResponse } from "../_shared/http.ts";
import { logWarn, logError } from "../_shared/log.ts";

interface SubmitContactFormBody {
  form_type: "contact" | "collaboration";
  name: string;
  email: string;
  subject?: string;
  message: string;
  captchaToken: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 200;
const MAX_EMAIL = 320;
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 5000;

serveEdge({ auth: "publishable", fnName: "submit-contact-form" }, async (req, ctx) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, {});
  }

  let body: SubmitContactFormBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, {});
  }

  const { form_type, name, email, subject, message, captchaToken } = body;

  if (form_type !== "contact" && form_type !== "collaboration") {
    return jsonResponse({ error: "invalid_form_type" }, 400, {});
  }
  if (!captchaToken || typeof captchaToken !== "string") {
    return jsonResponse({ error: "missing_captcha" }, 400, {});
  }
  if (!name?.trim() || name.length > MAX_NAME) {
    return jsonResponse({ error: "invalid_name" }, 400, {});
  }
  if (!email?.trim() || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
    return jsonResponse({ error: "invalid_email" }, 400, {});
  }
  if (subject !== undefined && subject !== null) {
    if (typeof subject !== "string" || subject.length > MAX_SUBJECT) {
      return jsonResponse({ error: "invalid_subject" }, 400, {});
    }
  }
  if (
    !message?.trim() ||
    message.trim().length < 10 ||
    message.length > MAX_MESSAGE
  ) {
    return jsonResponse({ error: "invalid_message" }, 400, {});
  }

  // Turnstile verification
  const remoteIp =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    null;

  let verifyResult;
  try {
    verifyResult = await verifyTurnstile(captchaToken, remoteIp);
  } catch (err) {
    logError("turnstile_verify_error", { message: err instanceof Error ? err.message : String(err) });
    return jsonResponse({ error: "verify_unavailable" }, 503, {});
  }
  if (!verifyResult.success) {
    logWarn("turnstile_verification_failed", {
      form: form_type,
      errorCodes: verifyResult.errorCodes,
      hostname: verifyResult.hostname,
      remoteIp,
    });
    return jsonResponse(
      { error: "captcha_failed", codes: verifyResult.errorCodes ?? [] },
      403,
      {},
    );
  }

  // Insert
  const supabase = ctx.supabaseAdmin;

  const { error: dbError } = await supabase.from("contact_messages").insert({
    form_type,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    subject: form_type === "contact" ? (subject ?? null) : null,
    message: message.trim(),
  });

  if (dbError) {
    logError("contact_messages_insert_error", { message: dbError.message });
    return jsonResponse({ error: "db_error" }, 500, {});
  }

  return jsonResponse({ success: true }, 200, {});
});
