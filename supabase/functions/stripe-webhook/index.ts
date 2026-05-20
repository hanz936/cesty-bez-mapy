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
import { sendEmail, makeResendClient } from "../_shared/email/sendEmail.ts";
import {
  decideEmailTypes,
  buildOrderConfirmationItems,
} from "./lib.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2025-12-15.clover",
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://cestybezmapy.cz";

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
    let result: { success: boolean; error?: string; orderId?: string; retryable?: boolean } = { success: true };

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
        try {
          await sendPaymentFailedEmail(paymentIntent);
        } catch (emailError) {
          // Webhook must still return 200 — Stripe shouldn't retry the
          // whole webhook just because an email send glitched.
          console.error("Failed to send PaymentFailed email:", emailError);
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string;
        if (!paymentIntentId) {
          console.warn("charge.refunded without payment_intent, skipping");
          break;
        }

        const { data: order, error: updateError } = await supabase
          .from("orders")
          .update({ status: "refunded" })
          .eq("stripe_payment_id", paymentIntentId)
          .select("id, customer_email, customer_name, refund_email_sent_at")
          .single();

        if (updateError) {
          console.error("Failed to update order on refund:", updateError);
          break;
        }
        if (!order) {
          console.warn(
            "No order found for refunded payment_intent:",
            paymentIntentId
          );
          break;
        }

        console.log(`Order refunded for payment intent: ${paymentIntentId}`);

        if (order.refund_email_sent_at) {
          console.log(`Refund email already sent for order ${order.id}, skipping`);
          break;
        }

        try {
          const amount = charge.amount_refunded / 100;
          const emailResult = await sendEmail(makeResendClient(), {
            type: "refund",
            to: order.customer_email,
            idempotencyKey: `refund/${charge.id}`,
            templateProps: {
              customerName: order.customer_name,
              orderId: order.id,
              amount,
            },
          });

          await supabase
            .from("orders")
            .update({
              refund_email_sent_at: new Date().toISOString(),
              refund_email_message_id: emailResult.messageId,
            })
            .eq("id", order.id);
        } catch (emailError) {
          console.error("Failed to send Refund email:", emailError);
        }

        // Issue storno faktura (neplátce DPH) for the refunded invoice.
        // Fire-and-forget — does not block the refund email or webhook ack.
        await fireCreateStornoInvoice(supabase, order.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Pokud se order nevytvořil, rozlišujeme retryable vs permanent chyby
    if (!result.success) {
      console.error(`Webhook processing failed: ${result.error}`);
      if (result.retryable) {
        // Retryable chyba (DB dočasně nedostupná, timeout) - vrátit 500 aby Stripe opakoval
        return new Response(
          JSON.stringify({ received: true, error: "Dočasná chyba, zkuste znovu" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      } else {
        // Permanentní chyba (nevalidní data, produkt neexistuje) - vrátit 200 aby Stripe neopakoval
        console.error(`Permanent error, will not retry: ${result.error}`);
        return new Response(
          JSON.stringify({ received: true, error: "Permanentní chyba zpracování" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(JSON.stringify({ received: true, orderId: result.orderId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({
        error: "Interní chyba serveru",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// Send PaymentFailed email for a failed PaymentIntent. We look up the
// Checkout Session by PI to recover the customer's email + name, because
// the PaymentIntent itself doesn't carry billing_details until success.
async function sendPaymentFailedEmail(pi: Stripe.PaymentIntent): Promise<void> {
  const sessions = await stripe.checkout.sessions.list({
    payment_intent: pi.id,
    limit: 1,
  });
  const session = sessions.data[0];
  const email = session?.customer_details?.email;
  if (!email) {
    console.log(
      `No checkout session / customer email for PI ${pi.id}, skipping PaymentFailed email`
    );
    return;
  }

  // Empty customer name is OK — vocative helper handles missing names.
  const customerName = session.customer_details?.name?.trim() || "";

  const result = await sendEmail(makeResendClient(), {
    type: "payment-failed",
    to: email,
    idempotencyKey: `payment-failed/${pi.id}`,
    templateProps: { customerName, referenceId: pi.id },
  });

  console.log(
    `PaymentFailed email sent for PI ${pi.id}, messageId=${result.messageId}`
  );
}

// deno-lint-ignore no-explicit-any
async function fireCreateInvoice(supabase: any, orderId: string): Promise<void> {
  try {
    // Fire-and-forget: we await invoke() to ensure the request reaches the
    // function gateway before the webhook returns, but we don't depend on
    // its outcome. If Fakturoid is down, the invoice can be retried from
    // the admin UI; the order itself must be considered successful.
    const { error } = await supabase.functions.invoke("create-invoice", {
      body: { order_id: orderId, action: "create" },
    });
    if (error) console.error("create-invoice invoke failed:", error);
  } catch (e) {
    console.error("create-invoice invoke threw:", e);
    // Never re-throw: Stripe webhook must succeed regardless of invoice issuance.
  }
}

// deno-lint-ignore no-explicit-any
async function fireCreateStornoInvoice(supabase: any, orderId: string): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("create-invoice", {
      body: { order_id: orderId, action: "storno_invoice" },
    });
    if (error) console.error("create-invoice storno_invoice invoke failed:", error);
  } catch (e) {
    console.error("create-invoice storno_invoice invoke threw:", e);
  }
}

// Zpracování úspěšně dokončené checkout session
async function handleCheckoutCompleted(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  session: Stripe.Checkout.Session
): Promise<{ success: boolean; error?: string; orderId?: string; retryable?: boolean }> {
  console.log(`Processing completed checkout: ${session.id}`);
  console.log(`Session metadata: product_ids=${session.metadata?.product_ids}, user=${session.metadata?.supabase_user_id || 'anonymous'}, custom_requests=${session.metadata?.custom_requests || 'none'}`);
  console.log(`Payment intent:`, session.payment_intent);
  console.log(`Customer email domain: ${session.customer_details?.email?.split('@')[1] || 'unknown'}`);

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

  const isCompany = metadata.is_company === 'true';
  const companyName = isCompany ? (metadata.company_name || null) : null;
  const companyIco = isCompany ? (metadata.company_ico || null) : null;
  const companyDic = isCompany ? (metadata.company_dic || null) : null;
  const billingStreet = isCompany ? (metadata.billing_street || null) : null;
  const billingCity = isCompany ? (metadata.billing_city || null) : null;
  const billingZip = isCompany ? (metadata.billing_zip || null) : null;

  // Parsování mapy product_id -> custom_itinerary_request_id z metadata.
  // Při chybě JSON parse jen zalogujeme a pokračujeme s prázdnou mapou
  // (položky se nepropojí, ale objednávka se stejně vytvoří).
  let customRequestsMapping: Record<string, string> = {};
  if (metadata.custom_requests) {
    try {
      customRequestsMapping = JSON.parse(metadata.custom_requests);
    } catch (parseError) {
      console.warn(
        "Failed to parse custom_requests metadata, treating as empty:",
        parseError
      );
    }
  }

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
    return { success: false, error, retryable: false };
  }

  // Idempotence řeší atomicky RPC create_order_with_items přes ON CONFLICT
  // na stripe_payment_id - žádná předběžná kontrola tu není, aby retry
  // mohl doplnit položky, které by jinak chyběly z částečně neúspěšného běhu.

  // Načtení produktů z databáze
  console.log(`Loading products from database: ${productIds.join(", ")}`);
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, title, price, vat_rate, pdf_url, slug, stripe_price_id")
    .in("id", productIds);

  console.log(`Products query result:`, { products, error: productsError });

  if (productsError) {
    const error = `Failed to load products: ${JSON.stringify(productsError)}`;
    console.error(error);
    return { success: false, error, retryable: true };
  }

  if (!products || products.length === 0) {
    const error = `No products found for IDs: ${productIds.join(", ")}`;
    console.error(error);
    return { success: false, error, retryable: false };
  }

  // Hledání nebo vytvoření zákazníka
  let customerId: string | null = null;

  if (customerEmail) {
    // Hledání existujícího zákazníka podle emailu
    const { data: existingCustomer } = await supabase
      .from("customers")
      .select("id, name, email")
      .eq("email", customerEmail)
      .single();

    if (existingCustomer) {
      // Použít existujícího zákazníka
      customerId = existingCustomer.id;
      // Aktualizovat jméno pokud se změnilo
      if (customerName && existingCustomer.name !== customerName) {
        await supabase
          .from("customers")
          .update({ name: customerName })
          .eq("id", existingCustomer.id);
      }
    } else if (supabaseUserId) {
      // Nový zákazník s přihlášeným uživatelem - použít auth user ID jako customer ID
      // (zachovává invariantu customers.id = auth.users.id z migrace 013)
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({
          id: supabaseUserId,
          email: customerEmail,
          name: customerName || "Zákazník",
        })
        .select("id")
        .single();

      if (customerError) {
        console.error("Failed to create customer:", customerError);
        // Zákazník může už existovat s tímto ID ale jiným emailem
        customerId = supabaseUserId;
      } else {
        customerId = newCustomer.id;
      }
    } else {
      // Guest checkout bez přihlášení - vytvořit zákazníka s náhodným UUID
      const guestId = crypto.randomUUID();
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({
          id: guestId,
          email: customerEmail,
          name: customerName || "Host",
        })
        .select("id")
        .single();

      if (customerError) {
        console.error("Failed to create guest customer:", customerError);
        customerId = null;
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

  // Načtení Stripe line items pro správné quantity a zaplacené ceny
  let stripeLineItems: Stripe.LineItem[] = [];
  try {
    const lineItemsResponse = await stripe.checkout.sessions.listLineItems(session.id);
    stripeLineItems = lineItemsResponse.data;
    console.log(`Loaded ${stripeLineItems.length} Stripe line items for quantity/price resolution`);
  } catch (lineItemsError) {
    console.error("Failed to fetch Stripe line items for order_items:", lineItemsError);
  }

  // Sestavení položek pro RPC (kvantita a cena z Stripe line items)
  const orderItems = products.map(
    (product: { id: string; price: number; vat_rate: number; slug?: string; stripe_price_id?: string }) => {
      const stripeItem = stripeLineItems.find(
        (item) => item.price?.id === product.stripe_price_id
      );
      const quantity = stripeItem?.quantity ?? 1;
      // amount_total je celková cena za položku v haléřích (quantity * jednotková cena)
      const paidAmount = stripeItem ? stripeItem.amount_total / 100 : product.price;
      const pricePerUnit = paidAmount / quantity;

      return {
        product_id: product.id,
        quantity,
        price_at_purchase: pricePerUnit,
        vat_rate_at_purchase: product.vat_rate || 21.0,
        // Propojení s konkrétním záznamem custom_itinerary_requests podle product_id
        custom_itinerary_request_id: customRequestsMapping[product.id] || null,
      };
    }
  );

  // Download token generujeme jen pokud je v objednávce alespoň jeden produkt s PDF
  const hasProductsWithPdf = products.some(
    (product: { pdf_url?: string }) => product.pdf_url
  );
  const downloadTokenString = hasProductsWithPdf ? generateToken(48) : null;
  const downloadExpiresAt = hasProductsWithPdf
    ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 dní
    : null;

  // Atomické vytvoření objednávky + položek + souvisejících updateů.
  // RPC je idempotentní podle stripe_payment_id, retry vždy konverguje
  // do stejného finálního stavu.
  const payload = {
    stripe_payment_id: session.payment_intent as string,
    auth_user_id: supabaseUserId,
    customer_id: customerId,
    customer_email: customerEmail,
    customer_name: customerName,
    total_amount: totalAmount,
    items: orderItems,
    download_token: downloadTokenString,
    download_expires_at: downloadExpiresAt,
    is_company: isCompany,
    company_name: companyName,
    company_ico: companyIco,
    company_dic: companyDic,
    billing_street: billingStreet,
    billing_city: billingCity,
    billing_zip: billingZip,
  };

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "create_order_with_items",
    { p_payload: payload }
  );

  if (rpcError) {
    const error = `create_order_with_items RPC failed: ${JSON.stringify(rpcError)}`;
    console.error(error);
    return { success: false, error, retryable: true };
  }

  const orderId = rpcResult?.order_id as string;
  const wasCreated = rpcResult?.was_created as boolean;
  console.log(
    `Checkout processing completed for session ${session.id}, order ${orderId} (${wasCreated ? "created" : "already existed"})`
  );

  // Email odešleme jen při prvním vytvoření objednávky. Při Stripe retry
  // (wasCreated=false) je objednávka už uložená a e-maily už byly poslané
  // (nebo selhaly trvale — Resend idempotencyKey je zachytí, kdyby se přesto
  // znovu pokusily projít).
  if (wasCreated) {
    // Webhook musí vrátit 200 i kdyby selhala inicializace Resend klienta
    // nebo cokoli dalšího kolem e-mailů — objednávka je v DB a Stripe retry
    // by jen vedl k duplicitním e-mailům (idempotencyKey to sice zachytí,
    // ale je čistší to vůbec nezkoušet) nebo nekonečnému retry loopu.
    try {
      await sendCheckoutEmails({
        supabase,
        sessionId: session.id,
        orderId,
        customerEmail,
        customerName,
        totalAmount,
        products,
        orderItems,
        productIds,
        customRequestsMapping,
        downloadToken: downloadTokenString,
      });
    } catch (emailError) {
      console.error(
        `sendCheckoutEmails failed for order ${orderId}, continuing:`,
        emailError
      );
    }

    // Issue invoice for newly created orders only.
    // Retries (Stripe webhook delivery retries) land here too — idempotency
    // check inside create-invoice handles them.
    await fireCreateInvoice(supabase, orderId);
  }

  return { success: true, orderId };
}

interface CheckoutEmailContext {
  // deno-lint-ignore no-explicit-any
  supabase: any;
  sessionId: string;
  orderId: string;
  customerEmail: string;
  customerName: string;
  totalAmount: number;
  products: Array<{ id: string; title: string }>;
  orderItems: Array<{ product_id: string; quantity: number; price_at_purchase: number }>;
  productIds: string[];
  customRequestsMapping: Record<string, string>;
  downloadToken: string | null;
}

// Odeslání e-mailů po dokončení checkoutu. Každý send je v samostatném
// try/catch — selhání jednoho e-mailu nesmí shodit zpracování webhooku.
// Idempotency je zajištěna na 3 úrovních: wasCreated flag (handler nahoře),
// Resend idempotencyKey (per event-type), confirmation_email_sent_at (DB).
async function sendCheckoutEmails(ctx: CheckoutEmailContext): Promise<void> {
  if (!ctx.customerEmail) {
    console.warn(`No customer email for order ${ctx.orderId}, skipping emails`);
    return;
  }

  const decision = decideEmailTypes(ctx.productIds, ctx.customRequestsMapping);
  const items = buildOrderConfirmationItems(
    ctx.products,
    ctx.orderItems,
    decision.standardProductIds
  );
  const downloadUrl = ctx.downloadToken
    ? `${SITE_URL}/download/${ctx.downloadToken}`
    : undefined;

  const resend = makeResendClient();
  let primaryMessageId: string | null = null;

  if (decision.hasStandardProducts) {
    try {
      const result = await sendEmail(resend, {
        type: "order-confirmation",
        to: ctx.customerEmail,
        idempotencyKey: `checkout.session.completed/${ctx.sessionId}/order-confirmation`,
        templateProps: {
          customerName: ctx.customerName,
          orderId: ctx.orderId,
          items,
          totalAmount: ctx.totalAmount,
          downloadUrl,
        },
      });
      primaryMessageId = result.messageId;
    } catch (err) {
      console.error("Failed to send OrderConfirmation:", err);
    }
  }

  if (decision.hasCustomItinerary) {
    try {
      const result = await sendEmail(resend, {
        type: "custom-itinerary-payment-received",
        to: ctx.customerEmail,
        idempotencyKey: `checkout.session.completed/${ctx.sessionId}/custom-itinerary-received`,
        templateProps: {
          customerName: ctx.customerName,
          orderId: ctx.orderId,
        },
      });
      // Smíšený košík: OrderConfirmation jde první, takže její messageId
      // vyhrává. Admin UI (úkol 25) může v případě potřeby zobrazit oba ID.
      primaryMessageId = primaryMessageId ?? result.messageId;
    } catch (err) {
      console.error("Failed to send CustomItineraryReceived:", err);
    }
  }

  if (primaryMessageId) {
    const { error: trackingError } = await ctx.supabase
      .from("orders")
      .update({
        confirmation_email_sent_at: new Date().toISOString(),
        confirmation_email_message_id: primaryMessageId,
      })
      .eq("id", ctx.orderId);
    if (trackingError) {
      console.error("Failed to persist email tracking:", trackingError);
    }
  }
}
