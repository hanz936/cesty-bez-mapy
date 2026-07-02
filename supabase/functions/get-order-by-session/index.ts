// ================================================
// Supabase Edge Function: Get Order By Session
// ================================================
// Načte objednávku podle Stripe session_id
// - Získá payment_intent ID ze Stripe API
// - Najde objednávku v DB podle stripe_payment_id
// - Vrátí download token a info o objednávce
// ================================================

import Stripe from "https://esm.sh/stripe@22.2.0?target=denonext";
import { type QueryData, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Database } from "../_shared/database.types.ts";
import { serveEdge } from "../_shared/serveEdge.ts";
import { jsonResponse } from "../_shared/http.ts";
import { logInfo, logWarn, logError, maskEmail } from "../_shared/log.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2026-05-27.dahlia",
});

interface GetOrderRequest {
  session_id: string;
}

serveEdge({ auth: "publishable", fnName: "get-order-by-session" }, async (req, ctx) => {
  try {
    // Parse request body
    const body: GetOrderRequest = await req.json();
    const { session_id } = body;

    // Validace
    if (!session_id) {
      return jsonResponse({ error: "Chybí session_id" }, 400, {});
    }

    logInfo("looking_up_order_for_session", { sessionId: session_id });

    // Získání Stripe session pro payment_intent ID
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(session_id);
    } catch (stripeError) {
      logError("failed_to_retrieve_stripe_session", {
        message: stripeError instanceof Error ? stripeError.message : String(stripeError),
      });
      return jsonResponse({ error: "Neplatná platební session" }, 404, {});
    }

    // Kontrola, že platba byla úspěšná
    if (session.payment_status !== "paid") {
      return jsonResponse(
        { status: "pending", message: "Platba ještě nebyla dokončena" },
        200,
        {},
      );
    }

    const paymentIntentId = session.payment_intent as string;
    logInfo("payment_intent_resolved", { paymentIntentId });

    // Supabase klient s privilegovaným (secret) klíčem pro bypass RLS —
    // dodává ho serveEdge wrapper.
    const supabase: SupabaseClient<Database> = ctx.supabaseAdmin;

    // Hledání objednávky podle stripe_payment_id
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        id,
        customer_email,
        customer_name,
        total_amount,
        status,
        created_at
      `)
      .eq("stripe_payment_id", paymentIntentId)
      .single();

    if (orderError || !order) {
      // Objednávka ještě nebyla vytvořena webhookem
      logInfo("order_not_found_yet", { message: orderError?.message });
      return jsonResponse(
        { status: "processing", message: "Objednávka se právě zpracovává" },
        200,
        {},
      );
    }

    logInfo("found_order", { orderId: order.id });

    // Verify ownership — session email must match order email (fail-closed:
    // deny if the session has no email or it does not match the order). (audit F13)
    const sessionEmail = session.customer_details?.email?.toLowerCase() ?? null;
    if (!sessionEmail || !order.customer_email ||
        sessionEmail !== order.customer_email.toLowerCase()) {
      logWarn("order_access_denied_email_mismatch", {
        orderId: order.id,
        sessionEmailDomain: sessionEmail ? maskEmail(sessionEmail) : null,
        orderEmailDomain: order.customer_email ? maskEmail(order.customer_email) : null,
      });
      return jsonResponse({ error: "Přístup odepřen" }, 403, {});
    }

    // Načtení download tokenu. Tokeny vytvořené od audit 3.5.4 (F5) mají
    // 7denní expiraci (expires_at); starší tokeny mají expires_at = NULL
    // (perpetual, zachováno kvůli zpětné kompatibilitě).
    const { data: downloadToken, error: tokenError } = await supabase
      .from("download_tokens")
      .select("token, expires_at")
      .eq("order_id", order.id)
      .single();

    if (tokenError) {
      logInfo("download_token_not_found", { message: tokenError.message });
    }

    // Načtení položek objednávky
    const orderItemsQuery = supabase
      .from("order_items")
      .select(`
        id,
        quantity,
        price_at_purchase,
        products (
          id,
          title,
          duration,
          image_url,
          pdf_url
        )
      `)
      .eq("order_id", order.id);
    type OrderItemsRow = QueryData<typeof orderItemsQuery>[number];

    const { data: orderItems, error: itemsError } = await orderItemsQuery;

    if (itemsError) {
      logError("failed_to_load_order_items", { message: itemsError.message });
    }

    // Formátování položek pro odpověď
    const items = ((orderItems ?? []) as OrderItemsRow[]).map((item) => ({
      id: item.products?.id,
      title: item.products?.title,
      duration: item.products?.duration,
      image_url: item.products?.image_url,
      price: item.price_at_purchase,
      quantity: item.quantity,
      has_pdf: !!item.products?.pdf_url,
    }));

    // Vrácení objednávky
    return jsonResponse(
      {
        status: "completed",
        order: {
          id: order.id,
          customer_email: order.customer_email,
          customer_name: order.customer_name,
          total_amount: order.total_amount,
          created_at: order.created_at,
          items: items,
        },
        download_token: downloadToken?.token || null,
        download_expires_at: downloadToken?.expires_at ?? null,
      },
      200,
      {},
    );
  } catch (error) {
    logError("get_order_by_session_error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse({ error: "Nepodařilo se načíst objednávku" }, 500, {});
  }
});
