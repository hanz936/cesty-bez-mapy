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

import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, makeResendClient } from "../_shared/email/sendEmail.ts";
import type { OrderItem } from "../_shared/email/types.ts";
import { serveEdge } from "../_shared/serveEdge.ts";
import { assertAdmin } from "../_shared/assertAdmin.ts";
import { jsonResponse } from "../_shared/http.ts";
import { logInfo, logError } from "../_shared/log.ts";
import type { Database } from "../_shared/database.types.ts";

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

serveEdge({ auth: "user", fnName: "resend-email" }, async (req, ctx) => {
  try {
    const gate = await assertAdmin(ctx, {});
    if (!gate.ok) return gate.response;

    const body: RequestBody = await req.json();
    const { order_id, type } = body;
    if (!order_id || !type) {
      return jsonResponse({ error: "Missing order_id or type" }, 400, {});
    }
    if (!(type in TYPE_TO_KEY_PREFIX)) {
      return jsonResponse({ error: "Invalid type" }, 400, {});
    }

    const supabase: SupabaseClient<Database> = ctx.supabaseAdmin;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, customer_email, customer_name, total_amount, email_resend_counts')
      .eq('id', order_id)
      .single();

    if (orderError || !order) return jsonResponse({ error: "Order not found" }, 404, {});

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

      const orderItems: OrderItem[] = (items || []).map((it) => ({
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
      }, { supabase });

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
      }, { supabase });

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
      }, { supabase });

      await supabase.from('orders')
        .update({
          refund_email_sent_at: new Date().toISOString(),
          refund_email_message_id: result.messageId,
        })
        .eq('id', order_id);
    }

    logInfo("email_manually_resent", {
      email_type: type,
      order_id,
      admin_user_id: ctx.userClaims?.id,
      retry_n: retryN,
      resend_message_id: result.messageId,
    });

    return jsonResponse({
      ok: true,
      message_id: result.messageId,
      retry_n: retryN,
    }, 200, {});

  } catch (error) {
    logError("resend_email_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse({
      error: error instanceof Error ? error.message : "Internal error",
    }, 500, {});
  }
});
