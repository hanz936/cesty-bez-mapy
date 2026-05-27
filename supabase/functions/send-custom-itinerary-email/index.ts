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

const allowedOrigins = [
  "https://cesty-bez-mapy-admin.vercel.app",
  "https://admin.cestybezmapy.cz",
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

interface RequestBody {
  request_id: string;
  force?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(req, 401, { error: "Missing Authorization header" });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse(req, 401, { error: "Invalid auth token" });
    }

    const { data: isAdmin, error: adminCheckError } = await userClient.rpc('is_admin');
    if (adminCheckError || !isAdmin) {
      return jsonResponse(req, 403, { error: "Admin role required" });
    }

    const body: RequestBody = await req.json();
    const { request_id, force = false } = body;
    if (!request_id) {
      return jsonResponse(req, 400, { error: "Missing request_id" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: request, error: loadError } = await supabase
      .from("custom_itinerary_requests")
      .select("id, customer_email, customer_name, form_data, final_pdf_url, delivery_email_sent_at, email_resend_counts")
      .eq("id", request_id)
      .single();

    if (loadError || !request) {
      return jsonResponse(req, 404, { error: "Custom request not found" });
    }

    if (!request.final_pdf_url) {
      return jsonResponse(req, 400, { error: "Custom request has no final PDF uploaded" });
    }

    if (!request.customer_email) {
      return jsonResponse(req, 400, { error: "Custom request has no customer_email" });
    }

    if (request.delivery_email_sent_at && !force) {
      console.log(JSON.stringify({
        event: "email_skipped_already_sent",
        email_type: "custom-itinerary-delivered",
        request_id,
      }));
      return jsonResponse(req, 200, {
        skipped: true,
        message: "Email už byl odeslán dříve. Pro odeslání znovu použij force=true.",
        previously_sent_at: request.delivery_email_sent_at,
      });
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
        return jsonResponse(req, 200, {
          skipped: true,
          message: "Email už byl odeslán souběžně.",
        });
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
      console.error("Failed to create download_token:", tokenError);
      if (!force) {
        await supabase
          .from('custom_itinerary_requests')
          .update({ delivery_email_sent_at: null })
          .eq('id', request_id);
      }
      return jsonResponse(req, 500, { error: "Failed to create download token" });
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

      console.log(JSON.stringify({
        event: force ? "email_manually_resent" : "email_sent",
        email_type: "custom-itinerary-delivered",
        request_id,
        admin_user_id: user.id,
        retry_n: retryN,
        resend_message_id: result.messageId,
      }));

      return jsonResponse(req, 200, {
        ok: true,
        message_id: result.messageId,
        retry_n: retryN,
      });
    } catch (sendErr) {
      console.error("Send failed:", sendErr);
      if (!force) {
        await supabase
          .from('custom_itinerary_requests')
          .update({ delivery_email_sent_at: null })
          .eq('id', request_id);
      }
      return jsonResponse(req, 500, {
        error: sendErr instanceof Error ? sendErr.message : "Send failed",
      });
    }

  } catch (error) {
    console.error("send-custom-itinerary-email error:", error);
    return jsonResponse(req, 500, { error: "Internal error" });
  }
});

function jsonResponse(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}
