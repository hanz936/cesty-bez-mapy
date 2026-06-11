alter table public.products
  add column stripe_sync_error text;

comment on column public.products.stripe_sync_error is
  'Last Stripe sync error from create-stripe-product (admin UI surfaces it). NULL = last sync OK or never attempted.';
