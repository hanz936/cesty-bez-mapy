// ================================================
// Supabase Edge Function: Resend Webhook Handler
// ================================================
// Receives Resend webhook events (delivery, bounce, complaint).
// Verifies Svix signature, logs every event to email_events.
// Hard bounces and complaints add the recipient to email_suppressions.
// Soft bounces are logged only — Resend retries internally.
// ================================================

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Webhook } from "npm:svix@1";
import { withSentry } from "../_shared/sentry.ts";
import type { Database, Json } from "../_shared/database.types.ts";
import { logInfo, logError, maskEmail } from "../_shared/log.ts";

type Supabase = SupabaseClient<Database>;

interface Verifier {
  verify(payload: string, headers: Record<string, string>): unknown;
}

interface ResendEvent {
  type: string;
  data: {
    email_id: string;
    to: string[] | string;
    bounce?: { type?: string };
  };
}

export interface WebhookResponse {
  status: number;
  body: string;
}

function normalizeTo(to: string[] | string): string {
  const value = Array.isArray(to) ? to[0] : to;
  return (value ?? "").toLowerCase();
}

function isHardBounce(bounceType: string | undefined): boolean {
  // Resend bounce.type values: Permanent | Transient | Undetermined.
  // Only Permanent is a hard bounce; Transient is retried by Resend.
  return bounceType === "Permanent";
}

export async function handleWebhook(
  rawBody: string,
  headers: Record<string, string>,
  supabase: Supabase,
  verifier: Verifier,
): Promise<WebhookResponse> {
  if (!headers["svix-signature"] || !headers["svix-id"] || !headers["svix-timestamp"]) {
    return { status: 400, body: "Missing Svix headers" };
  }

  let event: ResendEvent;
  try {
    event = verifier.verify(rawBody, headers) as ResendEvent;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logError("webhook_signature_invalid", { reason: msg });
    return { status: 400, body: "Invalid signature" };
  }

  const emailTo = normalizeTo(event.data.to);
  const resendEmailId = event.data.email_id;

  const { error: insertErr } = await supabase
    .from("email_events")
    .upsert(
      {
        resend_email_id: resendEmailId,
        event_type: event.type,
        email_to: emailTo,
        payload: event as unknown as Json,
      },
      { onConflict: "resend_email_id,event_type", ignoreDuplicates: true },
    );

  if (insertErr) {
    logError("email_event_insert_failed", {
      resend_email_id: resendEmailId,
      event_type: event.type,
      error: insertErr.message,
    });
    return { status: 500, body: "DB error" };
  }

  let suppressionReason: "hard_bounce" | "complaint" | null = null;
  if (event.type === "email.bounced" && isHardBounce(event.data.bounce?.type)) {
    suppressionReason = "hard_bounce";
  } else if (event.type === "email.complained") {
    suppressionReason = "complaint";
  }

  if (suppressionReason) {
    const { error: suppressErr } = await supabase
      .from("email_suppressions")
      .upsert(
        {
          email: emailTo,
          reason: suppressionReason,
          source_event_id: resendEmailId,
        },
        { onConflict: "email", ignoreDuplicates: true },
      );

    if (suppressErr) {
      logError("email_suppression_insert_failed", {
        email: maskEmail(emailTo),
        reason: suppressionReason,
        error: suppressErr.message,
      });
      return { status: 500, body: "DB error" };
    }

    logInfo("email_suppressed", {
      email: maskEmail(emailTo),
      reason: suppressionReason,
      source_event_id: resendEmailId,
    });
  }

  logInfo("resend_webhook_processed", {
    type: event.type,
    resend_email_id: resendEmailId,
    suppressed: suppressionReason !== null,
  });

  return { status: 200, body: JSON.stringify({ received: true }) };
}

Deno.serve(withSentry(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!secret) {
    logError("resend_webhook_secret_not_set", {});
    return new Response("Misconfigured", { status: 500 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

  const rawBody = await req.text();
  const headers: Record<string, string> = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  const verifier = new Webhook(secret);
  const result = await handleWebhook(rawBody, headers, supabase, verifier);

  return new Response(result.body, {
    status: result.status,
    headers: { "Content-Type": "application/json" },
  });
}, "resend-webhook"));
