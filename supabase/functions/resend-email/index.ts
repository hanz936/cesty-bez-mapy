// ================================================
// Supabase Edge Function: resend-email
// ================================================
// Admin-invoked manual resend of order-related emails:
//   - order-confirmation (mail 1a)
//   - custom-itinerary-payment-received (mail 1b)
//   - refund (mail 2 refund)
// Uses retry-N suffix in idempotency key to bypass Resend's 24h cache.
// payment-failed is NOT resendable here: failed payments don't produce
// an order row, so there's nothing to resend against. If admin needs to
// notify a customer about a past failed payment, use a separate flow.
// ================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, makeResendClient } from "../_shared/email/sendEmail.ts";
import type { OrderItem } from "../_shared/email/types.ts";

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

type ResendableEmailType =
  | 'order-confirmation'
  | 'custom-itinerary-payment-received'
  | 'refund';

interface RequestBody {
  order_id: string;
  type: ResendableEmailType;
}

const TYPE_TO_KEY_PREFIX: Record<ResendableEmailType, string> = {
  'order-confirmation': 'order-confirm',
  'custom-itinerary-payment-received': 'custom-payment',
  'refund': 'refund',
};

const TYPE_TO_RESEND_COUNT_KEY: Record<ResendableEmailType, string> = {
  'order-confirmation': 'confirmation',
  'custom-itinerary-payment-received': 'confirmation',
  'refund': 'refund',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse(req, 401, { error: "Missing Authorization header" });

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse(req, 401, { error: "Invalid auth" });

    const { data: isAdmin, error: adminCheckError } = await userClient.rpc('is_admin');
    if (adminCheckError || !isAdmin) return jsonResponse(req, 403, { error: "Admin role required" });

    const body: RequestBody = await req.json();
    const { order_id, type } = body;
    if (!order_id || !type) {
      return jsonResponse(req, 400, { error: "Missing order_id or type" });
    }
    if (!(type in TYPE_TO_KEY_PREFIX)) {
      return jsonResponse(req, 400, { error: "Invalid type" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, customer_email, customer_name, total_amount, email_resend_counts')
      .eq('id', order_id)
      .single();

    if (orderError || !order) return jsonResponse(req, 404, { error: "Order not found" });

    const countKey = TYPE_TO_RESEND_COUNT_KEY[type];
    const { data: newCount } = await supabase.rpc('increment_email_resend_count', {
      table_name: 'orders',
      row_id: order_id,
      key: countKey,
    });
    const retryN = newCount as number;

    const idempotencyKey = `${TYPE_TO_KEY_PREFIX[type]}/${order_id}/retry-${retryN}`;

    const siteUrl = Deno.env.get('SITE_URL') || 'https://cestybezmapy.cz';
    const client = makeResendClient();
    const customerName = order.customer_name ?? '';

    let result;
    if (type === 'order-confirmation') {
      const { data: items } = await supabase
        .from('order_items')
        .select('quantity, price_at_purchase, products(title)')
        .eq('order_id', order_id);
      const { data: token } = await supabase
        .from('download_tokens')
        .select('token')
        .eq('order_id', order_id)
        .eq('asset_type', 'product_pdf')
        .maybeSingle();

      // deno-lint-ignore no-explicit-any
      const orderItems: OrderItem[] = (items || []).map((it: any) => ({
        productTitle: it.products?.title || 'Průvodce',
        quantity: it.quantity,
        priceAtPurchase: Number(it.price_at_purchase),
      }));

      result = await sendEmail(client, {
        type: 'order-confirmation',
        to: order.customer_email,
        idempotencyKey,
        templateProps: {
          customerName,
          orderId: order_id,
          items: orderItems,
          totalAmount: Number(order.total_amount),
          downloadUrl: token ? `${siteUrl}/stahnout?token=${token.token}` : undefined,
        },
      });

      await supabase.from('orders')
        .update({
          confirmation_email_sent_at: new Date().toISOString(),
          confirmation_email_message_id: result.messageId,
        })
        .eq('id', order_id);
    } else if (type === 'custom-itinerary-payment-received') {
      result = await sendEmail(client, {
        type: 'custom-itinerary-payment-received',
        to: order.customer_email,
        idempotencyKey,
        templateProps: {
          customerName,
          orderId: order_id,
        },
      });

      await supabase.from('orders')
        .update({
          confirmation_email_sent_at: new Date().toISOString(),
          confirmation_email_message_id: result.messageId,
        })
        .eq('id', order_id);
    } else {
      // refund — uses total_amount as a proxy for refund amount.
      // Future enhancement: persist actual refund amount when charge.refunded fires.
      result = await sendEmail(client, {
        type: 'refund',
        to: order.customer_email,
        idempotencyKey,
        templateProps: {
          customerName,
          orderId: order_id,
          amount: Number(order.total_amount),
        },
      });

      await supabase.from('orders')
        .update({
          refund_email_sent_at: new Date().toISOString(),
          refund_email_message_id: result.messageId,
        })
        .eq('id', order_id);
    }

    console.log(JSON.stringify({
      event: "email_manually_resent",
      email_type: type,
      order_id,
      admin_user_id: user.id,
      retry_n: retryN,
      resend_message_id: result.messageId,
    }));

    return jsonResponse(req, 200, {
      ok: true,
      message_id: result.messageId,
      retry_n: retryN,
    });

  } catch (error) {
    console.error("resend-email error:", error);
    return jsonResponse(req, 500, {
      error: error instanceof Error ? error.message : "Internal error",
    });
  }
});

function jsonResponse(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}
