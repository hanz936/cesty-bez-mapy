// ================================================
// Supabase Edge Function: Create Stripe Product
// ================================================
// Description: Automatically creates Product + Price in Stripe
//              when a new product is created in Admin panel
// ================================================

import Stripe from "https://esm.sh/stripe@22.2.0?target=denonext";
import { withSentry } from "../_shared/sentry.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/http.ts";
import { requireAdmin } from "../_shared/requireAdmin.ts";
import { logInfo, logWarn, logError } from "../_shared/log.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2026-05-27.dahlia",
});

interface CreateProductRequest {
  title: string;
  description: string;
  price: number; // Price in CZK (koruna)
  image_url?: string;
  image_urls?: string[]; // Card image + gallery (up to 8 https URLs) shown in Checkout
  product_id: string; // Database product UUID
  stripe_product_id?: string; // Optional: existing Stripe Product ID for price updates
  force_recreate?: boolean; // audit 3.7.4: skip update path, always create a NEW product + price
}

Deno.serve(withSentry(async (req) => {
  const cors = getCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    // Auth check - only admins can create/update Stripe products.
    // SEC-06: tightened from aal1 (user_roles.role==='admin') to is_admin()/aal2 via requireAdmin.
    const gate = await requireAdmin(req, cors);
    if (!gate.ok) return gate.response;

    // Parse request body
    const body: CreateProductRequest = await req.json();
    const { title, description, price, image_url, image_urls, product_id, stripe_product_id, force_recreate } = body;

    // Validation
    if (!title || !price || !product_id) {
      return jsonResponse(
        { error: "Missing required fields: title, price, product_id" },
        400,
        cors,
      );
    }

    if (typeof price !== "number" || price <= 0 || price > 100000) {
      return jsonResponse(
        { error: "Neplatná cena - musí být číslo mezi 0 a 100 000 Kč" },
        400,
        cors,
      );
    }

    if (typeof title !== "string" || title.length > 500) {
      return jsonResponse(
        { error: "Neplatný název produktu (string, max 500 znaků)" },
        400,
        cors,
      );
    }

    if (description !== undefined && (typeof description !== "string" || description.length > 2000)) {
      return jsonResponse(
        { error: "Neplatný popis produktu (string, max 2000 znaků)" },
        400,
        cors,
      );
    }

    if (image_url !== undefined && (typeof image_url !== "string" || !image_url.startsWith("https://"))) {
      return jsonResponse(
        { error: "Neplatná image_url (musí začínat https://)" },
        400,
        cors,
      );
    }

    if (
      image_urls !== undefined &&
      (!Array.isArray(image_urls) ||
        image_urls.length > 8 ||
        image_urls.some((u) => typeof u !== "string" || !u.startsWith("https://")))
    ) {
      return jsonResponse(
        { error: "Neplatné image_urls (pole až 8 https URL)" },
        400,
        cors,
      );
    }

    // Stripe Product images: prefer image_urls (card + gallery), fall back to single image_url.
    // Stripe replaces the whole array on update; omit (undefined) when there are none so we
    // don't accidentally clear existing images.
    const images: string[] | undefined =
      image_urls && image_urls.length > 0
        ? image_urls.slice(0, 8)
        : image_url
        ? [image_url]
        : undefined;

    let productId: string;

    // If stripe_product_id exists AND we're not force-recreating, just create a new Price
    // for the existing Product. force_recreate (audit 3.7.4) is used after swapping
    // STRIPE_SECRET_KEY test->live, where stored stripe_product_id/stripe_price_id point
    // at test-mode objects that don't exist in live - in that case we must always create
    // a brand new Stripe Product + Price, ignoring any incoming stripe_product_id.
    if (stripe_product_id && !force_recreate) {
      logInfo("stripe_price_update_for_existing_product", {
        stripe_product_id,
        price,
      });
      productId = stripe_product_id;

      // Optionally update product details in Stripe
      await stripe.products.update(stripe_product_id, {
        name: title,
        description: description || undefined,
        images,
      });
    } else {
      // Create new Stripe Product
      logInfo(
        force_recreate ? "stripe_product_force_recreate" : "stripe_product_create",
        { title, price, product_id },
      );

      const product = await stripe.products.create({
        name: title,
        description: description || undefined,
        images,
        metadata: {
          supabase_product_id: product_id, // Link to our database
        },
      });

      logInfo("stripe_product_created", { stripe_product_id: product.id });
      productId = product.id;

      // Force-recreate replaces the product, so best-effort archive the previous
      // one (passed as stripe_product_id) to avoid leaving an orphaned active
      // product behind. Tolerate failure: after a test->live key swap the old ID
      // belongs to the other mode and won't be found with the current key.
      if (force_recreate && stripe_product_id) {
        try {
          await stripe.products.update(stripe_product_id, { active: false });
          logInfo("stripe_product_archived", { stripe_product_id });
        } catch (archiveError) {
          logWarn("stripe_product_archive_failed", {
            stripe_product_id,
            error: archiveError instanceof Error ? archiveError.message : String(archiveError),
          });
        }
      }
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

    logInfo("stripe_price_created", {
      stripe_price_id: stripePrice.id,
      price,
      unit_amount: stripePrice.unit_amount,
    });

    // Return both IDs
    return jsonResponse(
      {
        success: true,
        stripe_product_id: productId,
        stripe_price_id: stripePrice.id,
        price_amount: stripePrice.unit_amount,
        currency: stripePrice.currency,
      },
      200,
      cors,
    );
  } catch (error) {
    logError("create_stripe_product_failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return jsonResponse(
      { error: "Nepodařilo se vytvořit produkt ve Stripe" },
      500,
      cors,
    );
  }
}, "create-stripe-product"));
