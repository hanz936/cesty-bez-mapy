// ================================================
// Pure helpers for resend-email
// ================================================

export type ResendableEmailType =
  | 'order-confirmation'
  | 'custom-itinerary-payment-received'
  | 'refund';

export interface ItemTypeMarker {
  custom_itinerary_request_id: string | null;
}

/**
 * Validates that the requested email template matches the order's item
 * composition, so an admin (or any authenticated caller) cannot send a
 * customer the wrong template. Mirrors the admin-UI button visibility rules:
 * regular items → order-confirmation, custom-itinerary items →
 * custom-itinerary-payment-received, mixed orders allow both, refund is
 * always allowed. An order with no items (should not happen) is treated as
 * regular, matching the UI default.
 *
 * Returns an error message, or null when the type is valid for the order.
 */
export function validateResendTypeForItems(
  type: ResendableEmailType,
  items: ItemTypeMarker[],
): string | null {
  if (type === 'refund') return null;

  const hasItinerary = items.some((it) => it.custom_itinerary_request_id != null);
  const hasRegular = items.some((it) => it.custom_itinerary_request_id == null);

  if (type === 'custom-itinerary-payment-received' && !hasItinerary) {
    return 'Order has no custom-itinerary items; template custom-itinerary-payment-received is not applicable';
  }
  if (type === 'order-confirmation' && hasItinerary && !hasRegular) {
    return 'Order contains only custom-itinerary items; template order-confirmation is not applicable';
  }
  return null;
}
