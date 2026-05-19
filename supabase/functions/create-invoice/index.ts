// ================================================
// Supabase Edge Function: create-invoice
// ================================================
// Issues a Fakturoid invoice for a paid order, downloads the PDF, and sends
// it to the customer via Resend (through the shared sendEmail wrapper).
// Idempotent on facturoid_invoice_id.
//
// Actions:
//   create              — first-time invoice for a paid order
//   retry               — admin manual retry after failure (same as create)
//   resend_email        — admin manual email resend (PDF re-attached)
//   credit_note         — issue credit note (refund)
//   cancel_and_reissue  — storno + new invoice (admin edited billing)
//
// Dual-caller: invoked by stripe-webhook (service-role JWT bypass) and by the
// admin UI via supabase.functions.invoke() (user JWT → is_admin RPC check).
// CORS configured for admin browser callers; webhook calls (server-to-server) ignore it.
// ================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { FakturoidClient, type TokenPersister } from "./fakturoid.ts";
import { mapOrderToInvoice } from "./mapping.ts";
import { isValidIco } from "./ares.ts";
import type {
  CreateInvoiceRequest, OrderRow, OrderItemRow,
} from "./types.ts";
import { sendEmail, makeResendClient } from "../_shared/email/sendEmail.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const ADMIN_ORIGINS = [
  "https://cesty-bez-mapy-admin.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
];

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ADMIN_ORIGINS.includes(origin) ? origin : ADMIN_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const resend = makeResendClient();

const CFG = {
  clientId: Deno.env.get("FAKTUROID_CLIENT_ID")!,
  clientSecret: Deno.env.get("FAKTUROID_CLIENT_SECRET")!,
  slug: Deno.env.get("FAKTUROID_SLUG")!,
  userAgent: Deno.env.get("FAKTUROID_USER_AGENT")!,
};

const ALERTS_ENABLED = Deno.env.get("FAKTUROID_ALERTS_ENABLED") === "true";
const ALERT_TO = Deno.env.get("FAKTUROID_ALERT_EMAIL") || "parma29@seznam.cz";

const persister: TokenPersister = {
  async load() {
    const { data } = await supabase.from("fakturoid_tokens").select("*").maybeSingle();
    if (!data) return null;
    return { token: data.access_token, expiresAt: new Date(data.expires_at) };
  },
  async save(t) {
    await supabase.from("fakturoid_tokens")
      .upsert({
        id: true,
        access_token: t.token,
        expires_at: t.expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      });
  },
};

const fakturoid = new FakturoidClient(CFG, fetch, { persister });

async function logIntegration(orderId: string, action: string, success: boolean, error?: string) {
  await supabase.from("integration_logs").insert({
    service: "facturoid",
    action,
    success,
    metadata: { order_id: orderId, error: error ?? null },
  });
}

async function sendAlertEmail(orderId: string, action: string, errorMessage: string): Promise<void> {
  if (!ALERTS_ENABLED) return;
  try {
    await sendEmail(resend, {
      type: "invoice-alert",
      to: ALERT_TO,
      idempotencyKey: `invoice-alert/${orderId}/${action}/${Date.now()}`,
      templateProps: { orderId, action, errorMessage },
    });
  } catch (e) {
    console.error("Failed to send alert email:", e);
  }
}

async function loadOrderWithItems(orderId: string): Promise<{ order: OrderRow; items: OrderItemRow[] }> {
  const { data: order, error: oErr } = await supabase
    .from("orders").select("*").eq("id", orderId).single();
  if (oErr || !order) throw new Error(`Order ${orderId} not found`);
  const { data: items, error: iErr } = await supabase
    .from("order_items")
    .select("product_id, quantity, price_at_purchase, vat_rate_at_purchase, products!inner(title)")
    .eq("order_id", orderId);
  if (iErr || !items) throw new Error(`Items for ${orderId} not found`);
  // deno-lint-ignore no-explicit-any
  const mapped: OrderItemRow[] = items.map((i: any) => ({
    product_id: i.product_id,
    product_title: i.products.title,
    quantity: i.quantity,
    price_at_purchase: i.price_at_purchase,
    vat_rate_at_purchase: i.vat_rate_at_purchase,
  }));
  return { order: order as OrderRow, items: mapped };
}

function bytesToBase64(bytes: Uint8Array): string {
  // Chunk to avoid call-stack overflow on large PDFs
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

async function sendInvoiceEmailFor(
  order: OrderRow,
  invoiceId: number,
  invoiceNumber: string,
  idempotencyKey: string,
) {
  const pdf = await fakturoid.downloadPdf(invoiceId);
  const pdfBase64 = bytesToBase64(pdf);
  await sendEmail(resend, {
    type: "invoice",
    to: order.customer_email,
    idempotencyKey,
    templateProps: {
      customerName: order.customer_name,
      orderId: order.id,
      invoiceNumber,
    },
    attachments: [{ filename: `faktura-${invoiceNumber}.pdf`, content: pdfBase64 }],
  });
  await supabase.from("orders").update({
    invoice_sent: true,
    invoice_sent_at: new Date().toISOString(),
  }).eq("id", order.id);
  await logIntegration(order.id, "send_invoice", true);
}

async function sendCreditNoteEmailFor(
  order: OrderRow,
  creditNoteId: number,
  creditNoteNumber: string,
) {
  const pdf = await fakturoid.downloadPdf(creditNoteId);
  const pdfBase64 = bytesToBase64(pdf);
  await sendEmail(resend, {
    type: "credit-note",
    to: order.customer_email,
    idempotencyKey: `credit-note/${order.id}`,
    templateProps: {
      customerName: order.customer_name,
      orderId: order.id,
      creditNoteNumber,
    },
    attachments: [{ filename: `dobropis-${creditNoteNumber}.pdf`, content: pdfBase64 }],
  });
  await logIntegration(order.id, "send_credit_note", true);
}

async function actionCreate(orderId: string): Promise<Response> {
  const { order, items } = await loadOrderWithItems(orderId);
  if (order.facturoid_invoice_id) {
    return jsonOk({ status: "already_invoiced", invoice_id: order.facturoid_invoice_id });
  }
  if (order.is_company && order.company_ico && !isValidIco(order.company_ico)) {
    const err = `Invalid IČO: ${order.company_ico}`;
    await supabase.from("orders").update({ invoice_error: err }).eq("id", orderId);
    await logIntegration(orderId, "create_invoice", false, err);
    await sendAlertEmail(orderId, "create_invoice", err);
    return jsonOk({ status: "validation_error", error: err });
  }
  try {
    const payload = mapOrderToInvoice(order, items);
    const invoice = await fakturoid.createInvoice(payload);
    await supabase.from("orders").update({
      facturoid_invoice_id: String(invoice.id),
      facturoid_invoice_number: invoice.number,
      facturoid_invoice_url: invoice.public_html_url,
      invoice_error: null,
    }).eq("id", orderId);
    await logIntegration(orderId, "create_invoice", true);
    await sendInvoiceEmailFor(order, invoice.id, invoice.number, `invoice/${order.id}`);
    return jsonOk({ status: "created", invoice_id: invoice.id, invoice_number: invoice.number });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from("orders").update({ invoice_error: msg }).eq("id", orderId);
    await logIntegration(orderId, "create_invoice", false, msg);
    await sendAlertEmail(orderId, "create_invoice", msg);
    return jsonOk({ status: "error", error: msg });
  }
}

async function actionResendEmail(orderId: string): Promise<Response> {
  const { order } = await loadOrderWithItems(orderId);
  if (!order.facturoid_invoice_id || !order.facturoid_invoice_number) {
    return jsonOk({ status: "no_invoice" });
  }
  const attempt = Date.now();
  try {
    await sendInvoiceEmailFor(
      order,
      Number(order.facturoid_invoice_id),
      order.facturoid_invoice_number,
      `invoice-retry/${order.id}/${attempt}`,
    );
    return jsonOk({ status: "resent" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logIntegration(orderId, "resend_invoice", false, msg);
    await sendAlertEmail(orderId, "resend_invoice", msg);
    return jsonOk({ status: "error", error: msg });
  }
}

async function actionCreditNote(orderId: string): Promise<Response> {
  const { order } = await loadOrderWithItems(orderId);
  if (!order.facturoid_invoice_id) {
    return jsonOk({ status: "no_invoice" });
  }
  if (order.facturoid_credit_note_id) {
    return jsonOk({ status: "already_credited", credit_note_id: order.facturoid_credit_note_id });
  }
  try {
    const cn = await fakturoid.createCreditNote(Number(order.facturoid_invoice_id));
    await supabase.from("orders").update({
      facturoid_credit_note_id: String(cn.id),
      facturoid_credit_note_number: cn.number,
    }).eq("id", orderId);
    await logIntegration(orderId, "create_credit_note", true);
    await sendCreditNoteEmailFor(order, cn.id, cn.number);
    return jsonOk({ status: "credited", credit_note_id: cn.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logIntegration(orderId, "create_credit_note", false, msg);
    await sendAlertEmail(orderId, "create_credit_note", msg);
    return jsonOk({ status: "error", error: msg });
  }
}

async function actionCancelAndReissue(orderId: string): Promise<Response> {
  const { order } = await loadOrderWithItems(orderId);
  if (!order.facturoid_invoice_id) return await actionCreate(orderId);
  const oldId = Number(order.facturoid_invoice_id);
  try {
    await fakturoid.cancelInvoice(oldId);
    await logIntegration(orderId, "cancel_invoice", true);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logIntegration(orderId, "cancel_invoice", false, msg);
    await sendAlertEmail(orderId, "cancel_invoice", msg);
    return jsonOk({ status: "cancel_failed", error: msg });
  }
  await supabase.from("orders").update({
    facturoid_invoice_id: null,
    facturoid_invoice_number: null,
    facturoid_invoice_url: null,
    invoice_sent: false,
    invoice_sent_at: null,
  }).eq("id", orderId);
  return await actionCreate(orderId);
}

function jsonOk(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: cors });

  // Dual-auth gate: service-role bypass (stripe-webhook) OR admin user (admin UI).
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401, headers: cors });
  }
  // Service-role bypass: webhook calls use the service-role JWT.
  // We compare the bearer token to SERVICE_ROLE_KEY directly — simpler and
  // faster than round-tripping through getUser() which would return null for
  // the service-role token.
  const bearer = authHeader.replace(/^Bearer\s+/i, "");
  const isServiceRole = bearer === SERVICE_ROLE_KEY;
  if (!isServiceRole) {
    // Admin role check — same pattern as download-invoice-pdf and resend-email.
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response("Unauthorized", { status: 401, headers: cors });
    }
    const { data: isAdmin } = await userClient.rpc("is_admin");
    if (!isAdmin) {
      return new Response("Forbidden", { status: 403, headers: cors });
    }
  }

  let body: CreateInvoiceRequest;
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400, headers: cors }); }
  if (!body.order_id || !body.action) {
    return new Response("Missing order_id or action", { status: 400, headers: cors });
  }

  let resp: Response;
  switch (body.action) {
    case "create":
    case "retry":
      resp = await actionCreate(body.order_id);
      break;
    case "resend_email":
      resp = await actionResendEmail(body.order_id);
      break;
    case "credit_note":
      resp = await actionCreditNote(body.order_id);
      break;
    case "cancel_and_reissue":
      resp = await actionCancelAndReissue(body.order_id);
      break;
    default:
      return new Response(`Unknown action: ${body.action}`, { status: 400, headers: cors });
  }
  for (const [k, v] of Object.entries(cors)) {
    resp.headers.set(k, v);
  }
  return resp;
});
