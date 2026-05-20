import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { FakturoidClient } from "./fakturoid.ts";

interface FetchCall { url: string; init?: RequestInit }

function makeFakeFetch(responses: Array<{ status: number; body: unknown }>) {
  const calls: FetchCall[] = [];
  let i = 0;
  const fn = async (url: string | URL, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(url), init });
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { fn, calls };
}

const CFG = {
  clientId: "cid", clientSecret: "csec", slug: "test", userAgent: "Test (a@b.cz)",
};

Deno.test("FakturoidClient.getToken — fetches and caches token", async () => {
  const { fn, calls } = makeFakeFetch([
    { status: 200, body: { access_token: "tok_abc", expires_in: 7200, token_type: "Bearer" } },
  ]);
  const client = new FakturoidClient(CFG, fn, { now: () => new Date("2026-05-16T10:00:00Z") });
  const tok1 = await client.getToken();
  const tok2 = await client.getToken();
  assertEquals(tok1, "tok_abc");
  assertEquals(tok2, "tok_abc");
  assertEquals(calls.length, 1);
  assertEquals(calls[0].url, "https://app.fakturoid.cz/api/v3/oauth/token");
});

Deno.test("FakturoidClient.getToken — refreshes when within 5 minutes of expiry", async () => {
  const { fn, calls } = makeFakeFetch([
    { status: 200, body: { access_token: "tok_old", expires_in: 240, token_type: "Bearer" } },
    { status: 200, body: { access_token: "tok_new", expires_in: 7200, token_type: "Bearer" } },
  ]);
  const client = new FakturoidClient(CFG, fn);
  const tok1 = await client.getToken();
  const tok2 = await client.getToken();
  assertEquals(tok1, "tok_old");
  assertEquals(tok2, "tok_new");
  assertEquals(calls.length, 2);
});

Deno.test("FakturoidClient.createInvoice — happy path", async () => {
  const { fn, calls } = makeFakeFetch([
    { status: 200, body: { access_token: "tok", expires_in: 7200, token_type: "Bearer" } },
    { status: 201, body: { id: 42, number: "2026-0042", public_html_url: "https://app.fakturoid.cz/test/invoices/42", pdf_url: "...", state: "open", total: "499.00" } },
  ]);
  const client = new FakturoidClient(CFG, fn);
  const invoice = await client.createInvoice({
    subject_id: 7,
    lines: [{ name: "Item", quantity: 1, unit_price: "499", vat_rate: 0 }],
    currency: "CZK", language: "cz", payment_method: "card",
    issued_on: "2026-05-16", taxable_fulfillment_due: "2026-05-16", due_on: "2026-05-16",
  });
  assertEquals(invoice.id, 42);
  assertEquals(invoice.number, "2026-0042");
  assertEquals(calls[1].url, "https://app.fakturoid.cz/api/v3/accounts/test/invoices.json");
  assertEquals(calls[1].init?.method, "POST");
  const body = JSON.parse(calls[1].init!.body as string);
  assertEquals(body.invoice.subject_id, 7);
});

Deno.test("FakturoidClient.createSubject — POSTs /subjects.json and returns id", async () => {
  const { fn, calls } = makeFakeFetch([
    { status: 200, body: { access_token: "tok", expires_in: 7200, token_type: "Bearer" } },
    { status: 201, body: { id: 555, name: "Jan Novák" } },
  ]);
  const client = new FakturoidClient(CFG, fn);
  const subject = await client.createSubject({
    name: "Jan Novák",
    email: "buyer@example.cz",
    country: "CZ",
  });
  assertEquals(subject.id, 555);
  assertEquals(calls[1].url, "https://app.fakturoid.cz/api/v3/accounts/test/subjects.json");
  assertEquals(calls[1].init?.method, "POST");
  const body = JSON.parse(calls[1].init!.body as string);
  assertEquals(body.name, "Jan Novák");
  assertEquals(body.country, "CZ");
});

Deno.test("FakturoidClient.createInvoice — retries 3x on 500", async () => {
  const { fn, calls } = makeFakeFetch([
    { status: 200, body: { access_token: "tok", expires_in: 7200, token_type: "Bearer" } },
    { status: 500, body: { message: "down" } },
    { status: 500, body: { message: "down" } },
    { status: 201, body: { id: 42, number: "2026-0042", public_html_url: "u", pdf_url: "p", state: "open", total: "499.00" } },
  ]);
  const client = new FakturoidClient(CFG, fn, { baseDelayMs: 0 });
  const invoice = await client.createInvoice({} as never);
  assertEquals(invoice.id, 42);
  assertEquals(calls.length, 4);
});

Deno.test("FakturoidClient.createInvoice — 422 does NOT retry", async () => {
  const { fn, calls } = makeFakeFetch([
    { status: 200, body: { access_token: "tok", expires_in: 7200, token_type: "Bearer" } },
    { status: 422, body: { errors: { "subject.name": ["can't be blank"] } } },
  ]);
  const client = new FakturoidClient(CFG, fn, { baseDelayMs: 0 });
  await assertRejects(
    () => client.createInvoice({} as never),
    Error,
    "422",
  );
  assertEquals(calls.length, 2);
});

Deno.test("FakturoidClient.createInvoice — refreshes token on 401 and retries once", async () => {
  const { fn, calls } = makeFakeFetch([
    { status: 200, body: { access_token: "tok_old", expires_in: 7200, token_type: "Bearer" } },
    { status: 401, body: {} },
    { status: 200, body: { access_token: "tok_new", expires_in: 7200, token_type: "Bearer" } },
    { status: 201, body: { id: 1, number: "2026-0001", public_html_url: "u", pdf_url: "p", state: "open", total: "499.00" } },
  ]);
  const client = new FakturoidClient(CFG, fn, { baseDelayMs: 0 });
  const inv = await client.createInvoice({} as never);
  assertEquals(inv.id, 1);
  assertEquals(calls.length, 4);
});

Deno.test("FakturoidClient.downloadPdf — returns bytes", async () => {
  const pdfBytes = new Uint8Array([37, 80, 68, 70]); // %PDF
  const calls: FetchCall[] = [];
  const fn = async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/oauth/token")) {
      return new Response(JSON.stringify({ access_token: "tok", expires_in: 7200, token_type: "Bearer" }), { status: 200 });
    }
    return new Response(pdfBytes, { status: 200, headers: { "Content-Type": "application/pdf" } });
  };
  const client = new FakturoidClient(CFG, fn);
  const bytes = await client.downloadPdf(42);
  assertEquals(bytes.length, 4);
  assertEquals(bytes[0], 37);
});

Deno.test("FakturoidClient.downloadPdf — retries on 204 and returns bytes once ready", async () => {
  const pdfBytes = new Uint8Array([37, 80, 68, 70]);
  const calls: FetchCall[] = [];
  let pdfAttempts = 0;
  const fn = async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/oauth/token")) {
      return new Response(JSON.stringify({ access_token: "tok", expires_in: 7200, token_type: "Bearer" }), { status: 200 });
    }
    pdfAttempts++;
    if (pdfAttempts < 3) return new Response(null, { status: 204 });
    return new Response(pdfBytes, { status: 200, headers: { "Content-Type": "application/pdf" } });
  };
  const client = new FakturoidClient(CFG, fn);
  const bytes = await client.downloadPdf(42, 0);
  assertEquals(bytes.length, 4);
  assertEquals(pdfAttempts, 3);
});

Deno.test("FakturoidClient.downloadPdf — throws after exhausting retries on persistent 204", async () => {
  const calls: FetchCall[] = [];
  const fn = async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/oauth/token")) {
      return new Response(JSON.stringify({ access_token: "tok", expires_in: 7200, token_type: "Bearer" }), { status: 200 });
    }
    return new Response(null, { status: 204 });
  };
  const client = new FakturoidClient(CFG, fn);
  await assertRejects(
    () => client.downloadPdf(42, 0),
    Error,
    "not ready",
  );
});

Deno.test("FakturoidClient.recordPayment — POSTs /invoices/{id}/payments.json with paid_on + mark_document_as_paid", async () => {
  const { fn, calls } = makeFakeFetch([
    { status: 200, body: { access_token: "tok", expires_in: 7200, token_type: "Bearer" } },
    { status: 201, body: {} },
  ]);
  const client = new FakturoidClient(CFG, fn);
  await client.recordPayment(42, "2026-05-20");
  assertEquals(calls[1].url, "https://app.fakturoid.cz/api/v3/accounts/test/invoices/42/payments.json");
  assertEquals(calls[1].init?.method, "POST");
  const body = JSON.parse(calls[1].init!.body as string);
  assertEquals(body.paid_on, "2026-05-20");
  assertEquals(body.mark_document_as_paid, true);
});

Deno.test("FakturoidClient.findOrCreateSubject — returns existing when custom_id lookup hits", async () => {
  const { fn, calls } = makeFakeFetch([
    { status: 200, body: { access_token: "tok", expires_in: 7200, token_type: "Bearer" } },
    { status: 200, body: [{ id: 999, name: "Jan Novák" }] },
  ]);
  const client = new FakturoidClient(CFG, fn);
  const subject = await client.findOrCreateSubject({
    name: "Jan Novák",
    email: "buyer@example.cz",
    country: "CZ",
    custom_id: "buyer@example.cz",
  });
  assertEquals(subject.id, 999);
  // Two calls: oauth + GET /subjects.json. No POST.
  assertEquals(calls.length, 2);
  assertEquals(calls[1].init?.method, "GET");
  assertEquals(
    calls[1].url,
    "https://app.fakturoid.cz/api/v3/accounts/test/subjects.json?custom_id=buyer%40example.cz",
  );
});

Deno.test("FakturoidClient.findOrCreateSubject — falls back to createSubject when lookup returns empty", async () => {
  const { fn, calls } = makeFakeFetch([
    { status: 200, body: { access_token: "tok", expires_in: 7200, token_type: "Bearer" } },
    { status: 200, body: [] },
    { status: 201, body: { id: 555, name: "Jan Novák" } },
  ]);
  const client = new FakturoidClient(CFG, fn);
  const subject = await client.findOrCreateSubject({
    name: "Jan Novák",
    email: "buyer@example.cz",
    country: "CZ",
    custom_id: "buyer@example.cz",
  });
  assertEquals(subject.id, 555);
  // oauth + GET (miss) + POST.
  assertEquals(calls.length, 3);
  assertEquals(calls[1].init?.method, "GET");
  assertEquals(calls[2].init?.method, "POST");
  assertEquals(calls[2].url, "https://app.fakturoid.cz/api/v3/accounts/test/subjects.json");
});

Deno.test("FakturoidClient.cancelInvoice — calls /invoices/{id}/fire.json?event=cancel", async () => {
  const { fn, calls } = makeFakeFetch([
    { status: 200, body: { access_token: "tok", expires_in: 7200, token_type: "Bearer" } },
    { status: 200, body: {} },
  ]);
  const client = new FakturoidClient(CFG, fn);
  await client.cancelInvoice(42);
  assertEquals(calls[1].url, "https://app.fakturoid.cz/api/v3/accounts/test/invoices/42/fire.json?event=cancel");
  assertEquals(calls[1].init?.method, "POST");
});

Deno.test("FakturoidClient with persister — loads token from DB on first call", async () => {
  const { fn, calls } = makeFakeFetch([
    { status: 201, body: { id: 1, number: "2026-0001", public_html_url: "u", pdf_url: "p", state: "open", total: "499.00" } },
  ]);
  const persister = {
    load: async () => ({ token: "tok_persisted", expiresAt: new Date(Date.now() + 7200_000) }),
    save: async () => {},
  };
  const client = new FakturoidClient(CFG, fn, { persister });
  await client.createInvoice({} as never);
  // Only one fetch: invoice POST. No /oauth/token call because persister provided the token.
  assertEquals(calls.length, 1);
});

Deno.test("FakturoidClient with persister — saves new token after fetch", async () => {
  const { fn } = makeFakeFetch([
    { status: 200, body: { access_token: "tok_fresh", expires_in: 7200, token_type: "Bearer" } },
  ]);
  let savedToken: string | null = null;
  const persister = {
    load: async () => null,
    save: async (t: { token: string; expiresAt: Date }) => { savedToken = t.token; },
  };
  const client = new FakturoidClient(CFG, fn, { persister });
  await client.getToken();
  assertEquals(savedToken, "tok_fresh");
});
