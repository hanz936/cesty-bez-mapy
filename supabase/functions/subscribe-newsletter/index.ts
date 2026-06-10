import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyTurnstile } from "../_shared/verifyTurnstile.ts";
import { withSentry } from "../_shared/sentry.ts";
import { makeEcomailClient, getEcomailListId } from "../_shared/ecomail/config.ts";
import { processNewsletterSignup } from "./lib.ts";

const allowedOrigins = [
  "https://cestybezmapy.cz",
  "https://www.cestybezmapy.cz",
  "https://cesty-bez-mapy-git-development-jana-novakovas-projects.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

interface Body { email?: string; captchaToken?: string; privacy_policy_version?: string }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 320;

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });
}

Deno.serve(withSentry(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400, cors); }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
    return json({ error: "invalid_email" }, 400, cors);
  }
  if (!body.captchaToken) return json({ error: "captcha_required" }, 400, cors);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

  const turnstile = await verifyTurnstile(body.captchaToken, ip);
  if (!turnstile.success) return json({ error: "captcha_failed" }, 403, cors);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

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
    return json({ error: "subscribe_failed" }, 502, cors);
  }

  // Generická odpověď i u already_subscribed — proti e-mail enumeration.
  return json({ success: true }, 200, cors);
}, "subscribe-newsletter"));
