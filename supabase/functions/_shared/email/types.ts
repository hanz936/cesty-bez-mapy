// ================================================
// Email types: union of all email types and per-template props
// ================================================
// Used by sendEmail wrapper for type-safe template prop passing.
// ================================================

export type EmailType =
  | 'order-confirmation'
  | 'custom-itinerary-payment-received'
  | 'refund'
  | 'payment-failed'
  | 'custom-itinerary-delivered';

export interface OrderItem {
  productTitle: string;
  quantity: number;
  priceAtPurchase: number; // CZK
}

export interface OrderConfirmationProps {
  customerName: string;
  orderId: string;
  items: OrderItem[];
  totalAmount: number; // CZK
  downloadUrl: string;
}

export interface CustomItineraryReceivedProps {
  customerName: string;
  orderId: string;
  totalAmount: number;
  destination: string; // e.g. "Toskánsko" — from custom request form_data
}

export interface RefundProps {
  customerName: string;
  orderId: string;
  amount: number; // CZK refunded
}

export interface PaymentFailedProps {
  customerName: string;
  orderId: string;
  amount: number; // CZK attempted
}

export interface CustomItineraryDeliveredProps {
  customerName: string;
  destination: string;
  downloadUrl: string;
}

// Maps EmailType → Props type
export type PropsForType<T extends EmailType> =
  T extends 'order-confirmation' ? OrderConfirmationProps
  : T extends 'custom-itinerary-payment-received' ? CustomItineraryReceivedProps
  : T extends 'refund' ? RefundProps
  : T extends 'payment-failed' ? PaymentFailedProps
  : T extends 'custom-itinerary-delivered' ? CustomItineraryDeliveredProps
  : never;

export interface SendEmailParams<T extends EmailType> {
  type: T;
  to: string;
  idempotencyKey: string; // format: <event-type>/<entity-id>[/retry-N]
  templateProps: PropsForType<T>;
}

export interface SendEmailResult {
  messageId: string;
  attempt: number;
}

export class EmailSendError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number | null,
    public readonly retryable: boolean,
    public readonly attempt: number,
  ) {
    super(message);
    this.name = 'EmailSendError';
  }
}
