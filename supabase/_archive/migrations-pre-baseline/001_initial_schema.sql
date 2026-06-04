-- ================================================
-- CESTY BEZ MAPY - Initial Database Schema
-- ================================================
-- Created: 2025-11-04
-- Description: E-shop database schema for travel guides
-- Best Practices: UUID primary keys, JSONB for flexible data,
--                 timestamps with triggers, proper indexes
-- ================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS moddatetime WITH SCHEMA extensions;

-- ================================================
-- TABLE: customers
-- Description: Customer information (normalized)
-- ================================================
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  phone text CHECK (phone IS NULL OR phone ~ '^\+?[0-9\s\-()]+$'),
  ecomail_subscriber_id text,
  total_spent numeric(10, 2) DEFAULT 0 CHECK (total_spent >= 0),
  last_purchase_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for customers
CREATE INDEX idx_customers_last_purchase_at ON customers(last_purchase_at DESC);

-- Add comment for documentation
COMMENT ON TABLE customers IS 'Customer information - single source of truth for customer data';
COMMENT ON COLUMN customers.ecomail_subscriber_id IS 'Ecomail subscriber ID for tracking sync status';
COMMENT ON COLUMN customers.total_spent IS 'Lifetime value - total amount spent by customer';
COMMENT ON COLUMN customers.last_purchase_at IS 'Timestamp of most recent purchase';

-- ================================================
-- TABLE: categories
-- Description: Product categories for organization and filtering
-- ================================================
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for categories
CREATE INDEX idx_categories_parent_id ON categories(parent_id);

-- Add comment for documentation
COMMENT ON TABLE categories IS 'Product categories for filtering, SEO, and quiz matching';
COMMENT ON COLUMN categories.parent_id IS 'Parent category for hierarchical structure (e.g., Europe -> Italy)';

-- ================================================
-- TABLE: products
-- Description: Travel guide products (PDF files)
-- ================================================
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  price numeric(10, 2) NOT NULL CHECK (price >= 0),
  duration text,
  badge text,
  pdf_url text,
  image_url text,
  slug text NOT NULL,
  seo_title text,
  seo_description text,
  vat_rate numeric(5, 2) DEFAULT 21.00 CHECK (vat_rate >= 0 AND vat_rate <= 100),
  quiz_data jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true NOT NULL,
  is_deleted boolean DEFAULT false NOT NULL,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for products
CREATE UNIQUE INDEX idx_products_slug_unique ON products(slug) WHERE is_deleted = false;
CREATE INDEX idx_products_created_at ON products(created_at DESC);
CREATE INDEX idx_products_quiz_data ON products USING GIN(quiz_data);
CREATE INDEX idx_products_is_active ON products(is_active) WHERE is_active = true;
CREATE INDEX idx_products_is_deleted ON products(is_deleted) WHERE is_deleted = false;
CREATE INDEX idx_products_deleted_at ON products(deleted_at) WHERE deleted_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON TABLE products IS 'Travel guide products sold in the e-shop';
COMMENT ON COLUMN products.duration IS 'Trip duration (e.g., "5 dní", "1 týden")';
COMMENT ON COLUMN products.badge IS 'Marketing badge (e.g., "Novinka", "Bestseller", "Sleva")';
COMMENT ON COLUMN products.quiz_data IS 'JSONB metadata for quiz matching (FÁZE 5)';
COMMENT ON COLUMN products.vat_rate IS 'VAT rate in percentage (default 21% for Czech Republic)';
COMMENT ON COLUMN products.is_active IS 'Product visibility (true = shown, false = hidden)';
COMMENT ON COLUMN products.is_deleted IS 'Soft delete flag (true = deleted, false = active)';
COMMENT ON COLUMN products.deleted_at IS 'Timestamp when product was soft deleted';

-- ================================================
-- TABLE: product_categories
-- Description: Many-to-many relationship between products and categories
-- ================================================
CREATE TABLE product_categories (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

-- Create indexes for product_categories
CREATE INDEX idx_product_categories_product_id ON product_categories(product_id);
CREATE INDEX idx_product_categories_category_id ON product_categories(category_id);

-- Add comment for documentation
COMMENT ON TABLE product_categories IS 'Many-to-many relationship: products can have multiple categories';

-- ================================================
-- TABLE: blog_posts
-- Description: Blog articles
-- ================================================
CREATE TABLE blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  excerpt text,
  image_url text,
  slug text NOT NULL UNIQUE,
  seo_title text,
  seo_description text,
  published_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for blog_posts
CREATE INDEX idx_blog_posts_published_at ON blog_posts(published_at DESC NULLS LAST);
CREATE INDEX idx_blog_posts_created_at ON blog_posts(created_at DESC);

-- Add comment for documentation
COMMENT ON TABLE blog_posts IS 'Blog articles for travel inspiration';
COMMENT ON COLUMN blog_posts.published_at IS 'NULL = draft, timestamptz = published';
COMMENT ON COLUMN blog_posts.excerpt IS 'Short excerpt for blog listing page';

-- ================================================
-- TABLE: orders
-- Description: Customer orders (header)
-- ================================================
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_email text NOT NULL,
  customer_name text NOT NULL,
  total_amount numeric(10, 2) NOT NULL CHECK (total_amount >= 0),
  stripe_payment_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  facturoid_invoice_id text,
  facturoid_invoice_number text,
  invoice_sent boolean DEFAULT false NOT NULL,
  ecomail_synced boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for orders
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_customer_email ON orders(customer_email);
CREATE INDEX idx_orders_stripe_payment_id ON orders(stripe_payment_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_pending ON orders(created_at DESC) WHERE status = 'pending';

-- Add comment for documentation
COMMENT ON TABLE orders IS 'Customer orders (header) - see order_items for line items';
COMMENT ON COLUMN orders.customer_id IS 'Reference to customers table (NULL if customer record not created yet)';
COMMENT ON COLUMN orders.customer_email IS 'Denormalized for fast queries without JOIN';
COMMENT ON COLUMN orders.customer_name IS 'Denormalized for fast queries without JOIN';
COMMENT ON COLUMN orders.total_amount IS 'Total order amount including all items (in CZK)';
COMMENT ON COLUMN orders.stripe_payment_id IS 'Stripe Payment Intent ID for webhook lookup';
COMMENT ON COLUMN orders.status IS 'Order status: pending, completed, failed, refunded';
COMMENT ON COLUMN orders.ecomail_synced IS 'Has customer been added to Ecomail?';
COMMENT ON COLUMN orders.invoice_sent IS 'Has invoice been sent via email?';

-- ================================================
-- TABLE: order_items
-- Description: Line items for orders (products in each order)
-- ================================================
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price_at_purchase numeric(10, 2) NOT NULL CHECK (price_at_purchase >= 0),
  vat_rate_at_purchase numeric(5, 2) NOT NULL CHECK (vat_rate_at_purchase >= 0 AND vat_rate_at_purchase <= 100),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for order_items
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- Add comment for documentation
COMMENT ON TABLE order_items IS 'Line items - products in each order';
COMMENT ON COLUMN order_items.price_at_purchase IS 'Product price at time of purchase (for historical accuracy)';
COMMENT ON COLUMN order_items.vat_rate_at_purchase IS 'VAT rate at time of purchase (for invoicing)';
COMMENT ON COLUMN order_items.quantity IS 'Quantity of product (usually 1 for digital products)';

-- ================================================
-- TABLE: custom_itinerary_requests
-- Description: Custom itinerary requests from customers
-- ================================================
CREATE TABLE custom_itinerary_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_email text NOT NULL,
  customer_name text NOT NULL,
  form_data jsonb NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'completed', 'cancelled')),
  consultation_notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for custom_itinerary_requests
CREATE INDEX idx_custom_requests_customer_id ON custom_itinerary_requests(customer_id);
CREATE INDEX idx_custom_requests_customer_email ON custom_itinerary_requests(customer_email);
CREATE INDEX idx_custom_requests_status ON custom_itinerary_requests(status);
CREATE INDEX idx_custom_requests_created_at ON custom_itinerary_requests(created_at DESC);
CREATE INDEX idx_custom_requests_form_data ON custom_itinerary_requests USING GIN(form_data);

-- Add comment for documentation
COMMENT ON TABLE custom_itinerary_requests IS 'Custom itinerary requests from customers';
COMMENT ON COLUMN custom_itinerary_requests.customer_id IS 'Reference to customers table (NULL if customer record not created yet)';
COMMENT ON COLUMN custom_itinerary_requests.customer_email IS 'Denormalized for fast queries without JOIN';
COMMENT ON COLUMN custom_itinerary_requests.customer_name IS 'Denormalized for fast queries without JOIN';
COMMENT ON COLUMN custom_itinerary_requests.form_data IS 'JSONB data from custom itinerary form';
COMMENT ON COLUMN custom_itinerary_requests.consultation_notes IS 'Jana''s notes about consultation';

-- ================================================
-- TABLE: download_tokens
-- Description: Secure download tokens for PDF delivery
-- ================================================
CREATE TABLE download_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL CHECK (expires_at > created_at),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for download_tokens
CREATE INDEX idx_download_tokens_token ON download_tokens(token);
CREATE INDEX idx_download_tokens_order_id ON download_tokens(order_id);
CREATE INDEX idx_download_tokens_expires_at ON download_tokens(expires_at);

-- Add comment for documentation
COMMENT ON TABLE download_tokens IS 'Secure tokens for PDF download links';
COMMENT ON COLUMN download_tokens.token IS 'Random unique token for download URL';
COMMENT ON COLUMN download_tokens.expires_at IS 'Token expiration (e.g., 7 days from order)';

-- ================================================
-- TABLE: integration_logs
-- Description: API call logs for Ecomail and Facturoid
-- ================================================
CREATE TABLE integration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service text NOT NULL CHECK (service IN ('ecomail', 'facturoid', 'stripe', 'other')),
  action text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for integration_logs
CREATE INDEX idx_integration_logs_service ON integration_logs(service);
CREATE INDEX idx_integration_logs_status ON integration_logs(status);
CREATE INDEX idx_integration_logs_created_at ON integration_logs(created_at DESC);
CREATE INDEX idx_integration_logs_metadata ON integration_logs USING GIN(metadata);

-- Add comment for documentation
COMMENT ON TABLE integration_logs IS 'Logs for external API calls (Ecomail, Facturoid, Stripe)';
COMMENT ON COLUMN integration_logs.service IS 'Service name: ecomail, facturoid, stripe, other';
COMMENT ON COLUMN integration_logs.action IS 'Action performed: add_subscriber, create_invoice, etc.';
COMMENT ON COLUMN integration_logs.metadata IS 'Extra data like order_id, response body, etc.';

-- ================================================
-- TABLE: newsletter_consent_log
-- Description: GDPR-compliant consent tracking for newsletter
-- ================================================
CREATE TABLE newsletter_consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  consent_given boolean NOT NULL,
  source text NOT NULL,
  ip_address inet,
  user_agent text,
  privacy_policy_version text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for newsletter_consent_log
CREATE INDEX idx_newsletter_consent_email ON newsletter_consent_log(email);
CREATE INDEX idx_newsletter_consent_created_at ON newsletter_consent_log(created_at DESC);

-- Add comment for documentation
COMMENT ON TABLE newsletter_consent_log IS 'GDPR audit log for newsletter opt-in/opt-out (proof of consent)';
COMMENT ON COLUMN newsletter_consent_log.consent_given IS 'true = opt-in, false = opt-out';
COMMENT ON COLUMN newsletter_consent_log.source IS 'Where consent was given: blog, checkout, footer, etc.';
COMMENT ON COLUMN newsletter_consent_log.ip_address IS 'IP address at time of consent (GDPR requirement)';
COMMENT ON COLUMN newsletter_consent_log.user_agent IS 'Browser/device info (GDPR requirement)';
COMMENT ON COLUMN newsletter_consent_log.privacy_policy_version IS 'Version of privacy policy shown to user';

-- ================================================
-- TRIGGERS: Automatic updated_at timestamps
-- ================================================

-- Trigger for customers
CREATE TRIGGER handle_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

-- Trigger for categories
CREATE TRIGGER handle_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

-- Trigger for products
CREATE TRIGGER handle_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

-- Trigger for blog_posts
CREATE TRIGGER handle_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

-- Trigger for orders
CREATE TRIGGER handle_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

-- Trigger for custom_itinerary_requests
CREATE TRIGGER handle_custom_requests_updated_at
  BEFORE UPDATE ON custom_itinerary_requests
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

-- ================================================
-- SUCCESS MESSAGE
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Database schema created successfully!';
  RAISE NOTICE '📊 Created 11 tables:';
  RAISE NOTICE '   - customers (normalized customer data)';
  RAISE NOTICE '   - categories (product categories)';
  RAISE NOTICE '   - products (travel guides with status flags)';
  RAISE NOTICE '   - product_categories (many-to-many)';
  RAISE NOTICE '   - blog_posts (articles)';
  RAISE NOTICE '   - orders (order header with total_amount)';
  RAISE NOTICE '   - order_items (line items with price_at_purchase)';
  RAISE NOTICE '   - custom_itinerary_requests (custom orders)';
  RAISE NOTICE '   - download_tokens (PDF delivery)';
  RAISE NOTICE '   - integration_logs (API audit trail)';
  RAISE NOTICE '   - newsletter_consent_log (GDPR compliance)';
  RAISE NOTICE '🔍 Created indexes for optimal query performance';
  RAISE NOTICE '⏰ Configured automatic updated_at triggers';
  RAISE NOTICE '🛡️  Product soft delete support (is_active, is_deleted)';
  RAISE NOTICE '📦 Multi-item orders support (order_items table)';
  RAISE NOTICE '🏷️  Category support for filtering and SEO';
  RAISE NOTICE '👤 Normalized customer data with lifetime value tracking';
  RAISE NOTICE '📝 GDPR-compliant newsletter consent logging';
  RAISE NOTICE '🎯 Next steps: Configure Row Level Security (RLS) policies';
END $$;
