// ================================================
// Tests for sendEmail wrapper
// ================================================
// Run: deno test --allow-env --allow-net supabase/functions/_shared/email/sendEmail.test.ts
// ================================================

import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { sendEmail, type ResendClient } from "./sendEmail.ts";
import { EmailSuppressedError } from "./types.ts";

// Mock Supabase client for suppression lookup.
// `suppressions`: { "email@x.com": "hard_bounce" } — addresses present here are suppressed.
// `errorOnQuery`: when set, the eq().maybeSingle() resolves with this error.
function mockSupabase(
  suppressions: Record<string, string> = {},
  errorOnQuery: { message: string } | null = null,
) {
  return {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, value: string) => ({
          maybeSingle: () => Promise.resolve({
            data: errorOnQuery
              ? null
              : (suppressions[value]
                ? { email: value, reason: suppressions[value] }
                : null),
            error: errorOnQuery,
          }),
        }),
      }),
    }),
  };
}

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

Deno.test("sendEmail renders storno-invoice template with expected subject", async () => {
  const { client, getLastCall } = mockResendClientCapturing('re_storno_ok');

  const result = await sendEmail(client, {
    type: 'storno-invoice',
    to: 'customer@example.com',
    idempotencyKey: 'storno/order-7',
    templateProps: {
      customerName: 'Jana Nováková',
      orderId: 'ord-12345',
      stornoNumber: '2026-S-0001',
      originalInvoiceNumber: '2026-0042',
    },
  });

  assertEquals(result.messageId, 're_storno_ok');
  const lastCall = getLastCall();
  assertEquals(lastCall?.subject, 'Storno faktura 2026-S-0001');
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

Deno.test("sendEmail includes replyTo cestybezmapy@gmail.com by default", async () => {
  const { client, getLastCall } = mockResendClientCapturing('re_replyto_test');

  await sendEmail(client, {
    type: 'order-confirmation',
    to: 'customer@example.com',
    idempotencyKey: 'order-confirm/reply-to-test',
    templateProps: {
      customerName: 'Jana',
      orderId: 'order-rt',
      items: [{ productTitle: 'Test', quantity: 1, priceAtPurchase: 99 }],
      totalAmount: 99,
      downloadUrl: 'https://www.cestybezmapy.cz/stahnout?token=x',
    },
  });

  const payload = getLastCall();
  assertEquals(payload?.replyTo, 'cestybezmapy@gmail.com');
});

Deno.test("sendEmail respects RESEND_REPLY_TO override", async () => {
  const original = Deno.env.get("RESEND_REPLY_TO");
  Deno.env.set("RESEND_REPLY_TO", "override@example.com");
  try {
    const { client, getLastCall } = mockResendClientCapturing('re_replyto_override');

    await sendEmail(client, {
      type: 'refund',
      to: 'customer@example.com',
      idempotencyKey: 'refund/reply-to-override',
      templateProps: { customerName: 'Jana', orderId: 'order-ro', amount: 50 },
    });

    const payload = getLastCall();
    assertEquals(payload?.replyTo, 'override@example.com');
  } finally {
    if (original === undefined) Deno.env.delete("RESEND_REPLY_TO");
    else Deno.env.set("RESEND_REPLY_TO", original);
  }
});

Deno.test("sendEmail skips suppression check when supabase client is omitted", async () => {
  const client = mockResendClient([{ type: 'success', messageId: 're_no_supabase' }]);

  const result = await sendEmail(client, {
    type: 'refund',
    to: 'anyone@example.com',
    idempotencyKey: 'refund/no-supabase',
    templateProps: { customerName: 'Jana', orderId: 'order-x', amount: 10 },
  });

  assertEquals(result.messageId, 're_no_supabase');
});

Deno.test("sendEmail sends when recipient is not on suppression list", async () => {
  const client = mockResendClient([{ type: 'success', messageId: 're_ok' }]);
  const supabase = mockSupabase({}); // nobody suppressed

  const result = await sendEmail(client, {
    type: 'refund',
    to: 'ok@example.com',
    idempotencyKey: 'refund/ok',
    templateProps: { customerName: 'Jana', orderId: 'order-ok', amount: 10 },
  }, { supabase });

  assertEquals(result.messageId, 're_ok');
});

Deno.test("sendEmail throws EmailSuppressedError when recipient is suppressed (Resend not called)", async () => {
  let resendCalled = false;
  const client: ResendClient = {
    emails: {
      send: async () => {
        resendCalled = true;
        return { data: { id: 'should_not_send' }, error: null };
      },
    },
  };
  const supabase = mockSupabase({ "bounced@example.com": "hard_bounce" });

  await assertRejects(
    () => sendEmail(client, {
      type: 'refund',
      to: 'bounced@example.com',
      idempotencyKey: 'refund/bounced',
      templateProps: { customerName: 'Jana', orderId: 'order-b', amount: 10 },
    }, { supabase }),
    EmailSuppressedError,
    "bounced@example.com",
  );

  assertEquals(resendCalled, false);
});

Deno.test("sendEmail lowercases recipient before suppression lookup", async () => {
  let resendCalled = false;
  const client: ResendClient = {
    emails: {
      send: async () => {
        resendCalled = true;
        return { data: { id: 'should_not_send' }, error: null };
      },
    },
  };
  // Suppression entry stored lowercase, recipient sent mixed-case → still blocked.
  const supabase = mockSupabase({ "user@example.com": "complaint" });

  await assertRejects(
    () => sendEmail(client, {
      type: 'refund',
      to: 'User@Example.COM',
      idempotencyKey: 'refund/mixedcase',
      templateProps: { customerName: 'Jana', orderId: 'order-mc', amount: 10 },
    }, { supabase }),
    EmailSuppressedError,
  );

  assertEquals(resendCalled, false);
});

Deno.test("sendEmail proceeds when suppression query errors (fail-open with loud log)", async () => {
  const client = mockResendClient([{ type: 'success', messageId: 're_fail_open' }]);
  const supabase = mockSupabase({}, { message: "connection refused" });

  const result = await sendEmail(client, {
    type: 'refund',
    to: 'someone@example.com',
    idempotencyKey: 'refund/db-error',
    templateProps: { customerName: 'Jana', orderId: 'order-dberr', amount: 10 },
  }, { supabase });

  // Query errored → we logged and proceeded. Send went through.
  assertEquals(result.messageId, 're_fail_open');
});

Deno.test("admin-order-notification: subject pro běžnou objednávku", async () => {
  const { client, getLastCall } = mockResendClientCapturing("msg-admin-1");
  await sendEmail(client, {
    type: "admin-order-notification",
    to: "cestybezmapy@gmail.com",
    idempotencyKey: "admin-order-notification/a1b2c3d4-e5f6/cestybezmapy@gmail.com",
    templateProps: {
      orderId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      customerName: "Petr Novák",
      customerEmail: "petr@example.com",
      items: [{ productTitle: "Toskánsko – průvodce", quantity: 2, priceAtPurchase: 299 }],
      totalAmount: 598,
      hasCustomItinerary: false,
    },
  });
  const call = getLastCall()!;
  assertEquals(call.subject, "🛒 Nová objednávka #a1b2c3d4 — 598 Kč");
  assertEquals(call.idempotencyKey, "admin-order-notification/a1b2c3d4-e5f6/cestybezmapy@gmail.com");
  assertEquals(call.to, "cestybezmapy@gmail.com");
  // react element šablony je předán Resendu (render dělá Resend)
  assertEquals(typeof call.react, "object");
});

Deno.test("admin-order-notification: subject pro itinerář na míru (vyhrává i v mixed košíku)", async () => {
  const { client, getLastCall } = mockResendClientCapturing("msg-admin-2");
  await sendEmail(client, {
    type: "admin-order-notification",
    to: "cestybezmapy@gmail.com",
    idempotencyKey: "admin-order-notification/b2c3d4e5-f6a1/cestybezmapy@gmail.com",
    templateProps: {
      orderId: "b2c3d4e5-f6a1-7890-abcd-ef1234567890",
      customerName: "Eva Malá",
      customerEmail: "eva@example.com",
      items: [
        { productTitle: "Individuální itinerář", quantity: 1, priceAtPurchase: 2499 },
        { productTitle: "Provence – průvodce", quantity: 1, priceAtPurchase: 199 },
      ],
      totalAmount: 2698,
      hasCustomItinerary: true,
    },
  });
  const call = getLastCall()!;
  assertEquals(
    call.subject,
    "🗺️ ZAPLACENÝ ITINERÁŘ NA MÍRU — objednávka #b2c3d4e5 (2 698 Kč)"
  );
});

Deno.test("admin-order-notification: render funguje bez adminOrderUrl (volitelné tlačítko)", async () => {
  const { client, getLastCall } = mockResendClientCapturing("msg-admin-3");
  await sendEmail(client, {
    type: "admin-order-notification",
    to: "cestybezmapy@gmail.com",
    idempotencyKey: "admin-order-notification/c3d4e5f6-a1b2/cestybezmapy@gmail.com",
    templateProps: {
      orderId: "c3d4e5f6-a1b2-7890-abcd-ef1234567890",
      customerName: "Jan Dvořák",
      customerEmail: "jan@example.com",
      items: [{ productTitle: "Toskánsko – průvodce", quantity: 1, priceAtPurchase: 199 }],
      totalAmount: 199,
      hasCustomItinerary: false,
      // adminOrderUrl záměrně chybí
    },
  });
  assertEquals(typeof getLastCall()!.react, "object");
});
