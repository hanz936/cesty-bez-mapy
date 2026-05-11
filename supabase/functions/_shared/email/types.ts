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
  /**
   * From custom_itinerary_requests.form_data.specific_destination.
   * NULL when the customer chose "open to suggestions" instead of
   * typing a specific destination — templates drop the "pro X" clause.
   */
  destination: string | null;
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
  /**
   * From custom_itinerary_requests.form_data.specific_destination.
   * NULL when the customer chose "open to suggestions". Templates
   * drop the "pro X" clause in heading/intro/preview when null.
   */
  destination: string | null;
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
