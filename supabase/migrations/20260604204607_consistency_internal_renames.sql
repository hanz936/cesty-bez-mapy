begin;

-- ============ 1) Table rename: newsletter_consent_log -> newsletter_consent_logs ============
alter table public.newsletter_consent_log rename to newsletter_consent_logs;
alter table public.newsletter_consent_logs rename constraint newsletter_consent_log_pkey to newsletter_consent_logs_pkey;
alter policy newsletter_consent_public_insert on public.newsletter_consent_logs rename to newsletter_consent_logs_public_insert;
alter policy newsletter_consent_admin_select on public.newsletter_consent_logs rename to newsletter_consent_logs_admin_select;

-- ============ 2) RLS policy renames (anglické věty + verb/infix) ============
alter policy "Admins can delete orders"            on public.orders rename to orders_admin_delete;
alter policy "Users and admins can insert orders"  on public.orders rename to orders_owner_insert;
alter policy "Users and admins can select orders"  on public.orders rename to orders_owner_select;
alter policy "Admins can update orders"            on public.orders rename to orders_admin_update;

alter policy "Admins can delete order_items"           on public.order_items rename to order_items_admin_delete;
alter policy "Users and admins can insert order_items" on public.order_items rename to order_items_owner_insert;
alter policy "Users and admins can select order_items" on public.order_items rename to order_items_owner_select;
alter policy "Admins can update order_items"           on public.order_items rename to order_items_admin_update;

alter policy "Admins can delete requests"            on public.custom_itinerary_requests rename to custom_itinerary_requests_admin_delete;
alter policy "Users and admins can insert requests"  on public.custom_itinerary_requests rename to custom_itinerary_requests_owner_insert;
alter policy "Users and admins can select requests"  on public.custom_itinerary_requests rename to custom_itinerary_requests_owner_select;
alter policy "Users and admins can update requests"  on public.custom_itinerary_requests rename to custom_itinerary_requests_owner_update;

alter policy blog_tags_public_read       on public.blog_tags  rename to blog_tags_public_select;
alter policy user_roles_select           on public.user_roles rename to user_roles_owner_select;
alter policy auth_admin_read_user_roles  on public.user_roles rename to user_roles_auth_admin_select;

-- ============ 3) Constraint renames ============
alter table public.customers      rename constraint fk_customers_auth_users          to customers_id_fkey;
alter table public.order_items    rename constraint order_items_order_product_unique to order_items_order_id_product_id_key;
alter table public.download_tokens rename constraint download_tokens_one_target       to download_tokens_one_target_check;

-- ============ 4) Timestamp column renames (bez aplikačních referencí) ============
alter table public.csp_reports        rename column received_at  to created_at;
alter table public.email_suppressions rename column suppressed_at to created_at;

-- ============ 5) Index renames ============
alter index public.idx_csp_reports_received_at                          rename to idx_csp_reports_created_at;
alter index public.idx_csp_reports_disposition_directive_received_at    rename to idx_csp_reports_disposition_directive_created_at;
alter index public.idx_custom_requests_auth_user_id                     rename to idx_custom_itinerary_requests_auth_user_id;
alter index public.idx_custom_requests_created_at                       rename to idx_custom_itinerary_requests_created_at;
alter index public.idx_custom_requests_customer_email                   rename to idx_custom_itinerary_requests_customer_email;
alter index public.idx_custom_requests_customer_id                      rename to idx_custom_itinerary_requests_customer_id;
alter index public.idx_custom_requests_delivery_email_unsent            rename to idx_custom_itinerary_requests_delivery_email_unsent;
alter index public.idx_custom_requests_form_data                        rename to idx_custom_itinerary_requests_form_data;
alter index public.idx_custom_requests_status                           rename to idx_custom_itinerary_requests_status;
alter index public.idx_newsletter_consent_active                        rename to idx_newsletter_consent_logs_active;
alter index public.idx_newsletter_consent_created_at                    rename to idx_newsletter_consent_logs_created_at;
alter index public.idx_newsletter_consent_email                         rename to idx_newsletter_consent_logs_email;
alter index public.idx_order_items_custom_request_id                    rename to idx_order_items_custom_itinerary_request_id;
alter index public.idx_download_tokens_custom_request_id                rename to idx_download_tokens_custom_itinerary_request_id;

-- ============ 6) Trigger renames (sjednocení na trg_<tab>_<purpose>) ============
alter trigger handle_blog_posts_updated_at        on public.blog_posts                rename to trg_blog_posts_set_updated_at;
alter trigger handle_categories_updated_at        on public.categories                rename to trg_categories_set_updated_at;
alter trigger handle_contact_messages_updated_at  on public.contact_messages          rename to trg_contact_messages_set_updated_at;
alter trigger handle_custom_requests_updated_at   on public.custom_itinerary_requests rename to trg_custom_itinerary_requests_set_updated_at;
alter trigger handle_customers_updated_at         on public.customers                 rename to trg_customers_set_updated_at;
alter trigger handle_orders_updated_at            on public.orders                    rename to trg_orders_set_updated_at;
alter trigger handle_products_updated_at          on public.products                  rename to trg_products_set_updated_at;
alter trigger trg_blog_publish_deploy             on public.blog_posts                rename to trg_blog_posts_publish_deploy;
alter trigger on_customer_created                 on public.customers                 rename to trg_customers_link_requests;
alter trigger on_customer_created_link_orders     on public.customers                 rename to trg_customers_link_orders;
alter trigger update_total_sales_on_order_item_change   on public.order_items rename to trg_order_items_update_total_sales;
alter trigger update_total_sales_on_order_status_change on public.orders      rename to trg_orders_update_total_sales;

-- ============ 7) Function rename + chybějící updated_at trigger ============
-- Triggery referencují funkci přes OID, takže rename je transparentní (žádný recreate triggeru).
alter function public.link_requests_to_customer() rename to link_custom_itinerary_requests_to_customer;

create trigger trg_fakturoid_tokens_set_updated_at
  before update on public.fakturoid_tokens
  for each row execute function extensions.moddatetime('updated_at');

-- ============ 8) Komentáře -> EN + doplnit chybějící ============
comment on column public.blog_posts.preview_token is 'Secret token for draft preview via edge fn get-blog-preview (per-article, rotatable).';
comment on column public.blog_posts.tag_ids is 'Array of tag IDs (mirrors products.category_ids).';
comment on table  public.blog_tags is 'Blog post tags (admin-managed).';
comment on column public.custom_itinerary_requests.final_pdf_url is 'Path to the final PDF in bucket custom-itinerary-pdfs (NOT a full URL — used to build a signed URL).';
comment on column public.custom_itinerary_requests.final_pdf_uploaded_at is 'Timestamp when admin uploaded the final itinerary PDF.';
comment on column public.custom_itinerary_requests.delivered_at is 'Timestamp when admin marked the itinerary as delivered to the customer.';
comment on table  public.contact_messages is 'Messages from public Contact and Collaboration forms.';
comment on table  public.csp_reports is 'Content-Security-Policy violation reports (report-uri / report-to).';
comment on table  public.fakturoid_tokens is 'Singleton row storing the current Fakturoid OAuth access token. RLS denies all; only service_role (bypasses RLS) can access.';

commit;
