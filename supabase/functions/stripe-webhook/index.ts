// ================================================
// Supabase Edge Function: Stripe Webhook Handler
// ================================================
// Zpracovává webhook události od Stripe:
// - checkout.session.completed
// - Vytváří objednávky v databázi
// - Generuje download tokeny pro PDF
// ================================================

import Stripe from "https://esm.sh/stripe@22.2.0?target=denonext";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, makeResendClient, cancelScheduledEmail } from "../_shared/email/sendEmail.ts";
import { EmailSuppressedError } from "../_shared/email/types.ts";
import {
  decideEmailTypes,
  buildOrderConfirmationItems,
  parseAdminRecipients,
  buildAdminNotificationItems,
  buildAdminOrderUrl,
  computeOrderTotal,
  haleruToCzk,
  reviewInvitationScheduledAt,
  reviewTokenExpiresAt,
} from "./lib.ts";
import { serveEdge } from "../_shared/serveEdge.ts";
import { makeEcomailClient, getEcomailListId } from "../_shared/ecomail/config.ts";
import { syncCustomerToEcomail } from "../_shared/ecomail/syncCustomer.ts";
import { logInfo, logWarn, logError, maskEmail } from "../_shared/log.ts";
import type { Database } from "../_shared/database.types.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2026-05-27.dahlia",
});

// Supabase Edge Runtime extends the global scope with EdgeRuntime.waitUntil,
// which lets a background task keep running after the response is returned.
// Not present in `deno test` / `deno check` outside the edge runtime, hence
// the optional declaration + runtime guard at the call site.
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

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

serveEdge({ auth: "none", fnName: "stripe-webhook" }, async (req, ctx) => {
  // Stripe posílá POST requesty
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Získání těla požadavku jako text pro ověření signatury
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      logError("webhook_missing_signature_header");
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
      logError("webhook_signature_verification_failed", { message: errorMessage });
      return new Response(`Webhook signature verification failed`, {
        status: 400,
      });
    }

    logInfo("webhook_event_received", { event_type: event.type, event_id: event.id });

    // Supabase klient s privilegovaným (secret) klíčem pro bypass RLS —
    // dodává ho serveEdge wrapper (auth: "none" — reálná brána je Stripe
    // signature verification výše).
    const supabase = ctx.supabaseAdmin;

    // Zpracování různých typů událostí
    let result: { success: boolean; error?: string; orderId?: string; retryable?: boolean } = { success: true };

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        result = await handleCheckoutCompleted(supabase, session);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logError("payment_intent_failed", {
          payment_intent_id: paymentIntent.id,
          message: paymentIntent.last_payment_error?.message,
        });
        try {
          await sendPaymentFailedEmail(paymentIntent, supabase);
        } catch (emailError) {
          // Webhook must still return 200 — Stripe shouldn't retry the
          // whole webhook just because an email send glitched.
          logError("payment_failed_email_send_failed", { error: String(emailError) });
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string;
        if (!paymentIntentId) {
          logWarn("charge_refunded_without_payment_intent");
          break;
        }

        const { data: order, error: updateError } = await supabase
          .from("orders")
          .update({ status: "refunded" })
          .eq("stripe_payment_id", paymentIntentId)
          .select("id, customer_email, customer_name, refund_email_sent_at, total_amount")
          .single();

        if (updateError) {
          if (updateError.code === "PGRST116") {
            // No matching order — permanent, retry won't help.
            logWarn("refund_no_order_found", { payment_intent_id: paymentIntentId });
          } else {
            // Transient DB error (unavailable, timeout, ...) — let Stripe retry.
            // Safe to retry: refund email is idempotent via refund_email_sent_at
            // + Resend idempotencyKey, and storno faktura has its own idempotency.
            result = {
              success: false,
              retryable: true,
              error: `Failed to update order on refund: ${updateError.message}`,
            };
          }
          break;
        }
        if (!order) {
          logWarn("refund_no_order_found", { payment_intent_id: paymentIntentId });
          break;
        }

        logInfo("order_refunded", { payment_intent_id: paymentIntentId });

        // Best-effort: cancel the scheduled review invitation (token is already dead
        // via orders.status check, this just avoids sending a pointless email).
        try {
          const { data: reviewRequest } = await supabase
            .from("review_requests")
            .select("invitation_email_id")
            .eq("order_id", order.id)
            .maybeSingle();
          if (reviewRequest?.invitation_email_id) {
            await cancelScheduledEmail(makeResendClient(), reviewRequest.invitation_email_id);
          }
        } catch (cancelError) {
          logWarn("review_invitation_cancel_failed", { order_id: order.id, error: String(cancelError) });
        }

        if (order.refund_email_sent_at) {
          logInfo("refund_email_already_sent", { order_id: order.id });
          break;
        }

        try {
          const amount = haleruToCzk(charge.amount_refunded);
          const emailResult = await sendEmail(makeResendClient(), {
            type: "refund",
            to: order.customer_email,
            idempotencyKey: `refund/${charge.id}`,
            templateProps: {
              // orders.customer_name je v DB nullable (typ `string | null`);
              // RefundProps.customerName očekává `string`. Runtime hodnota se
              // NEMĚNÍ (případný null projde stejně jako dřív s `any`); `as string`
              // je jen typový most — vocativeFirstName si s prázdnou/null hodnotou poradí.
              customerName: order.customer_name as string,
              orderId: order.id,
              amount,
            },
          }, { supabase });

          await supabase
            .from("orders")
            .update({
              refund_email_sent_at: new Date().toISOString(),
              refund_email_message_id: emailResult.messageId,
            })
            .eq("id", order.id);
        } catch (emailError) {
          logError("refund_email_send_failed", { error: String(emailError) });
        }

        // Storno faktura assumes a full refund. For partial refunds, admin must handle manually.
        const refundedAmountCzk = haleruToCzk(charge.amount_refunded);
        const orderTotalCzk = Number(order.total_amount);
        if (refundedAmountCzk < orderTotalCzk - 0.01) {
          logWarn("partial_refund_skip_storno", {
            order_id: order.id,
            refunded_czk: refundedAmountCzk,
            order_total_czk: orderTotalCzk,
          });
          break;
        }

        // Issue storno faktura (neplátce DPH) for the refunded invoice.
        // Fire-and-forget — does not block the refund email or webhook ack.
        await fireCreateStornoInvoice(supabase, order.id);
        break;
      }

      default:
        logInfo("webhook_unhandled_event_type", { event_type: event.type });
    }

    // Pokud se order nevytvořil, rozlišujeme retryable vs permanent chyby
    if (!result.success) {
      logError("webhook_processing_failed", { error: result.error, retryable: result.retryable });
      if (result.retryable) {
        // Retryable chyba (DB dočasně nedostupná, timeout) - vrátit 500 aby Stripe opakoval
        return new Response(
          JSON.stringify({ received: true, error: "Dočasná chyba, zkuste znovu" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      } else {
        // Permanentní chyba (nevalidní data, produkt neexistuje) - vrátit 200 aby Stripe neopakoval
        logError("webhook_permanent_error_no_retry", { error: result.error });
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
    logError("webhook_processing_error", { error: String(error) });
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
async function sendPaymentFailedEmail(pi: Stripe.PaymentIntent, supabase: SupabaseClient<Database>): Promise<void> {
  const sessions = await stripe.checkout.sessions.list({
    payment_intent: pi.id,
    limit: 1,
  });
  const session = sessions.data[0];
  const email = session?.customer_details?.email;
  if (!email) {
    logInfo("payment_failed_no_customer_email", { payment_intent_id: pi.id });
    return;
  }

  // Empty customer name is OK — vocative helper handles missing names.
  const customerName = session.customer_details?.name?.trim() || "";

  const result = await sendEmail(makeResendClient(), {
    type: "payment-failed",
    to: email,
    idempotencyKey: `payment-failed/${pi.id}`,
    templateProps: { customerName, referenceId: pi.id },
  }, { supabase });

  logInfo("payment_failed_email_sent", { payment_intent_id: pi.id, message_id: result.messageId });
}

async function fireCreateInvoice(supabase: SupabaseClient<Database>, orderId: string): Promise<void> {
  try {
    // Fire-and-forget: we await invoke() to ensure the request reaches the
    // function gateway before the webhook returns, but we don't depend on
    // its outcome. If Fakturoid is down, the invoice can be retried from
    // the admin UI; the order itself must be considered successful.
    const { error } = await supabase.functions.invoke("create-invoice", {
      body: { order_id: orderId, action: "create" },
    });
    if (error) logError("create_invoice_invoke_failed", { order_id: orderId, error: String(error) });
  } catch (e) {
    logError("create_invoice_invoke_threw", { order_id: orderId, error: String(e) });
    // Never re-throw: Stripe webhook must succeed regardless of invoice issuance.
  }
}

async function fireCreateStornoInvoice(supabase: SupabaseClient<Database>, orderId: string): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("create-invoice", {
      body: { order_id: orderId, action: "storno_invoice" },
    });
    if (error) logError("create_storno_invoice_invoke_failed", { order_id: orderId, error: String(error) });
  } catch (e) {
    logError("create_storno_invoice_invoke_threw", { order_id: orderId, error: String(e) });
  }
}

// Best-effort: zapíše GDPR consent log a přihlásí zákazníka do Ecomailu.
// Nikdy nethrowuje — selhání nesmí shodit webhook.
async function syncOrderToEcomail(
  supabase: SupabaseClient<Database>,
  args: { orderId: string; customerId: string | null; email: string | null; name: string | null; metadata: Record<string, string> },
): Promise<void> {
  try {
    if (args.metadata.marketing_consent !== "true" || !args.email || !args.customerId) return;
    const { error: logErr } = await supabase.from("newsletter_consent_log").insert({
      email: args.email,
      consent_given: true,
      source: "checkout",
      ip_address: args.metadata.consent_ip || null,
      user_agent: args.metadata.consent_ua || null,
      privacy_policy_version: args.metadata.privacy_policy_version || null,
    });
    if (logErr) {
      logError("ecomail_consent_log_insert_failed", { order_id: args.orderId, message: logErr.message });
      return; // bez zapsaného souhlasu NEpřihlašujeme do Ecomailu
    }
    await syncCustomerToEcomail({
      client: makeEcomailClient(),
      supabase,
      listId: getEcomailListId(),
      customerId: args.customerId,
      orderId: args.orderId,
      email: args.email,
      name: args.name ?? undefined,
    });
  } catch (e) {
    logError("ecomail_sync_failed", { order_id: args.orderId, error: String(e) });
  }
}

// Zpracování úspěšně dokončené checkout session
async function handleCheckoutCompleted(
  supabase: SupabaseClient<Database>,
  session: Stripe.Checkout.Session
): Promise<{ success: boolean; error?: string; orderId?: string; retryable?: boolean }> {
  logInfo("checkout_processing_started", { session_id: session.id });
  logInfo("checkout_session_metadata", {
    product_ids: session.metadata?.product_ids,
    user: session.metadata?.supabase_user_id || "anonymous",
    custom_requests: session.metadata?.custom_requests || "none",
  });
  logInfo("checkout_payment_intent", { payment_intent: session.payment_intent });
  logInfo("checkout_customer_email_domain", { domain: maskEmail(session.customer_details?.email ?? "") });

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
      logWarn("custom_requests_parse_failed", { error: String(parseError) });
    }
  }

  // Pokud nemáme product_ids z metadata, zkusíme je získat z line_items
  if (productIds.length === 0) {
    logInfo("checkout_no_product_ids_metadata_fallback_line_items");
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        expand: ["data.price.product"],
      });

      logInfo("checkout_line_items_found", { count: lineItems.data.length });

      // Získat supabase_product_id z metadata produktů
      for (const item of lineItems.data) {
        const product = item.price?.product as Stripe.Product;
        logInfo("checkout_line_item_product", { product_id: product?.id, metadata: product?.metadata });
        if (product?.metadata?.supabase_product_id) {
          productIds.push(product.metadata.supabase_product_id);
        }
      }
      logInfo("checkout_product_ids_extracted", { product_ids: productIds });
    } catch (lineItemsError) {
      logError("checkout_fetch_line_items_failed", { error: String(lineItemsError) });
    }
  }

  if (productIds.length === 0) {
    const error = "No product_ids found in session metadata or line_items";
    logError("checkout_no_product_ids", { error });
    return { success: false, error, retryable: false };
  }

  // Idempotence řeší atomicky RPC create_order_with_items přes ON CONFLICT
  // na stripe_payment_id - žádná předběžná kontrola tu není, aby retry
  // mohl doplnit položky, které by jinak chyběly z částečně neúspěšného běhu.

  // Načtení produktů z databáze
  logInfo("checkout_loading_products", { product_ids: productIds });
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, title, price, vat_rate, pdf_url, slug, stripe_price_id")
    .in("id", productIds);

  logInfo("checkout_products_query_result", { products, error: productsError });

  if (productsError) {
    const error = `Failed to load products: ${JSON.stringify(productsError)}`;
    logError("checkout_load_products_failed", { error });
    return { success: false, error, retryable: true };
  }

  if (!products || products.length === 0) {
    const error = `No products found for IDs: ${productIds.join(", ")}`;
    logError("checkout_no_products_found", { error, product_ids: productIds });
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
        logError("checkout_create_customer_failed", { message: customerError.message });
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
        logError("checkout_create_guest_customer_failed", { message: customerError.message });
        customerId = null;
      } else {
        customerId = newCustomer.id;
      }
    }
  }

  // Výpočet celkové částky
  const totalAmount = computeOrderTotal(session, products);

  // Načtení Stripe line items pro správné quantity a zaplacené ceny
  let stripeLineItems: Stripe.LineItem[] = [];
  try {
    const lineItemsResponse = await stripe.checkout.sessions.listLineItems(session.id);
    stripeLineItems = lineItemsResponse.data;
    logInfo("checkout_stripe_line_items_loaded", { count: stripeLineItems.length });
  } catch (lineItemsError) {
    logError("checkout_fetch_stripe_line_items_failed", { error: String(lineItemsError) });
  }

  // Sestavení položek pro RPC (kvantita a cena z Stripe line items)
  const orderItems = products.map(
    (product) => {
      const stripeItem = stripeLineItems.find(
        (item) => item.price?.id === product.stripe_price_id
      );
      const quantity = stripeItem?.quantity ?? 1;
      // amount_total je celková cena za položku v haléřích (quantity * jednotková cena)
      const paidAmount = stripeItem ? haleruToCzk(stripeItem.amount_total) : product.price;
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
    (product) => product.pdf_url
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
    logError("checkout_create_order_rpc_failed", { error });
    return { success: false, error, retryable: true };
  }

  // RPC `create_order_with_items` vrací `Json` (viz database.types.ts) — narrow
  // na očekávaný tvar { order_id, was_created }. Runtime přístup nezměněn.
  const rpc = rpcResult as { order_id?: string; was_created?: boolean } | null;
  const orderId = rpc?.order_id as string;
  const wasCreated = rpc?.was_created as boolean;
  logInfo("checkout_processing_completed", {
    session_id: session.id,
    order_id: orderId,
    was_created: wasCreated,
  });

  // Email odešleme jen při prvním vytvoření objednávky. Při Stripe retry
  // (wasCreated=false) je objednávka už uložená a e-maily už byly poslané
  // (nebo selhaly trvale — Resend idempotencyKey je zachytí, kdyby se přesto
  // znovu pokusily projít).
  if (wasCreated) {
    // Follow-up práce (e-maily, Ecomail sync, faktura) neblokuje odpověď
    // webhooku — Stripe potřebuje 2xx co nejdřív, aby nedošlo k timeoutu
    // (viz audit 3.1.1). Běží na pozadí přes EdgeRuntime.waitUntil; v lokálním
    // testu / `functions serve` bez EdgeRuntime se prostě odawaituje.
    const followUps = runFollowUps({
      supabase,
      sessionId: session.id,
      orderId,
      customerId,
      customerEmail,
      customerName,
      totalAmount,
      products,
      orderItems,
      productIds,
      customRequestsMapping,
      downloadToken: downloadTokenString,
      metadata: metadata as Record<string, string>,
    });

    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime) {
      EdgeRuntime.waitUntil(followUps);
    } else {
      await followUps; // lokální deno test / functions serve fallback
    }
  }

  return { success: true, orderId };
}

interface FollowUpContext extends CheckoutEmailContext {
  customerId: string | null;
  metadata: Record<string, string>;
}

// Follow-up práce po úspěšném vytvoření objednávky: e-maily, Ecomail sync,
// faktura. Každý krok má vlastní try/catch — selhání jednoho nesmí ovlivnit
// ostatní ani (dnes už odeslanou) odpověď webhooku.
async function runFollowUps(ctx: FollowUpContext): Promise<void> {
  try {
    try {
      await sendCheckoutEmails(ctx);
    } catch (emailError) {
      logError("checkout_emails_failed", { order_id: ctx.orderId, error: String(emailError) });
    }

    try {
      await sendAdminNotification(ctx);
    } catch (adminNotificationError) {
      logError("admin_notification_failed", { order_id: ctx.orderId, error: String(adminNotificationError) });
    }

    try {
      await scheduleReviewInvitation(ctx);
    } catch (reviewInvitationError) {
      logError("review_invitation_failed", { order_id: ctx.orderId, error: String(reviewInvitationError) });
    }

    try {
      await syncOrderToEcomail(ctx.supabase, {
        orderId: ctx.orderId,
        customerId: ctx.customerId,
        email: ctx.customerEmail,
        name: ctx.customerName ?? null,
        metadata: ctx.metadata,
      });
    } catch (ecomailError) {
      logError("ecomail_sync_step_failed", { order_id: ctx.orderId, error: String(ecomailError) });
    }

    // Issue invoice for newly created orders only.
    // Retries (Stripe webhook delivery retries) land here too — idempotency
    // check inside create-invoice handles them.
    await fireCreateInvoice(ctx.supabase, ctx.orderId);
  } catch (e) {
    // Pojistka: webhook už vrátil 200, neodchycená chyba by tu skončila jako
    // unhandled rejection uvnitř EdgeRuntime.waitUntil. Kroky výše mají vlastní
    // catch — tohle se spustí, jen pokud ten kontrakt poruší budoucí změna.
    logError("run_follow_ups_unexpected_error", { order_id: ctx.orderId, error: String(e) });
  }
}

// Review invitation (spec: ADM docs/superpowers/specs/2026-07-11-reviews-system-design.md §4.1).
// Primary dedup guard = INSERT with ignoreDuplicates on review_requests.order_id UNIQUE:
// the email is scheduled ONLY when this call actually inserted the row. Resend
// idempotencyKey (24h window) is just a second layer for short-term retries.
async function scheduleReviewInvitation(ctx: FollowUpContext): Promise<void> {
  if (!ctx.customerEmail) {
    logWarn("review_invitation_no_customer_email", { order_id: ctx.orderId });
    return;
  }

  const { data: request, error: insertError } = await ctx.supabase
    .from("review_requests")
    .upsert(
      { order_id: ctx.orderId, expires_at: reviewTokenExpiresAt(new Date()) },
      { onConflict: "order_id", ignoreDuplicates: true },
    )
    .select("id, token")
    .maybeSingle();

  if (insertError) {
    logError("review_request_insert_failed", { order_id: ctx.orderId, error: insertError.message });
    return;
  }
  if (!request) {
    // Conflict -> row already existed (webhook replay). Email was already scheduled.
    logInfo("review_request_already_exists", { order_id: ctx.orderId });
    return;
  }

  const reviewUrl = `${SITE_URL}/recenze/pridat?token=${request.token}`;
  let messageId: string;
  try {
    const result = await sendEmail(makeResendClient(), {
      type: "review-invitation",
      to: ctx.customerEmail,
      idempotencyKey: `review-invitation/${ctx.orderId}`,
      scheduledAt: reviewInvitationScheduledAt(new Date()),
      templateProps: {
        customerName: ctx.customerName,
        reviewUrl,
        productTitles: ctx.products.map((p) => p.title),
      },
    }, { supabase: ctx.supabase });
    messageId = result.messageId;
  } catch (err) {
    if (err instanceof EmailSuppressedError) {
      logInfo("review_invitation_suppressed", { order_id: ctx.orderId });
      return;
    }
    throw err;
  }

  const { error: updateError } = await ctx.supabase
    .from("review_requests")
    .update({ invitation_email_id: messageId })
    .eq("id", request.id);
  if (updateError) {
    // Non-fatal: only breaks best-effort cancel-on-refund for this order.
    logWarn("review_request_email_id_update_failed", { order_id: ctx.orderId, error: updateError.message });
  }
}

interface CheckoutEmailContext {
  supabase: SupabaseClient<Database>;
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
    logWarn("checkout_emails_no_customer_email", { order_id: ctx.orderId });
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
      }, { supabase: ctx.supabase });
      primaryMessageId = result.messageId;
    } catch (err) {
      logError("order_confirmation_email_failed", { order_id: ctx.orderId, error: String(err) });
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
      }, { supabase: ctx.supabase });
      // Smíšený košík: OrderConfirmation jde první, takže její messageId
      // vyhrává. Admin UI (úkol 25) může v případě potřeby zobrazit oba ID.
      primaryMessageId = primaryMessageId ?? result.messageId;
    } catch (err) {
      logError("custom_itinerary_received_email_failed", { order_id: ctx.orderId, error: String(err) });
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
      logError("email_tracking_persist_failed", { order_id: ctx.orderId, message: trackingError.message });
    }
  }
}

// Interní notifikace pro admina (Janu) o nové zaplacené objednávce.
// Itinerář na míru = kritický signál (závazek začít plánovat), proto má
// vlastní subjekt i banner. Fire-and-forget: selhání se loguje a nikdy
// neblokuje webhook, zákaznické e-maily, Ecomail sync ani fakturu.
// Idempotence: wasCreated guard v handleru + Resend idempotencyKey per adresa.
async function sendAdminNotification(ctx: FollowUpContext): Promise<void> {
  const recipients = parseAdminRecipients(
    Deno.env.get("ADMIN_NOTIFICATION_EMAIL")
  );
  const decision = decideEmailTypes(ctx.productIds, ctx.customRequestsMapping);
  const items = buildAdminNotificationItems(ctx.products, ctx.orderItems);
  const adminOrderUrl = buildAdminOrderUrl(
    Deno.env.get("ADMIN_PANEL_URL"),
    ctx.orderId
  );

  const resend = makeResendClient();
  for (const recipient of recipients) {
    try {
      await sendEmail(resend, {
        type: "admin-order-notification",
        to: recipient,
        idempotencyKey: `admin-order-notification/${ctx.orderId}/${recipient}`,
        templateProps: {
          orderId: ctx.orderId,
          customerName: ctx.customerName,
          customerEmail: ctx.customerEmail,
          items,
          totalAmount: ctx.totalAmount,
          hasCustomItinerary: decision.hasCustomItinerary,
          adminOrderUrl,
        },
      }, { supabase: ctx.supabase });
    } catch (err) {
      // Jedna selhaná adresa nesmí zastavit odeslání ostatním příjemcům.
      logError("admin_order_notification_email_failed", {
        order_id: ctx.orderId,
        recipient_domain: maskEmail(recipient),
        error: String(err),
      });
    }
  }
}
