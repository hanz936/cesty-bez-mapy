// ================================================
// Supabase Edge Function: send-custom-itinerary-email
// ================================================
// Admin-invoked function to deliver completed custom itinerary PDF
// to customer via email. Validates admin auth, atomically claims the
// delivery_email_sent_at slot, creates a download_token, sends mail 3
// via Resend, writes message_id back.
// ================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, makeResendClient } from "../_shared/email/sendEmail.ts";
import { withSentry } from "../_shared/sentry.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/http.ts";
import { requireAdmin } from "../_shared/requireAdmin.ts";
import { logInfo, logError } from "../_shared/log.ts";
import type { Database } from "../_shared/database.types.ts";

interface RequestBody {
  request_id: string;
  force?: boolean;
}

Deno.serve(withSentry(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const gate = await requireAdmin(req, cors);
    if (!gate.ok) return gate.response;
    const user = gate.user;

    const body: RequestBody = await req.json();
    const { request_id, force = false } = body;
    if (!request_id) {
      return jsonResponse({ error: "Missing request_id" }, 400, cors);
    }

    const supabase = createClient<Database>(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: request, error: loadError } = await supabase
      .from("custom_itinerary_requests")
      .select("id, customer_email, customer_name, form_data, final_pdf_url, delivery_email_sent_at, email_resend_counts")
      .eq("id", request_id)
      .single();

    if (loadError || !request) {
      return jsonResponse({ error: "Custom request not found" }, 404, cors);
    }

    if (!request.final_pdf_url) {
      return jsonResponse({ error: "Custom request has no final PDF uploaded" }, 400, cors);
    }

    if (!request.customer_email) {
      return jsonResponse({ error: "Custom request has no customer_email" }, 400, cors);
    }

    if (request.delivery_email_sent_at && !force) {
      logInfo("email_skipped_already_sent", {
        email_type: "custom-itinerary-delivered",
        request_id,
      });
      return jsonResponse({
        skipped: true,
        message: "Email už byl odeslán dříve. Pro odeslání znovu použij force=true.",
        previously_sent_at: request.delivery_email_sent_at,
      }, 200, cors);
    }

    let idempotencyKey = `custom-delivered/${request_id}`;
    let retryN = 0;
    if (force) {
      const counts = (request.email_resend_counts || {}) as Record<string, number>;
      retryN = (counts.delivery || 0) + 1;
      idempotencyKey = `custom-delivered/${request_id}/retry-${retryN}`;

      await supabase.rpc('increment_email_resend_count', {
        table_name: 'custom_itinerary_requests',
        row_id: request_id,
        key: 'delivery',
      });
    }

    if (!force) {
      const { data: claimed, error: claimError } = await supabase
        .from('custom_itinerary_requests')
        .update({ delivery_email_sent_at: new Date().toISOString() })
        .eq('id', request_id)
        .is('delivery_email_sent_at', null)
        .select('id')
        .maybeSingle();

      if (claimError || !claimed) {
        return jsonResponse({
          skipped: true,
          message: "Email už byl odeslán souběžně.",
        }, 200, cors);
      }
    }

    const tokenValue = crypto.randomUUID().replace(/-/g, '');
    const { error: tokenError } = await supabase
      .from('download_tokens')
      .insert({
        token: tokenValue,
        custom_itinerary_request_id: request_id,
        order_id: null,
        asset_type: 'custom_itinerary_pdf',
      });

    if (tokenError) {
      logError("download_token_create_failed", {
        request_id,
        error: tokenError.message,
      });
      if (!force) {
        await supabase
          .from('custom_itinerary_requests')
          .update({ delivery_email_sent_at: null })
          .eq('id', request_id);
      }
      return jsonResponse({ error: "Failed to create download token" }, 500, cors);
    }

    const siteUrl = Deno.env.get('SITE_URL') || 'https://cestybezmapy.cz';

    try {
      const client = makeResendClient();
      const result = await sendEmail(client, {
        type: 'custom-itinerary-delivered',
        to: request.customer_email,
        idempotencyKey,
        templateProps: {
          customerName: request.customer_name ?? '',
          requestId: request_id,
          downloadUrl: `${siteUrl}/stahnout?token=${tokenValue}`,
        },
      }, { supabase });

      await supabase
        .from('custom_itinerary_requests')
        .update({
          delivery_email_message_id: result.messageId,
          delivery_email_sent_at: new Date().toISOString(),
          delivered_at: new Date().toISOString(),
        })
        .eq('id', request_id);

      logInfo(force ? "email_manually_resent" : "email_sent", {
        email_type: "custom-itinerary-delivered",
        request_id,
        admin_user_id: user?.id,
        retry_n: retryN,
        resend_message_id: result.messageId,
      });

      return jsonResponse({
        ok: true,
        message_id: result.messageId,
        retry_n: retryN,
      }, 200, cors);
    } catch (sendErr) {
      logError("send_custom_itinerary_email_send_failed", {
        request_id,
        error: sendErr instanceof Error ? sendErr.message : String(sendErr),
      });
      if (!force) {
        await supabase
          .from('custom_itinerary_requests')
          .update({ delivery_email_sent_at: null })
          .eq('id', request_id);
      }
      return jsonResponse({
        error: sendErr instanceof Error ? sendErr.message : "Send failed",
      }, 500, cors);
    }

  } catch (error) {
    logError("send_custom_itinerary_email_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse({ error: "Internal error" }, 500, cors);
  }
}, "send-custom-itinerary-email"));
