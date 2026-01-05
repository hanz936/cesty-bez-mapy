// ================================================
// Supabase Edge Function: Create Stripe Product
// ================================================
// Description: Automatically creates Product + Price in Stripe
//              when a new product is created in Admin panel
// ================================================

import Stripe from "https://esm.sh/stripe@20?target=denonext";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2025-12-15",
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateProductRequest {
  title: string;
  description: string;
  price: number; // Price in CZK (koruna)
  image_url?: string;
  product_id: string; // Database product UUID
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body: CreateProductRequest = await req.json();
    const { title, description, price, image_url, product_id } = body;

    // Validation
    if (!title || !price || !product_id) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: title, price, product_id",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `Creating Stripe product for: ${title} (${price} CZK) - DB ID: ${product_id}`
    );

    // Step 1: Create Stripe Product
    const product = await stripe.products.create({
      name: title,
      description: description || undefined,
      images: image_url ? [image_url] : undefined,
      metadata: {
        supabase_product_id: product_id, // Link to our database
      },
    });

    console.log(`Stripe Product created: ${product.id}`);

    // Step 2: Create Stripe Price (in CZK)
    const stripePrice = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(price * 100), // Convert CZK to cents (699 -> 69900)
      currency: "czk",
      metadata: {
        supabase_product_id: product_id,
      },
    });

    console.log(
      `Stripe Price created: ${stripePrice.id} (${price} CZK / ${stripePrice.unit_amount} haléřů)`
    );

    // Return both IDs
    return new Response(
      JSON.stringify({
        success: true,
        stripe_product_id: product.id,
        stripe_price_id: stripePrice.id,
        price_amount: stripePrice.unit_amount,
        currency: stripePrice.currency,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error creating Stripe product:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
