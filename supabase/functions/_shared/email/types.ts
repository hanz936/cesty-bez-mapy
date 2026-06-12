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
  | 'custom-itinerary-delivered'
  | 'invoice'
  | 'storno-invoice'
  | 'invoice-corrected'
  | 'invoice-alert'
  | 'admin-order-notification';

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
  // Optional: when missing, the template hides the download CTA + fallback link.
  // Use case: all-custom-itinerary orders where the download link is delivered later.
  downloadUrl?: string;
}

export interface CustomItineraryReceivedProps {
  customerName: string;
  orderId: string;
}

export interface RefundProps {
  customerName: string;
  orderId: string;
  amount: number; // CZK refunded
}

export interface PaymentFailedProps {
  customerName: string;
  // Stripe PaymentIntent id (e.g. "pi_3Oo...") shown to the customer as a
  // support-lookup reference — no order exists yet at the time we send this.
  referenceId: string;
}

export interface CustomItineraryDeliveredProps {
  customerName: string;
  /**
   * The custom_itinerary_requests.id — shown to the customer in the
   * email footer as a reference they can quote when contacting support.
   */
  requestId: string;
  downloadUrl: string;
}

export interface InvoiceProps {
  customerName: string;
  orderId: string;
  invoiceNumber: string;
}

export interface StornoInvoiceProps {
  customerName: string;
  orderId: string;
  stornoNumber: string;
  originalInvoiceNumber: string;
}

export interface InvoiceCorrectedProps {
  customerName: string;
  orderId: string;
  oldInvoiceNumber: string;
  newInvoiceNumber: string;
}

export interface InvoiceAlertProps {
  orderId: string;
  action: string;
  errorMessage: string;
}

export interface AdminOrderNotificationProps {
  orderId: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  totalAmount: number; // CZK
  hasCustomItinerary: boolean;
  // Deep-link na detail objednávky v admin panelu.
  // Když chybí (ADMIN_PANEL_URL nenastaveno), šablona skryje tlačítko.
  adminOrderUrl?: string;
}

export interface EmailAttachment {
  filename: string;
  content: string; // base64-encoded
}

// Maps EmailType → Props type
export type PropsForType<T extends EmailType> =
  T extends 'order-confirmation' ? OrderConfirmationProps
  : T extends 'custom-itinerary-payment-received' ? CustomItineraryReceivedProps
  : T extends 'refund' ? RefundProps
  : T extends 'payment-failed' ? PaymentFailedProps
  : T extends 'custom-itinerary-delivered' ? CustomItineraryDeliveredProps
  : T extends 'invoice' ? InvoiceProps
  : T extends 'storno-invoice' ? StornoInvoiceProps
  : T extends 'invoice-corrected' ? InvoiceCorrectedProps
  : T extends 'invoice-alert' ? InvoiceAlertProps
  : T extends 'admin-order-notification' ? AdminOrderNotificationProps
  : never;

export interface SendEmailParams<T extends EmailType> {
  type: T;
  to: string;
  idempotencyKey: string; // format: <event-type>/<entity-id>[/retry-N]
  templateProps: PropsForType<T>;
  attachments?: EmailAttachment[];
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

export class EmailSuppressedError extends Error {
  constructor(
    public readonly email: string,
    public readonly reason: string,
  ) {
    super(`Email suppressed: ${email} (${reason})`);
    this.name = 'EmailSuppressedError';
  }
}
