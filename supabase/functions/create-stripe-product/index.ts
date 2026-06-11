// ================================================
// Supabase Edge Function: Create Stripe Product
// ================================================
// Description: Automatically creates Product + Price in Stripe
//              when a new product is created in Admin panel
// ================================================

import Stripe from "https://esm.sh/stripe@20?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry } from "../_shared/sentry.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2025-12-15.clover",
});

const allowedOrigins = [
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

interface CreateProductRequest {
  title: string;
  description: string;
  price: number; // Price in CZK (koruna)
  image_url?: string;
  product_id: string; // Database product UUID
  stripe_product_id?: string; // Optional: existing Stripe Product ID for price updates
  force_recreate?: boolean; // audit 3.7.4: skip update path, always create a NEW product + price
}

Deno.serve(withSentry(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    // Auth check - only admins can create/update Stripe products
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Neplatný token" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Přístup odepřen - vyžadována role admin" }),
        { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: CreateProductRequest = await req.json();
    const { title, description, price, image_url, product_id, stripe_product_id, force_recreate } = body;

    // Validation
    if (!title || !price || !product_id) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: title, price, product_id",
        }),
        {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    if (typeof price !== "number" || price <= 0 || price > 100000) {
      return new Response(
        JSON.stringify({ error: "Neplatná cena - musí být číslo mezi 0 a 100 000 Kč" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (typeof title !== "string" || title.length > 500) {
      return new Response(
        JSON.stringify({ error: "Neplatný název produktu (string, max 500 znaků)" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (description !== undefined && (typeof description !== "string" || description.length > 2000)) {
      return new Response(
        JSON.stringify({ error: "Neplatný popis produktu (string, max 2000 znaků)" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (image_url !== undefined && (typeof image_url !== "string" || !image_url.startsWith("https://"))) {
      return new Response(
        JSON.stringify({ error: "Neplatná image_url (musí začínat https://)" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    let productId: string;

    // If stripe_product_id exists AND we're not force-recreating, just create a new Price
    // for the existing Product. force_recreate (audit 3.7.4) is used after swapping
    // STRIPE_SECRET_KEY test->live, where stored stripe_product_id/stripe_price_id point
    // at test-mode objects that don't exist in live - in that case we must always create
    // a brand new Stripe Product + Price, ignoring any incoming stripe_product_id.
    if (stripe_product_id && !force_recreate) {
      console.log(
        `Updating Stripe price for existing product: ${stripe_product_id} (${price} CZK)`
      );
      productId = stripe_product_id;

      // Optionally update product details in Stripe
      await stripe.products.update(stripe_product_id, {
        name: title,
        description: description || undefined,
        images: image_url ? [image_url] : undefined,
      });
    } else {
      // Create new Stripe Product
      console.log(
        force_recreate
          ? `Force-recreating Stripe product for: ${title} (${price} CZK) - DB ID: ${product_id}`
          : `Creating Stripe product for: ${title} (${price} CZK) - DB ID: ${product_id}`
      );

      const product = await stripe.products.create({
        name: title,
        description: description || undefined,
        images: image_url ? [image_url] : undefined,
        metadata: {
          supabase_product_id: product_id, // Link to our database
        },
      });

      console.log(`Stripe Product created: ${product.id}`);
      productId = product.id;
    }

    // Create Stripe Price (in CZK)
    const stripePrice = await stripe.prices.create({
      product: productId,
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
        stripe_product_id: productId,
        stripe_price_id: stripePrice.id,
        price_amount: stripePrice.unit_amount,
        currency: stripePrice.currency,
      }),
      {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error creating Stripe product:", error);

    return new Response(
      JSON.stringify({
        error: "Nepodařilo se vytvořit produkt ve Stripe",
      }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }
}, "create-stripe-product"));
