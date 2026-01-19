// ================================================
// Supabase Edge Function: Stripe Webhook Handler
// ================================================
// Zpracovává webhook události od Stripe:
// - checkout.session.completed
// - Vytváří objednávky v databázi
// - Generuje download tokeny pro PDF
// ================================================

import Stripe from "https://esm.sh/stripe@20?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2025-12-15.clover",
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

// Pomocná funkce pro generování náhodného tokenu
function generateToken(length: number = 32): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    token += chars[randomValues[i] % chars.length];
  }
  return token;
}

// Pomocná funkce pro generování čísla objednávky
function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CBM-${year}-${randomPart}`;
}

Deno.serve(async (req) => {
  // Stripe posílá POST requesty
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Získání těla požadavku jako text pro ověření signatury
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      console.error("Chybí Stripe signature header");
      return new Response("Missing signature", { status: 400 });
    }

    // Ověření webhook signatury - kritické pro bezpečnost!
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error(`Webhook signature verification failed: ${errorMessage}`);
      return new Response(`Webhook signature verification failed`, {
        status: 400,
      });
    }

    console.log(`Webhook event received: ${event.type}, ID: ${event.id}`);

    // Vytvoření Supabase klienta s service_role pro bypass RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Zpracování různých typů událostí
    let result: { success: boolean; error?: string; orderId?: string } = { success: true };

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        result = await handleCheckoutCompleted(supabase, session);
        break;
      }

      case "payment_intent.succeeded": {
        // Alternativní event - můžeme použít jako fallback
        console.log("Payment intent succeeded:", event.data.object);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.error(
          `Payment failed for ${paymentIntent.id}:`,
          paymentIntent.last_payment_error?.message
        );
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Pokud se order nevytvořil, vrátíme chybu (Stripe bude opakovat)
    if (!result.success) {
      console.error(`Webhook processing failed: ${result.error}`);
      return new Response(
        JSON.stringify({ received: true, error: result.error }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ received: true, orderId: result.orderId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// Zpracování úspěšně dokončené checkout session
async function handleCheckoutCompleted(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  session: Stripe.Checkout.Session
): Promise<{ success: boolean; error?: string; orderId?: string }> {
  console.log(`Processing completed checkout: ${session.id}`);
  console.log(`Session metadata:`, JSON.stringify(session.metadata));
  console.log(`Payment intent:`, session.payment_intent);
  console.log(`Customer details:`, JSON.stringify(session.customer_details));

  // Získání metadata
  const metadata = session.metadata || {};
  let productIds = metadata.product_ids?.split(",").filter(Boolean) || [];
  const supabaseUserId = metadata.supabase_user_id || null;
  const customerName =
    metadata.customer_name ||
    session.customer_details?.name ||
    "Neznámý zákazník";
  const customerEmail =
    session.customer_details?.email || session.customer_email || "";

  // Pokud nemáme product_ids z metadata, zkusíme je získat z line_items
  if (productIds.length === 0) {
    console.log("No product_ids in metadata, trying to fetch from line_items...");
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        expand: ["data.price.product"],
      });

      console.log(`Found ${lineItems.data.length} line items`);

      // Získat supabase_product_id z metadata produktů
      for (const item of lineItems.data) {
        const product = item.price?.product as Stripe.Product;
        console.log(`Line item product:`, product?.id, product?.metadata);
        if (product?.metadata?.supabase_product_id) {
          productIds.push(product.metadata.supabase_product_id);
        }
      }
      console.log(`Extracted product IDs from Stripe:`, productIds);
    } catch (lineItemsError) {
      console.error("Failed to fetch line items:", lineItemsError);
    }
  }

  if (productIds.length === 0) {
    const error = "No product_ids found in session metadata or line_items";
    console.error(error);
    return { success: false, error };
  }

  // Kontrola, zda objednávka už neexistuje (idempotence)
  const { data: existingOrder } = await supabase
    .from("orders")
    .select("id")
    .eq("stripe_payment_id", session.payment_intent as string)
    .single();

  if (existingOrder) {
    console.log(
      `Order already exists for payment ${session.payment_intent}, skipping`
    );
    return { success: true, orderId: existingOrder.id };
  }

  // Načtení produktů z databáze
  console.log(`Loading products from database: ${productIds.join(", ")}`);
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, title, price, vat_rate, pdf_url")
    .in("id", productIds);

  console.log(`Products query result:`, { products, error: productsError });

  if (productsError) {
    const error = `Failed to load products: ${JSON.stringify(productsError)}`;
    console.error(error);
    return { success: false, error };
  }

  if (!products || products.length === 0) {
    const error = `No products found for IDs: ${productIds.join(", ")}`;
    console.error(error);
    return { success: false, error };
  }

  // Hledání nebo vytvoření zákazníka
  let customerId: string | null = null;

  if (customerEmail) {
    // Hledání existujícího zákazníka
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("email", customerEmail)
      .single();

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      // Vytvoření nového zákazníka s vygenerovaným UUID
      const newCustomerId = crypto.randomUUID();
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({
          id: newCustomerId,
          email: customerEmail,
          name: customerName,
          total_spent: 0,
        })
        .select("id")
        .single();

      if (customerError) {
        console.error("Failed to create customer:", customerError);
      } else {
        customerId = newCustomer.id;
      }
    }
  }

  // Výpočet celkové částky
  const totalAmount = session.amount_total
    ? session.amount_total / 100
    : products.reduce(
        (sum: number, p: { price: number }) => sum + p.price,
        0
      );

  // Vytvoření objednávky
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      auth_user_id: supabaseUserId,
      customer_id: customerId,
      customer_email: customerEmail,
      customer_name: customerName,
      total_amount: totalAmount,
      stripe_payment_id: session.payment_intent as string,
      status: "completed",
    })
    .select("id")
    .single();

  if (orderError) {
    const error = `Failed to create order: ${JSON.stringify(orderError)}`;
    console.error(error);
    return { success: false, error };
  }

  console.log(`Order created: ${order.id}`);

  // Vytvoření order_items
  const orderItems = products.map(
    (product: { id: string; price: number; vat_rate: number }) => ({
      order_id: order.id,
      product_id: product.id,
      quantity: 1,
      price_at_purchase: product.price,
      vat_rate_at_purchase: product.vat_rate || 21.0,
    })
  );

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItems);

  if (itemsError) {
    console.error("Failed to create order items:", itemsError);
  } else {
    console.log(`Created ${orderItems.length} order items`);
  }

  // Vytvoření jediného download tokenu pro celou objednávku
  // Token umožňuje stažení všech PDF z objednávky přes order_items
  const hasProductsWithPdf = products.some(
    (product: { pdf_url?: string }) => product.pdf_url
  );

  if (hasProductsWithPdf) {
    const downloadToken = {
      order_id: order.id,
      token: generateToken(48),
      expires_at: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ).toISOString(), // 7 dní
    };

    const { error: tokenError } = await supabase
      .from("download_tokens")
      .insert(downloadToken);

    if (tokenError) {
      console.error("Failed to create download token:", tokenError);
    } else {
      console.log(`Created download token for order: ${downloadToken.token.substring(0, 8)}...`);
    }
  }

  // Aktualizace total_spent u zákazníka
  if (customerId) {
    const { error: updateError } = await supabase.rpc("increment_customer_spent", {
      p_customer_id: customerId,
      p_amount: totalAmount,
    });

    // Pokud RPC neexistuje, použijeme klasický update
    if (updateError) {
      console.log("RPC not available, using direct update");
      const { data: customer } = await supabase
        .from("customers")
        .select("total_spent")
        .eq("id", customerId)
        .single();

      if (customer) {
        await supabase
          .from("customers")
          .update({
            total_spent: (customer.total_spent || 0) + totalAmount,
            last_purchase_at: new Date().toISOString(),
          })
          .eq("id", customerId);
      }
    }
  }

  console.log(
    `Checkout processing completed for session ${session.id}, order ${order.id}`
  );

  return { success: true, orderId: order.id };
}
