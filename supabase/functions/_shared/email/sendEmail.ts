// ================================================
// sendEmail wrapper: Resend SDK + idempotency + retry + structured logging
// ================================================
// Single entry point for all email sends. Calls Resend with deterministic
// idempotency key, retries on 429/5xx with exponential backoff, fails fast
// on 4xx. Logs success/failure as structured JSON to console (Supabase logs).
// ================================================

import { Resend } from "resend";
import { OrderConfirmation } from "./templates/OrderConfirmation.tsx";
import { CustomItineraryReceived } from "./templates/CustomItineraryReceived.tsx";
import { Refund } from "./templates/Refund.tsx";
import { PaymentFailed } from "./templates/PaymentFailed.tsx";
import { CustomItineraryDelivered } from "./templates/CustomItineraryDelivered.tsx";
import { Invoice } from "./templates/Invoice.tsx";
import { StornoInvoice } from "./templates/StornoInvoice.tsx";
import { InvoiceCorrected } from "./templates/InvoiceCorrected.tsx";
import { InvoiceAlert } from "./templates/InvoiceAlert.tsx";
import { EmailSuppressedError, type EmailType, type PropsForType, type SendEmailParams, type SendEmailResult } from "./types.ts";

// Allow mocking in tests via parametric client
export interface ResendClient {
  emails: {
    send(params: unknown): Promise<{
      data: { id: string } | null;
      error: { statusCode: number; message: string; name: string } | null;
    }>;
  };
}

// Minimal shape needed for suppression lookup. Compatible with @supabase/supabase-js client.
// deno-lint-ignore no-explicit-any
export type SuppressionLookupClient = any;

interface SendOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  supabase?: SuppressionLookupClient;
}

const SUBJECT_BUILDERS: Record<EmailType, (props: any) => string> = {
  'order-confirmation': (p) =>
    `Tvůj průvodce je připraven ke stažení – objednávka #${p.orderId}`,
  'custom-itinerary-payment-received': (_p) =>
    `Děkujeme za platbu – plánuju tvůj individuální itinerář`,
  'refund': (p) =>
    `Vrátili jsme ti peníze za objednávku #${p.orderId}`,
  'payment-failed': (_p) =>
    `Tvá platba se nezdařila`,
  'custom-itinerary-delivered': (_p) =>
    `Tvůj individuální itinerář je hotový`,
  'invoice': (p) =>
    `Faktura ${p.invoiceNumber} – Cesty bez mapy`,
  'storno-invoice': (p) =>
    `Storno faktura ${p.stornoNumber}`,
  'invoice-corrected': (p) =>
    `Opravená faktura ${p.newInvoiceNumber}`,
  'invoice-alert': (p) =>
    `[Fakturoid alert] order ${p.orderId.slice(0, 8)}`,
};

// deno-lint-ignore no-explicit-any
function renderTemplate<T extends EmailType>(type: T, props: PropsForType<T>): any {
  switch (type) {
    case 'order-confirmation':
      return OrderConfirmation(props as any);
    case 'custom-itinerary-payment-received':
      return CustomItineraryReceived(props as any);
    case 'refund':
      return Refund(props as any);
    case 'payment-failed':
      return PaymentFailed(props as any);
    case 'custom-itinerary-delivered':
      return CustomItineraryDelivered(props as any);
    case 'invoice':
      return Invoice(props as any);
    case 'storno-invoice':
      return StornoInvoice(props as any);
    case 'invoice-corrected':
      return InvoiceCorrected(props as any);
    case 'invoice-alert':
      return InvoiceAlert(props as any);
  }
}

function isRetryable(statusCode: number | null): boolean {
  if (statusCode === null) return true; // network error
  return statusCode === 429 || statusCode >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let suppressionWarningLogged = false;

async function checkSuppression(
  supabase: SuppressionLookupClient,
  emailLower: string,
  idempotencyKey: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("email_suppressions")
    .select("email, reason")
    .eq("email", emailLower)
    .maybeSingle();

  if (error) {
    // Don't block sends on transient suppression query errors — log loudly and proceed.
    // The cost of a single duplicate send to a suppressed address (Resend will bounce
    // again, regenerating a webhook event) is lower than dropping legitimate mail.
    console.error(JSON.stringify({
      event: "suppression_check_failed",
      email_to: emailLower,
      idempotency_key: idempotencyKey,
      error: error.message,
    }));
    return;
  }

  if (data) {
    console.log(JSON.stringify({
      event: "email_send_suppressed",
      email_to: emailLower,
      reason: data.reason,
      idempotency_key: idempotencyKey,
    }));
    throw new EmailSuppressedError(emailLower, data.reason);
  }
}

export async function sendEmail<T extends EmailType>(
  client: ResendClient,
  params: SendEmailParams<T>,
  options: SendOptions = {},
): Promise<SendEmailResult> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 1000;

  const emailLower = params.to.toLowerCase();
  if (options.supabase) {
    await checkSuppression(options.supabase, emailLower, params.idempotencyKey);
  } else if (!suppressionWarningLogged) {
    console.warn(JSON.stringify({
      event: "sendEmail_without_suppression_check",
      note: "supabase client not passed to sendEmail; suppression list bypassed",
    }));
    suppressionWarningLogged = true;
  }

  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "info@cestybezmapy.cz";
  const fromName = Deno.env.get("RESEND_FROM_NAME") || "Cesty bez mapy";
  const from = `${fromName} <${fromEmail}>`;

  const subject = SUBJECT_BUILDERS[params.type](params.templateProps);
  const reactElement = renderTemplate(params.type, params.templateProps);

  let lastError: Error | null = null;

  const replyTo = Deno.env.get("RESEND_REPLY_TO") || "cestybezmapy@gmail.com";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { data, error } = await client.emails.send({
      from,
      to: params.to,
      replyTo,
      subject,
      react: reactElement,
      idempotencyKey: params.idempotencyKey,
      ...(params.attachments ? { attachments: params.attachments } : {}),
    });

    if (data && !error) {
      console.log(JSON.stringify({
        event: "email_sent",
        email_type: params.type,
        idempotency_key: params.idempotencyKey,
        resend_message_id: data.id,
        attempt,
        timestamp: new Date().toISOString(),
      }));
      return { messageId: data.id, attempt };
    }

    if (error) {
      lastError = new Error(error.message);
      const retryable = isRetryable(error.statusCode);

      console.error(JSON.stringify({
        event: "email_send_failed",
        email_type: params.type,
        idempotency_key: params.idempotencyKey,
        error_status: error.statusCode,
        error_name: error.name,
        attempt,
        retryable,
        timestamp: new Date().toISOString(),
      }));

      if (!retryable || attempt === maxRetries) {
        throw lastError;
      }

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), 30000)
                  + Math.random() * baseDelayMs;
      await sleep(delay);
    }
  }

  throw lastError ?? new Error("Unknown send failure");
}

// Convenience factory: build Resend client from env
export function makeResendClient(): ResendClient {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is not set");
  }
  return new Resend(apiKey) as unknown as ResendClient;
}
