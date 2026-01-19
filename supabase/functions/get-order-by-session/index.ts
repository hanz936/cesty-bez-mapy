// ================================================
// Supabase Edge Function: Get Order By Session
// ================================================
// Načte objednávku podle Stripe session_id
// - Získá payment_intent ID ze Stripe API
// - Najde objednávku v DB podle stripe_payment_id
// - Vrátí download token a info o objednávce
// ================================================

import Stripe from "https://esm.sh/stripe@20?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2025-12-15.clover",
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GetOrderRequest {
  session_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Found order: ${order.id}`);

    // Načtení download tokenu
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
        download_expires_at: downloadToken?.expires_at || null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error getting order:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Neznámá chyba",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
