// mapping.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mapOrderToInvoice, mapOrderToStornoInvoice, mapOrderToSubject } from "./mapping.ts";
import type { OrderRow, OrderItemRow } from "./types.ts";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SUBJECT_ID = 12345;

function baseOrder(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: "ord-1",
    customer_email: "buyer@example.cz",
    customer_name: "Jan Novák",
    total_amount: "499",
    stripe_payment_id: "pi_123",
    status: "completed",
    fakturoid_invoice_id: null,
    fakturoid_invoice_number: null,
    fakturoid_invoice_url: null,
    fakturoid_storno_id: null,
    fakturoid_storno_number: null,
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

Deno.test("mapOrderToSubject — B2C order has name+email+country+custom_id", () => {
  const subject = mapOrderToSubject(baseOrder());
  assertEquals(subject.name, "Jan Novák");
  assertEquals(subject.email, "buyer@example.cz");
  assertEquals(subject.country, "CZ");
  assertEquals(subject.custom_id, "buyer@example.cz");
  assertEquals(subject.registration_no, undefined);
  assertEquals(subject.vat_no, undefined);
  assertEquals(subject.street, undefined);
});

Deno.test("mapOrderToSubject — B2B order includes IČO, DIČ, address, custom_id", () => {
  const order = baseOrder({
    is_company: true,
    company_name: "Acme s.r.o.",
    company_ico: "27082440",
    company_dic: "CZ27082440",
    billing_street: "Václavské nám. 1",
    billing_city: "Praha",
    billing_zip: "11000",
  });
  const subject = mapOrderToSubject(order);
  assertEquals(subject.name, "Acme s.r.o.");
  assertEquals(subject.registration_no, "27082440");
  assertEquals(subject.vat_no, "CZ27082440");
  assertEquals(subject.street, "Václavské nám. 1");
  assertEquals(subject.city, "Praha");
  assertEquals(subject.zip, "11000");
  assertEquals(subject.country, "CZ");
  assertEquals(subject.custom_id, "buyer@example.cz");
});

Deno.test("mapOrderToInvoice — references subject_id, no inline subject", () => {
  const payload = mapOrderToInvoice(baseOrder(), baseItems(), SUBJECT_ID);
  assertEquals(payload.subject_id, SUBJECT_ID);
});

Deno.test("mapOrderToInvoice — every line has vat_rate=0 (Jana is neplátce DPH)", () => {
  const items: OrderItemRow[] = [
    { product_id: "p-1", product_title: "PDF guide", quantity: 1, price_at_purchase: "499", vat_rate_at_purchase: "21" },
    { product_id: "p-2", product_title: "E-book",    quantity: 2, price_at_purchase: "199", vat_rate_at_purchase: "12" },
  ];
  const payload = mapOrderToInvoice(baseOrder(), items, SUBJECT_ID);
  assertEquals(payload.lines.length, 2);
  assertEquals(payload.lines[0].vat_rate, 0);
  assertEquals(payload.lines[1].vat_rate, 0);
  assertEquals(payload.lines[1].quantity, 2);
});

Deno.test("mapOrderToInvoice — dates are today, ISO format", () => {
  const payload = mapOrderToInvoice(baseOrder(), baseItems(), SUBJECT_ID);
  assertEquals(ISO_DATE.test(payload.issued_on), true);
  assertEquals(payload.issued_on, payload.due_on);
});

Deno.test("mapOrderToInvoice — omits taxable_fulfillment_due (neplátce DPH)", () => {
  const payload = mapOrderToInvoice(baseOrder(), baseItems(), SUBJECT_ID);
  assertEquals(payload.taxable_fulfillment_due, undefined);
});

Deno.test("mapOrderToInvoice — metadata fields", () => {
  const payload = mapOrderToInvoice(baseOrder(), baseItems(), SUBJECT_ID);
  assertEquals(payload.currency, "CZK");
  assertEquals(payload.language, "cz");
  assertEquals(payload.payment_method, "card");
  assertEquals(payload.custom_id, "ord-1");
  assertEquals(payload.note, "Stripe payment: pi_123");
});

Deno.test("mapOrderToInvoice — due=0 (paid via Stripe, due on issue date)", () => {
  const payload = mapOrderToInvoice(baseOrder(), baseItems(), SUBJECT_ID);
  assertEquals(payload.due, 0);
});

Deno.test("mapOrderToInvoice — hide_bank_account=true (Stripe-paid, bank not needed)", () => {
  const payload = mapOrderToInvoice(baseOrder(), baseItems(), SUBJECT_ID);
  assertEquals(payload.hide_bank_account, true);
});

Deno.test("mapOrderToStornoInvoice — every line quantity is negated", () => {
  const items: OrderItemRow[] = [
    { product_id: "p-1", product_title: "PDF guide", quantity: 1, price_at_purchase: "499", vat_rate_at_purchase: "0" },
    { product_id: "p-2", product_title: "E-book",    quantity: 3, price_at_purchase: "199", vat_rate_at_purchase: "0" },
  ];
  const payload = mapOrderToStornoInvoice(baseOrder(), items, SUBJECT_ID, "2026-0042");
  assertEquals(payload.lines.length, 2);
  assertEquals(payload.lines[0].quantity, -1);
  assertEquals(payload.lines[1].quantity, -3);
  assertEquals(payload.lines[0].vat_rate, 0);
});

Deno.test("mapOrderToStornoInvoice — note references original invoice and Stripe refund", () => {
  const payload = mapOrderToStornoInvoice(baseOrder(), baseItems(), SUBJECT_ID, "2026-0042");
  assertEquals(
    payload.note,
    "Storno faktury 2026-0042 z důvodu vrácení peněz. Stripe refund: pi_123",
  );
  assertEquals(payload.custom_id, "ord-1-storno");
  assertEquals(payload.subject_id, SUBJECT_ID);
  assertEquals(payload.taxable_fulfillment_due, undefined);
});

Deno.test("mapOrderToStornoInvoice — due=0 and hide_bank_account=true", () => {
  const payload = mapOrderToStornoInvoice(baseOrder(), baseItems(), SUBJECT_ID, "2026-0042");
  assertEquals(payload.due, 0);
  assertEquals(payload.hide_bank_account, true);
});
