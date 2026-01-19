// ================================================
// Supabase Edge Function: Create Stripe Checkout Session
// ================================================
// Vytvoří Stripe Checkout Session pro platbu
// - Přijme pole produktů (product IDs)
// - Načte stripe_price_id z databáze
// - Vytvoří Stripe Checkout Session
// - Podporuje anonymous users
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

interface LineItem {
  product_id: string;
  quantity?: number;
}

interface CreateCheckoutRequest {
  line_items: LineItem[];
  customer_email?: string;
  customer_name?: string;
  success_url: string;
  cancel_url: string;
  user_id?: string; // Supabase auth user ID (může být anonymous)
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body: CreateCheckoutRequest = await req.json();
    const {
      line_items,
      customer_email,
      customer_name,
      success_url,
      cancel_url,
      user_id,
    } = body;

    // Validace
    if (!line_items || !Array.isArray(line_items) || line_items.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Chybí položky k objednání (line_items)",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!success_url || !cancel_url) {
      return new Response(
        JSON.stringify({
          error: "Chybí success_url nebo cancel_url",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `Vytvářím Checkout Session pro ${line_items.length} položek, user: ${user_id || "anonymous"}`
    );

    // Vytvoření Supabase klienta pro načtení produktů
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Načtení stripe_price_id pro všechny produkty z databáze
    const productIds = line_items.map((item) => item.product_id);

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, title, stripe_price_id, price")
      .in("id", productIds)
      .eq("is_active", true)
      .eq("is_deleted", false);

    if (productsError) {
      console.error("Chyba při načítání produktů:", productsError);
      return new Response(
        JSON.stringify({
          error: "Nepodařilo se načíst produkty z databáze",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Žádné platné produkty nebyly nalezeny",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Kontrola, že všechny produkty mají stripe_price_id
    const missingStripeProducts = products.filter((p) => !p.stripe_price_id);
    if (missingStripeProducts.length > 0) {
      console.error(
        "Produkty bez stripe_price_id:",
        missingStripeProducts.map((p) => p.title)
      );
      return new Response(
        JSON.stringify({
          error: `Některé produkty nemají nastavenou cenu ve Stripe: ${missingStripeProducts.map((p) => p.title).join(", ")}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Mapování line_items na Stripe formát
    const stripeLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
      products.map((product) => {
        const requestItem = line_items.find(
          (item) => item.product_id === product.id
        );
        return {
          price: product.stripe_price_id,
          quantity: requestItem?.quantity || 1,
        };
      });

    console.log(
      "Stripe line items:",
      stripeLineItems.map((item) => `${item.price} x${item.quantity}`)
    );

    // Příprava metadata pro session
    const metadata: Record<string, string> = {
      product_ids: productIds.join(","),
    };

    // Přidání user_id pokud existuje (anonymous nebo registered)
    if (user_id) {
      metadata.supabase_user_id = user_id;
    }

    // Přidání customer info pokud existuje
    if (customer_name) {
      metadata.customer_name = customer_name;
    }

    // Vytvoření Stripe Checkout Session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: stripeLineItems,
      success_url: success_url,
      cancel_url: cancel_url,
      metadata: metadata,
      locale: "cs", // Čeština
      // Sbírat email pokud není předvyplněn
      customer_email: customer_email || undefined,
      // Pokud nemáme email, necháme Stripe sbírat billing details
      billing_address_collection: customer_email ? "auto" : "required",
      // Umožnit úpravu množství
      // Poznámka: Pro digitální produkty většinou nechceme měnit množství
    };

    // Pokud nemáme email, sbíráme ho v Stripe formuláři
    if (!customer_email) {
      sessionParams.customer_creation = "always";
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(`Stripe Checkout Session vytvořena: ${session.id}`);

    // Vrácení URL pro redirect
    return new Response(
      JSON.stringify({
        success: true,
        session_id: session.id,
        url: session.url,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Chyba při vytváření Checkout Session:", error);

    // Specifické chyby od Stripe
    if (error instanceof Stripe.errors.StripeError) {
      return new Response(
        JSON.stringify({
          error: `Stripe chyba: ${error.message}`,
          code: error.code,
        }),
        {
          status: error.statusCode || 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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
