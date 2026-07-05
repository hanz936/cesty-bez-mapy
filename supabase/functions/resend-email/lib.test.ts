// ================================================
// Tests for resend-email pure helpers
// ================================================
// Run: deno test supabase/functions/resend-email/lib.test.ts
// ================================================

import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateResendTypeForItems, type ItemTypeMarker } from "./lib.ts";

const regular: ItemTypeMarker = { custom_itinerary_request_id: null };
const itinerary: ItemTypeMarker = { custom_itinerary_request_id: "req-1" };

Deno.test("order-confirmation: allowed for regular-only order", () => {
  assertEquals(validateResendTypeForItems("order-confirmation", [regular]), null);
});

Deno.test("order-confirmation: allowed for mixed order", () => {
  assertEquals(
    validateResendTypeForItems("order-confirmation", [regular, itinerary]),
    null,
  );
});

Deno.test("order-confirmation: rejected for itinerary-only order", () => {
  const err = validateResendTypeForItems("order-confirmation", [itinerary]);
  assertStringIncludes(err ?? "", "only custom-itinerary items");
});

Deno.test("order-confirmation: allowed for order with no items (defaults to regular)", () => {
  assertEquals(validateResendTypeForItems("order-confirmation", []), null);
});

Deno.test("custom-itinerary-payment-received: allowed for itinerary-only order", () => {
  assertEquals(
    validateResendTypeForItems("custom-itinerary-payment-received", [itinerary]),
    null,
  );
});

Deno.test("custom-itinerary-payment-received: allowed for mixed order", () => {
  assertEquals(
    validateResendTypeForItems("custom-itinerary-payment-received", [regular, itinerary]),
    null,
  );
});

Deno.test("custom-itinerary-payment-received: rejected for regular-only order", () => {
  const err = validateResendTypeForItems("custom-itinerary-payment-received", [regular]);
  assertStringIncludes(err ?? "", "no custom-itinerary items");
});

Deno.test("custom-itinerary-payment-received: rejected for order with no items", () => {
  const err = validateResendTypeForItems("custom-itinerary-payment-received", []);
  assertStringIncludes(err ?? "", "no custom-itinerary items");
});

Deno.test("refund: always allowed regardless of items", () => {
  assertEquals(validateResendTypeForItems("refund", []), null);
  assertEquals(validateResendTypeForItems("refund", [regular]), null);
  assertEquals(validateResendTypeForItems("refund", [itinerary]), null);
});
