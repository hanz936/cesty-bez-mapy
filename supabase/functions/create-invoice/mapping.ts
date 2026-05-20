// mapping.ts
import type {
  FakturoidInvoicePayload, FakturoidSubjectPayload,
  OrderRow, OrderItemRow,
} from "./types.ts";

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function mapOrderToSubject(order: OrderRow): FakturoidSubjectPayload {
  if (order.is_company) {
    return {
      name: order.company_name!,
      email: order.customer_email,
      registration_no: order.company_ico!,
      vat_no: order.company_dic ?? undefined,
      street: order.billing_street!,
      city: order.billing_city!,
      zip: order.billing_zip!,
      country: "CZ",
      custom_id: order.customer_email,
    };
  }
  return {
    name: order.customer_name,
    email: order.customer_email,
    country: "CZ",
    custom_id: order.customer_email,
  };
}

export function mapOrderToInvoice(
  order: OrderRow,
  items: OrderItemRow[],
  subjectId: number,
): FakturoidInvoicePayload {
  const today = todayIso();

  const lines = items.map((item) => ({
    name: item.product_title,
    quantity: item.quantity,
    unit_price: item.price_at_purchase,
    vat_rate: 0,
  }));

  return {
    subject_id: subjectId,
    lines,
    prices_include_vat: false,
    currency: "CZK",
    language: "cz",
    payment_method: "card",
    issued_on: today,
    due_on: today,
    due: 0,
    note: `Stripe payment: ${order.stripe_payment_id}`,
    custom_id: order.id,
    hide_bank_account: true,
  };
}

export function mapOrderToStornoInvoice(
  order: OrderRow,
  items: OrderItemRow[],
  subjectId: number,
  originalInvoiceNumber: string,
): FakturoidInvoicePayload {
  const today = todayIso();
  const lines = items.map((item) => ({
    name: item.product_title,
    quantity: -item.quantity, // záporné = storno
    unit_price: item.price_at_purchase,
    vat_rate: 0,
  }));
  return {
    subject_id: subjectId,
    lines,
    prices_include_vat: false,
    currency: "CZK",
    language: "cz",
    payment_method: "card",
    issued_on: today,
    due_on: today,
    due: 0,
    note: `Storno faktury ${originalInvoiceNumber} z důvodu vrácení peněz. Stripe refund: ${order.stripe_payment_id}`,
    custom_id: `${order.id}-storno`,
    hide_bank_account: true,
  };
}
