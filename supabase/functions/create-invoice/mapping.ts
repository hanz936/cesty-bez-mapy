// mapping.ts
import type { FakturoidInvoicePayload, OrderRow, OrderItemRow } from "./types.ts";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function mapOrderToInvoice(
  order: OrderRow,
  items: OrderItemRow[],
): FakturoidInvoicePayload {
  const today = todayIso();

  const subject = order.is_company
    ? {
        name: order.company_name!,
        email: order.customer_email,
        registration_no: order.company_ico!,
        vat_no: order.company_dic ?? undefined,
        street: order.billing_street!,
        city: order.billing_city!,
        zip: order.billing_zip!,
        country: "CZ",
      }
    : {
        name: order.customer_name,
        email: order.customer_email,
      };

  const lines = items.map((item) => ({
    name: item.product_title,
    quantity: item.quantity,
    unit_price: item.price_at_purchase,
    vat_rate: Number(item.vat_rate_at_purchase),
  }));

  return {
    subject,
    lines,
    prices_include_vat: true,
    currency: "CZK",
    language: "cz",
    payment_method: "card",
    issued_on: today,
    taxable_fulfillment_due: today,
    due_on: today,
    note: `Stripe payment: ${order.stripe_payment_id}`,
    custom_id: order.id,
  };
}
