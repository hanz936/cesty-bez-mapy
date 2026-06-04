begin;

-- Rename misspelled facturoid_* -> fakturoid_* (matches product "Fakturoid").
-- idx_orders_invoice_status predikát se po renamu sloupce upraví automaticky.
alter table public.orders rename column facturoid_invoice_id     to fakturoid_invoice_id;
alter table public.orders rename column facturoid_invoice_number to fakturoid_invoice_number;
alter table public.orders rename column facturoid_invoice_url    to fakturoid_invoice_url;
alter table public.orders rename column facturoid_storno_id      to fakturoid_storno_id;
alter table public.orders rename column facturoid_storno_number  to fakturoid_storno_number;

-- integration_logs.service: hodnota 'facturoid' -> 'fakturoid'
update public.integration_logs set service = 'fakturoid' where service = 'facturoid';
alter table public.integration_logs drop constraint integration_logs_service_check;
alter table public.integration_logs add constraint integration_logs_service_check
  check (service = any (array['ecomail'::text, 'fakturoid'::text, 'stripe'::text, 'other'::text]));
comment on column public.integration_logs.service is 'Service name: ecomail, fakturoid, stripe, other';

commit;
