// ================================================
// Tests for sendEmail wrapper
// ================================================
// Run: deno test --allow-env --allow-net supabase/functions/_shared/email/sendEmail.test.ts
// ================================================

import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { sendEmail, type ResendClient } from "./sendEmail.ts";

// Mock Resend client builder
function mockResendClient(behaviors: Array<
  | { type: 'success'; messageId: string }
  | { type: 'error'; statusCode: number; message: string }
>): ResendClient {
  let callIndex = 0;
  return {
    emails: {
      send: async (_params: unknown) => {
        const behavior = behaviors[callIndex++];
        if (!behavior) {
          throw new Error("Mock client called more times than expected");
        }
        if (behavior.type === 'success') {
          return { data: { id: behavior.messageId }, error: null };
        }
        return {
          data: null,
          error: {
            statusCode: behavior.statusCode,
            message: behavior.message,
            name: `ResendError${behavior.statusCode}`,
          },
        };
      },
    },
  };
}

// Mock Resend client that records the last `send` payload for assertions.
function mockResendClientCapturing(messageId: string): {
  client: ResendClient;
  getLastCall: () => Record<string, unknown> | null;
} {
  let lastCall: Record<string, unknown> | null = null;
  const client: ResendClient = {
    emails: {
      send: async (params: unknown) => {
        lastCall = params as Record<string, unknown>;
        return { data: { id: messageId }, error: null };
      },
    },
  };
  return { client, getLastCall: () => lastCall };
}

Deno.test("sendEmail returns messageId on first-attempt success", async () => {
  const client = mockResendClient([{ type: 'success', messageId: 're_abc123' }]);

  const result = await sendEmail(client, {
    type: 'order-confirmation',
    to: 'customer@example.com',
    idempotencyKey: 'order-confirm/order-1',
    templateProps: {
      customerName: 'Jan',
      orderId: 'order-1',
      items: [{ productTitle: 'Toskánsko', quantity: 1, priceAtPurchase: 199 }],
      totalAmount: 199,
      downloadUrl: 'https://cestybezmapy.cz/stahnout?token=abc',
    },
  });

  assertEquals(result.messageId, 're_abc123');
  assertEquals(result.attempt, 1);
});

Deno.test("sendEmail retries on 429 and succeeds", async () => {
  const client = mockResendClient([
    { type: 'error', statusCode: 429, message: 'Rate limited' },
    { type: 'success', messageId: 're_retry_ok' },
  ]);

  const result = await sendEmail(client, {
    type: 'refund',
    to: 'customer@example.com',
    idempotencyKey: 'refund/order-2',
    templateProps: { customerName: 'Jan', orderId: 'order-2', amount: 199 },
  }, { maxRetries: 3, baseDelayMs: 10 });

  assertEquals(result.messageId, 're_retry_ok');
  assertEquals(result.attempt, 2);
});

Deno.test("sendEmail retries on 500 with exponential backoff and eventually fails", async () => {
  const client = mockResendClient([
    { type: 'error', statusCode: 500, message: 'Server error' },
    { type: 'error', statusCode: 500, message: 'Server error' },
    { type: 'error', statusCode: 500, message: 'Server error' },
  ]);

  await assertRejects(
    () => sendEmail(client, {
      type: 'payment-failed',
      to: 'customer@example.com',
      idempotencyKey: 'payment-failed/pi_3Oo123',
      templateProps: { customerName: 'Jan', referenceId: 'pi_3Oo123' },
    }, { maxRetries: 3, baseDelayMs: 10 }),
    Error,
    "Server error",
  );
});

Deno.test("sendEmail does NOT retry on 400 (bad request)", async () => {
  const client = mockResendClient([
    { type: 'error', statusCode: 400, message: 'Invalid recipient' },
  ]);

  await assertRejects(
    () => sendEmail(client, {
      type: 'order-confirmation',
      to: 'invalid',
      idempotencyKey: 'order-confirm/order-4',
      templateProps: {
        customerName: 'X', orderId: 'order-4',
        items: [], totalAmount: 0, downloadUrl: 'https://x',
      },
    }, { maxRetries: 3, baseDelayMs: 10 }),
    Error,
    "Invalid recipient",
  );
});

Deno.test("sendEmail does NOT retry on 409 (idempotency conflict)", async () => {
  const client = mockResendClient([
    { type: 'error', statusCode: 409, message: 'Idempotency conflict' },
  ]);

  await assertRejects(
    () => sendEmail(client, {
      type: 'order-confirmation',
      to: 'customer@example.com',
      idempotencyKey: 'order-confirm/order-5',
      templateProps: {
        customerName: 'X', orderId: 'order-5',
        items: [], totalAmount: 0, downloadUrl: 'https://x',
      },
    }, { maxRetries: 3, baseDelayMs: 10 }),
    Error,
    "Idempotency conflict",
  );
});

Deno.test("sendEmail renders invoice template with expected subject", async () => {
  const { client, getLastCall } = mockResendClientCapturing('re_invoice_ok');

  const result = await sendEmail(client, {
    type: 'invoice',
    to: 'customer@example.com',
    idempotencyKey: 'invoice/order-6',
    templateProps: {
      customerName: 'Jana Nováková',
      orderId: 'ord-12345',
      invoiceNumber: '2026-0042',
    },
  });

  assertEquals(result.messageId, 're_invoice_ok');
  const lastCall = getLastCall();
  assertEquals(lastCall?.subject, 'Faktura 2026-0042 – Cesty bez mapy');
});

Deno.test("sendEmail renders credit-note template with expected subject", async () => {
  const { client, getLastCall } = mockResendClientCapturing('re_credit_ok');

  const result = await sendEmail(client, {
    type: 'credit-note',
    to: 'customer@example.com',
    idempotencyKey: 'credit-note/order-7',
    templateProps: {
      customerName: 'Jana Nováková',
      orderId: 'ord-12345',
      creditNoteNumber: '2026-D-0001',
    },
  });

  assertEquals(result.messageId, 're_credit_ok');
  const lastCall = getLastCall();
  assertEquals(lastCall?.subject, 'Opravný daňový doklad 2026-D-0001');
});

Deno.test("sendEmail renders invoice-corrected template with expected subject", async () => {
  const { client, getLastCall } = mockResendClientCapturing('re_corrected_ok');

  const result = await sendEmail(client, {
    type: 'invoice-corrected',
    to: 'customer@example.com',
    idempotencyKey: 'invoice-corrected/order-8',
    templateProps: {
      customerName: 'Jana Nováková',
      orderId: 'ord-12345',
      oldInvoiceNumber: '2026-0042',
      newInvoiceNumber: '2026-0043',
    },
  });

  assertEquals(result.messageId, 're_corrected_ok');
  const lastCall = getLastCall();
  assertEquals(lastCall?.subject, 'Opravená faktura 2026-0043');
});

Deno.test("sendEmail forwards attachments to Resend client when provided", async () => {
  const { client, getLastCall } = mockResendClientCapturing('re_attach_ok');

  const attachments = [
    { filename: 'faktura-2026-0042.pdf', content: 'JVBERi0xLjQKJ...' },
  ];

  await sendEmail(client, {
    type: 'invoice',
    to: 'customer@example.com',
    idempotencyKey: 'invoice/order-9',
    templateProps: {
      customerName: 'Jana Nováková',
      orderId: 'ord-12345',
      invoiceNumber: '2026-0042',
    },
    attachments,
  });

  const lastCall = getLastCall();
  assertEquals(lastCall?.attachments, attachments);
});
