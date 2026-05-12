// ================================================
// Tests for stripe-webhook pure helpers
// ================================================
// Run: deno test supabase/functions/stripe-webhook/lib.test.ts
// ================================================

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  decideEmailTypes,
  buildOrderConfirmationItems,
} from "./lib.ts";

Deno.test("decideEmailTypes: all standard products → OrderConfirmation only", () => {
  const decision = decideEmailTypes(["p1", "p2"], {});
  assertEquals(decision.hasStandardProducts, true);
  assertEquals(decision.hasCustomItinerary, false);
  assertEquals([...decision.standardProductIds].sort(), ["p1", "p2"]);
});

Deno.test("decideEmailTypes: all custom itinerary → CustomItineraryReceived only", () => {
  const decision = decideEmailTypes(
    ["p-custom-1", "p-custom-2"],
    { "p-custom-1": "req-1", "p-custom-2": "req-2" }
  );
  assertEquals(decision.hasStandardProducts, false);
  assertEquals(decision.hasCustomItinerary, true);
  assertEquals(decision.standardProductIds.size, 0);
});

Deno.test("decideEmailTypes: mixed cart (standard + custom) → both emails", () => {
  const decision = decideEmailTypes(
    ["p-standard", "p-custom"],
    { "p-custom": "req-1" }
  );
  assertEquals(decision.hasStandardProducts, true);
  assertEquals(decision.hasCustomItinerary, true);
  assertEquals([...decision.standardProductIds], ["p-standard"]);
});

Deno.test("decideEmailTypes: empty product list → no emails", () => {
  const decision = decideEmailTypes([], {});
  assertEquals(decision.hasStandardProducts, false);
  assertEquals(decision.hasCustomItinerary, false);
});

Deno.test("buildOrderConfirmationItems: filters out custom-itinerary line items", () => {
  const products = [
    { id: "p-standard", title: "Toskánsko – průvodce" },
    { id: "p-custom", title: "Individuální itinerář" },
  ];
  const orderItems = [
    { product_id: "p-standard", quantity: 1, price_at_purchase: 199 },
    { product_id: "p-custom", quantity: 1, price_at_purchase: 2990 },
  ];
  const items = buildOrderConfirmationItems(
    products,
    orderItems,
    new Set(["p-standard"])
  );
  assertEquals(items.length, 1);
  assertEquals(items[0], {
    productTitle: "Toskánsko – průvodce",
    quantity: 1,
    priceAtPurchase: 199,
  });
});

Deno.test("buildOrderConfirmationItems: preserves quantity", () => {
  const products = [{ id: "p1", title: "Produkt 1" }];
  const orderItems = [
    { product_id: "p1", quantity: 3, price_at_purchase: 199 },
  ];
  const items = buildOrderConfirmationItems(
    products,
    orderItems,
    new Set(["p1"])
  );
  assertEquals(items[0].quantity, 3);
  assertEquals(items[0].priceAtPurchase, 199);
});

Deno.test("buildOrderConfirmationItems: fallback title when product missing", () => {
  const products: Array<{ id: string; title: string }> = [];
  const orderItems = [
    { product_id: "orphan-id", quantity: 1, price_at_purchase: 100 },
  ];
  const items = buildOrderConfirmationItems(
    products,
    orderItems,
    new Set(["orphan-id"])
  );
  assertEquals(items[0].productTitle, "Neznámý produkt");
});
