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
      idempotencyKey: 'payment-failed/order-3',
      templateProps: { customerName: 'Jan', orderId: 'order-3', amount: 199 },
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
