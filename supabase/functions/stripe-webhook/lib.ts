// ================================================
// Pure helpers for stripe-webhook checkout email decisions
// ================================================
// Extracted from index.ts so the branching logic (mixed cart → which
// emails to send) is unit-testable without spinning up the whole Edge
// Function runtime.
// ================================================

export interface ProductRow {
  id: string;
  title: string;
}

export interface OrderItemForEmail {
  productTitle: string;
  quantity: number;
  priceAtPurchase: number;
}

export interface OrderItemForRpc {
  product_id: string;
  quantity: number;
  price_at_purchase: number;
}

export interface EmailDecision {
  hasStandardProducts: boolean;
  hasCustomItinerary: boolean;
  standardProductIds: Set<string>;
}

// Decide which emails to send based on product mix:
// - standard products (file downloads) → OrderConfirmation
// - custom itinerary products (planning needed) → CustomItineraryReceived
// - mixed cart → both
export function decideEmailTypes(
  productIds: string[],
  customRequestsMapping: Record<string, string>
): EmailDecision {
  const customProductIds = new Set(Object.keys(customRequestsMapping));
  const standardProductIds = new Set(
    productIds.filter((id) => !customProductIds.has(id))
  );
  return {
    hasStandardProducts: standardProductIds.size > 0,
    hasCustomItinerary: customProductIds.size > 0,
    standardProductIds,
  };
}

// Build OrderConfirmation items array from the loaded products + RPC items,
// filtered to standard (non-custom-itinerary) products only.
export function buildOrderConfirmationItems(
  products: ProductRow[],
  orderItems: OrderItemForRpc[],
  standardProductIds: Set<string>
): OrderItemForEmail[] {
  const titleById = new Map(products.map((p) => [p.id, p.title]));
  return orderItems
    .filter((item) => standardProductIds.has(item.product_id))
    .map((item) => ({
      productTitle: titleById.get(item.product_id) ?? "Neznámý produkt",
      quantity: item.quantity,
      priceAtPurchase: item.price_at_purchase,
    }));
}

// Výchozí příjemce admin notifikací — Jana (vlastní byznys i operativu).
// Stejný vzor jako FAKTUROID_ALERT_EMAIL v create-invoice.
export const DEFAULT_ADMIN_NOTIFICATION_EMAIL = "cestybezmapy@gmail.com";

// Parsuje ADMIN_NOTIFICATION_EMAIL env: více adres oddělených čárkou.
// Prázdná / nenastavená hodnota → výchozí adresa.
export function parseAdminRecipients(envValue: string | undefined): string[] {
  const parsed = (envValue ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : [DEFAULT_ADMIN_NOTIFICATION_EMAIL];
}

// Položky pro admin notifikaci — na rozdíl od buildOrderConfirmationItems
// nefiltruje custom itineráře: admin vidí kompletní obsah objednávky.
export function buildAdminNotificationItems(
  products: ProductRow[],
  orderItems: OrderItemForRpc[]
): OrderItemForEmail[] {
  const titleById = new Map(products.map((p) => [p.id, p.title]));
  return orderItems.map((item) => ({
    productTitle: titleById.get(item.product_id) ?? "Neznámý produkt",
    quantity: item.quantity,
    priceAtPurchase: item.price_at_purchase,
  }));
}

// Deep-link na detail objednávky v React Admin panelu.
// Bez nastavené base URL vrací undefined — šablona pak skryje tlačítko.
export function buildAdminOrderUrl(
  adminPanelUrl: string | undefined,
  orderId: string
): string | undefined {
  const base = adminPanelUrl?.trim();
  if (!base) return undefined;
  return `${base.replace(/\/+$/, "")}/#/orders/${orderId}`;
}
