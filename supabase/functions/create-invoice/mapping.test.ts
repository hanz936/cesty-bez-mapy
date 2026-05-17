// mapping.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mapOrderToInvoice } from "./mapping.ts";
import type { OrderRow, OrderItemRow } from "./types.ts";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function baseOrder(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: "ord-1",
    customer_email: "buyer@example.cz",
    customer_name: "Jan Novák",
    total_amount: "499",
    stripe_payment_id: "pi_123",
    status: "completed",
    facturoid_invoice_id: null,
    facturoid_invoice_number: null,
    facturoid_invoice_url: null,
    facturoid_credit_note_id: null,
    facturoid_credit_note_number: null,
    invoice_sent: false,
    invoice_sent_at: null,
    invoice_error: null,
    is_company: false,
    company_name: null,
    company_ico: null,
    company_dic: null,
    billing_street: null,
    billing_city: null,
    billing_zip: null,
    ...overrides,
  };
}

function baseItems(): OrderItemRow[] {
  return [{
    product_id: "p-1",
    product_title: "Itálie 7 dní road trip",
    quantity: 1,
    price_at_purchase: "499",
    vat_rate_at_purchase: "21",
  }];
}

Deno.test("mapOrderToInvoice — B2C order has only name+email in subject", () => {
  const payload = mapOrderToInvoice(baseOrder(), baseItems());
  assertEquals(payload.subject.name, "Jan Novák");
  assertEquals(payload.subject.email, "buyer@example.cz");
  assertEquals(payload.subject.registration_no, undefined);
  assertEquals(payload.subject.vat_no, undefined);
  assertEquals(payload.subject.street, undefined);
});

Deno.test("mapOrderToInvoice — B2B order includes IČO, DIČ, address", () => {
  const order = baseOrder({
    is_company: true,
    company_name: "Acme s.r.o.",
    company_ico: "27082440",
    company_dic: "CZ27082440",
    billing_street: "Václavské nám. 1",
    billing_city: "Praha",
    billing_zip: "11000",
  });
  const payload = mapOrderToInvoice(order, baseItems());
  assertEquals(payload.subject.name, "Acme s.r.o.");
  assertEquals(payload.subject.registration_no, "27082440");
  assertEquals(payload.subject.vat_no, "CZ27082440");
  assertEquals(payload.subject.street, "Václavské nám. 1");
  assertEquals(payload.subject.country, "CZ");
});

Deno.test("mapOrderToInvoice — multi-item with different VAT rates", () => {
  const items: OrderItemRow[] = [
    { product_id: "p-1", product_title: "PDF guide", quantity: 1, price_at_purchase: "499", vat_rate_at_purchase: "21" },
    { product_id: "p-2", product_title: "E-book",    quantity: 2, price_at_purchase: "199", vat_rate_at_purchase: "12" },
  ];
  const payload = mapOrderToInvoice(baseOrder(), items);
  assertEquals(payload.lines.length, 2);
  assertEquals(payload.lines[0].vat_rate, 21);
  assertEquals(payload.lines[1].vat_rate, 12);
  assertEquals(payload.lines[1].quantity, 2);
});

Deno.test("mapOrderToInvoice — prices are passed as 'including VAT'", () => {
  const payload = mapOrderToInvoice(baseOrder(), baseItems());
  assertEquals(payload.prices_include_vat, true);
  assertEquals(payload.lines[0].unit_price, "499");
});

Deno.test("mapOrderToInvoice — dates are today, ISO format", () => {
  const payload = mapOrderToInvoice(baseOrder(), baseItems());
  assertEquals(ISO_DATE.test(payload.issued_on), true);
  assertEquals(payload.issued_on, payload.taxable_fulfillment_due);
  assertEquals(payload.issued_on, payload.due_on);
});

Deno.test("mapOrderToInvoice — metadata fields", () => {
  const payload = mapOrderToInvoice(baseOrder(), baseItems());
  assertEquals(payload.currency, "CZK");
  assertEquals(payload.language, "cz");
  assertEquals(payload.payment_method, "card");
  assertEquals(payload.custom_id, "ord-1");
  assertEquals(payload.note, "Stripe payment: pi_123");
});
