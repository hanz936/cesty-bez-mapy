// ================================================
// Supabase Edge Function: Get Order By Session
// ================================================
// Načte objednávku podle Stripe session_id
// - Získá payment_intent ID ze Stripe API
// - Najde objednávku v DB podle stripe_payment_id
// - Vrátí download token a info o objednávce
// ================================================

import Stripe from "https://esm.sh/stripe@22.2.0?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry } from "../_shared/sentry.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2026-05-27.dahlia",
});

const allowedOrigins = [
  "https://cestybezmapy.cz",
  "https://www.cestybezmapy.cz",
  "https://cesty-bez-mapy-admin.vercel.app",
  "https://admin.cestybezmapy.cz",
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

interface GetOrderRequest {
  session_id: string;
}

Deno.serve(withSentry(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    // Parse request body
    const body: GetOrderRequest = await req.json();
    const { session_id } = body;

    // Validace
    if (!session_id) {
      return new Response(
        JSON.stringify({
          error: "Chybí session_id",
        }),
        {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Looking up order for session: ${session_id}`);

    // Získání Stripe session pro payment_intent ID
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(session_id);
    } catch (stripeError) {
      console.error("Failed to retrieve Stripe session:", stripeError);
      return new Response(
        JSON.stringify({
          error: "Neplatná platební session",
        }),
        {
          status: 404,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    // Kontrola, že platba byla úspěšná
    if (session.payment_status !== "paid") {
      return new Response(
        JSON.stringify({
          status: "pending",
          message: "Platba ještě nebyla dokončena",
        }),
        {
          status: 200,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    const paymentIntentId = session.payment_intent as string;
    console.log(`Payment intent: ${paymentIntentId}`);

    // Vytvoření Supabase klienta
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      console.log("Order not found yet, webhook may still be processing");
      return new Response(
        JSON.stringify({
          status: "processing",
          message: "Objednávka se právě zpracovává",
        }),
        {
          status: 200,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Found order: ${order.id}`);

    // Verify ownership — session email must match order email (fail-closed:
    // deny if the session has no email or it does not match the order). (audit F13)
    const sessionEmail = session.customer_details?.email?.toLowerCase() ?? null;
    if (!sessionEmail || !order.customer_email ||
        sessionEmail !== order.customer_email.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "Přístup odepřen" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
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
      console.log("Download token not found:", tokenError);
    }

    // Načtení položek objednávky
    const { data: orderItems, error: itemsError } = await supabase
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

    if (itemsError) {
      console.error("Failed to load order items:", itemsError);
    }

    // Formátování položek pro odpověď
    // deno-lint-ignore no-explicit-any
    const items = (orderItems || []).map((item: any) => ({
      id: item.products?.id,
      title: item.products?.title,
      duration: item.products?.duration,
      image_url: item.products?.image_url,
      price: item.price_at_purchase,
      quantity: item.quantity,
      has_pdf: !!item.products?.pdf_url,
    }));

    // Vrácení objednávky
    return new Response(
      JSON.stringify({
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
      }),
      {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error getting order:", error);

    return new Response(
      JSON.stringify({
        error: "Nepodařilo se načíst objednávku",
      }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }
}, "get-order-by-session"));
