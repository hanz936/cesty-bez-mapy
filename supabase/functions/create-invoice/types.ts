// types.ts
// Fakturoid v3 API types — subset we use.
// Reference: https://www.fakturoid.cz/api/v3

export interface FakturoidSubjectPayload {
  name: string;
  email?: string;
  registration_no?: string;  // IČO
  vat_no?: string;           // DIČ
  street?: string;
  city?: string;
  zip?: string;
  country: string;           // "CZ"
  custom_id?: string;        // stable identifier for dedup lookup (= customer email)
}

export interface FakturoidSubjectResponse {
  id: number;
  name: string;
  // other fields exist but we only need id
}

export interface FakturoidLine {
  name: string;
  quantity: number;
  unit_price: string;        // string per API contract (decimal)
  vat_rate: number;
}

export interface FakturoidInvoicePayload {
  subject_id: number;
  lines: FakturoidLine[];
  currency: string;
  language: string;
  payment_method: string;
  issued_on: string;           // YYYY-MM-DD
  taxable_fulfillment_due?: string;
  due_on: string;
  due?: number;                // days; 0 = due on issue date (Stripe-paid)
  note?: string;
  custom_id?: string;
  hide_bank_account?: boolean;
}

export interface FakturoidInvoiceResponse {
  id: number;
  number: string;
  public_html_url: string;
  pdf_url: string;
  state: string;
  total: string;
}

export interface FakturoidToken {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface FakturoidError {
  errors?: Record<string, string[]>;
  message?: string;
}

export type FakturoidAction = 'create' | 'retry' | 'resend_email' | 'storno_invoice' | 'cancel_and_reissue';

export interface CreateInvoiceRequest {
  order_id: string;
  action: FakturoidAction;
}

export interface OrderRow {
  id: string;
  customer_email: string;
  customer_name: string;
  total_amount: string;
  stripe_payment_id: string;
  status: string;
  fakturoid_invoice_id: string | null;
  fakturoid_invoice_number: string | null;
  fakturoid_invoice_url: string | null;
  fakturoid_storno_id: string | null;
  fakturoid_storno_number: string | null;
  invoice_sent: boolean;
  invoice_sent_at: string | null;
  invoice_error: string | null;
  is_company: boolean;
  company_name: string | null;
  company_ico: string | null;
  company_dic: string | null;
  billing_street: string | null;
  billing_city: string | null;
  billing_zip: string | null;
}

export interface OrderItemRow {
  product_id: string;
  product_title: string;
  quantity: number;
  price_at_purchase: string;
  vat_rate_at_purchase: string;
}
