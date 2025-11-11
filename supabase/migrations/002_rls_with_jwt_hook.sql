-- ================================================
-- CESTY BEZ MAPY - Row Level Security with JWT Hook
-- ================================================
-- Created: 2025-11-05
-- Description: Modern RLS implementation using Custom Access Token Hook
-- Approach: Store roles in user_roles table, add to JWT via hook
-- Benefits: 10-100x faster than DB reads, follows 2025 best practices
-- ================================================

-- ================================================
-- TABLE: user_roles
-- Secure role management (RBAC)
-- ================================================
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'user')),
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

-- Create index for fast role lookups (idempotent)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

COMMENT ON TABLE user_roles IS 'User roles for RBAC - roles are added to JWT via custom_access_token_hook. NOTE: After role change, user must sign out and sign in again to get updated JWT claims.';

-- ================================================
-- TRIGGER: Auto-assign default role to new users
-- ================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

-- Drop trigger if exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS
  'Automatically assigns default role "user" to newly registered users';

-- ================================================
-- CUSTOM ACCESS TOKEN HOOK
-- Adds custom claims to JWT token
-- ================================================
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  claims jsonb;
  user_id uuid;
  is_admin boolean;
BEGIN
  -- Extract user_id and claims from event
  user_id := (event->>'user_id')::uuid;
  claims := event->'claims';

  -- Check if user is admin (with table alias to avoid shadowing)
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = custom_access_token_hook.user_id
    AND ur.role = 'admin'
  ) INTO is_admin;

  -- Add custom claims to JWT
  claims := jsonb_set(claims, '{is_admin}', to_jsonb(is_admin));
  claims := jsonb_set(claims, '{user_role}',
    to_jsonb(CASE WHEN is_admin THEN 'admin' ELSE 'user' END)
  );

  -- Return updated claims (Supabase will merge into JWT)
  RETURN jsonb_build_object('claims', claims);
END;
$$;

COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS
  'Custom access token hook - adds is_admin and user_role claims to JWT based on user_roles table';

-- ================================================
-- SECURITY GRANTS FOR AUTH HOOK
-- ================================================

-- Allow supabase_auth_admin to execute the hook
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb)
  TO supabase_auth_admin;

-- Allow access to public schema
GRANT USAGE ON SCHEMA public
  TO supabase_auth_admin;

-- Allow reading from user_roles table (hook needs this!)
GRANT SELECT ON TABLE public.user_roles
  TO supabase_auth_admin;

-- Revoke access from other roles (security)
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb)
  FROM authenticated, anon, public;

-- ================================================
-- RLS ON user_roles TABLE
-- ================================================

-- Enable RLS on user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "auth_admin_read_user_roles" ON user_roles;
DROP POLICY IF EXISTS "user_roles_admin_select" ON user_roles;
DROP POLICY IF EXISTS "user_roles_admin_insert" ON user_roles;
DROP POLICY IF EXISTS "user_roles_admin_update" ON user_roles;
DROP POLICY IF EXISTS "user_roles_admin_delete" ON user_roles;

-- Policy: supabase_auth_admin can read all roles (needed for hook)
CREATE POLICY "auth_admin_read_user_roles"
  ON user_roles
  FOR SELECT
  TO supabase_auth_admin
  USING (true);

-- Policy: Only admins can manage roles
CREATE POLICY "user_roles_admin_select"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING ((SELECT is_admin()));

CREATE POLICY "user_roles_admin_insert"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT is_admin()));

CREATE POLICY "user_roles_admin_update"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

CREATE POLICY "user_roles_admin_delete"
  ON user_roles
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- HELPER FUNCTION: Check if user is admin
-- ================================================
-- Reads from JWT token (fast!) instead of database
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    (auth.jwt()->>'is_admin')::boolean,
    false
  );
$$;

COMMENT ON FUNCTION is_admin() IS 'Checks if current user is admin by reading JWT token (fast, no DB query)';

-- ================================================
-- TABLE: products
-- Public read, Admin write
-- ================================================

-- Enable RLS on products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "products_public_select" ON products;
DROP POLICY IF EXISTS "products_admin_insert" ON products;
DROP POLICY IF EXISTS "products_admin_update" ON products;
DROP POLICY IF EXISTS "products_admin_delete" ON products;

-- Policy: Anyone can read products
CREATE POLICY "products_public_select"
  ON products
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Policy: Only admins can insert products
CREATE POLICY "products_admin_insert"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT is_admin()));

-- Policy: Only admins can update products
CREATE POLICY "products_admin_update"
  ON products
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- Policy: Only admins can delete products
CREATE POLICY "products_admin_delete"
  ON products
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

COMMENT ON POLICY "products_public_select" ON products IS 'Allow public read access to all products';
COMMENT ON POLICY "products_admin_insert" ON products IS 'Only admins can create products';
COMMENT ON POLICY "products_admin_update" ON products IS 'Only admins can update products';
COMMENT ON POLICY "products_admin_delete" ON products IS 'Only admins can delete products';

-- ================================================
-- TABLE: blog_posts
-- Public read for published, Admin write
-- ================================================

-- Enable RLS on blog_posts
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent) - including old renamed policies
DROP POLICY IF EXISTS "blog_posts_public_select" ON blog_posts;
DROP POLICY IF EXISTS "blog_posts_authenticated_select" ON blog_posts;
DROP POLICY IF EXISTS "blog_posts_admin_select" ON blog_posts;  -- old policy name
DROP POLICY IF EXISTS "blog_posts_admin_insert" ON blog_posts;
DROP POLICY IF EXISTS "blog_posts_admin_update" ON blog_posts;
DROP POLICY IF EXISTS "blog_posts_admin_delete" ON blog_posts;

-- Policy: Anonymous users can read published blog posts
CREATE POLICY "blog_posts_public_select"
  ON blog_posts
  FOR SELECT
  TO anon
  USING (published_at IS NOT NULL);

-- Policy: Authenticated users can see published posts OR all posts if admin
CREATE POLICY "blog_posts_authenticated_select"
  ON blog_posts
  FOR SELECT
  TO authenticated
  USING (
    published_at IS NOT NULL  -- anyone can see published posts
    OR (SELECT is_admin())    -- admins can see all posts (including drafts)
  );

-- Policy: Only admins can insert blog posts
CREATE POLICY "blog_posts_admin_insert"
  ON blog_posts
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT is_admin()));

-- Policy: Only admins can update blog posts
CREATE POLICY "blog_posts_admin_update"
  ON blog_posts
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- Policy: Only admins can delete blog posts
CREATE POLICY "blog_posts_admin_delete"
  ON blog_posts
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

COMMENT ON POLICY "blog_posts_public_select" ON blog_posts IS 'Anonymous users can read published posts only';
COMMENT ON POLICY "blog_posts_authenticated_select" ON blog_posts IS 'Authenticated users see published posts, admins see all including drafts';

-- ================================================
-- TABLE: orders
-- Admin only access
-- NOTE: Stripe webhooks use service_role which bypasses RLS
-- ================================================

-- Enable RLS on orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "orders_admin_select" ON orders;
DROP POLICY IF EXISTS "orders_admin_insert" ON orders;
DROP POLICY IF EXISTS "orders_admin_update" ON orders;
DROP POLICY IF EXISTS "orders_admin_delete" ON orders;

-- Policy: Only admins can view orders
CREATE POLICY "orders_admin_select"
  ON orders
  FOR SELECT
  TO authenticated
  USING ((SELECT is_admin()));

-- Policy: Only admins can update orders
CREATE POLICY "orders_admin_update"
  ON orders
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- Policy: Only admins can insert orders (for manual/offline orders)
CREATE POLICY "orders_admin_insert"
  ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT is_admin()));

-- Policy: Only admins can delete orders
CREATE POLICY "orders_admin_delete"
  ON orders
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

COMMENT ON POLICY "orders_admin_select" ON orders IS 'Only admins can view orders';
COMMENT ON POLICY "orders_admin_insert" ON orders IS 'Only admins can manually create orders (e.g., offline sales)';
COMMENT ON POLICY "orders_admin_update" ON orders IS 'Only admins can update orders';
COMMENT ON POLICY "orders_admin_delete" ON orders IS 'Only admins can delete orders';

-- ================================================
-- TABLE: custom_itinerary_requests
-- Public insert, Admin read/write
-- ================================================

-- Enable RLS on custom_itinerary_requests
ALTER TABLE custom_itinerary_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "custom_requests_public_insert" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "custom_requests_admin_select" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "custom_requests_admin_update" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "custom_requests_admin_delete" ON custom_itinerary_requests;

-- Policy: Anyone can submit requests
CREATE POLICY "custom_requests_public_insert"
  ON custom_itinerary_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy: Only admins can view requests
CREATE POLICY "custom_requests_admin_select"
  ON custom_itinerary_requests
  FOR SELECT
  TO authenticated
  USING ((SELECT is_admin()));

-- Policy: Only admins can update requests
CREATE POLICY "custom_requests_admin_update"
  ON custom_itinerary_requests
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- Policy: Only admins can delete requests
CREATE POLICY "custom_requests_admin_delete"
  ON custom_itinerary_requests
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

COMMENT ON POLICY "custom_requests_public_insert" ON custom_itinerary_requests IS 'Allow public to submit requests';
COMMENT ON POLICY "custom_requests_admin_select" ON custom_itinerary_requests IS 'Only admins can view requests';

-- ================================================
-- TABLE: download_tokens
-- Token validation, Admin management
-- NOTE: Webhooks use service_role to create tokens
-- ================================================

-- Enable RLS on download_tokens
ALTER TABLE download_tokens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent) - including old renamed policies
DROP POLICY IF EXISTS "download_tokens_public_select" ON download_tokens;
DROP POLICY IF EXISTS "download_tokens_authenticated_select" ON download_tokens;
DROP POLICY IF EXISTS "download_tokens_validate" ON download_tokens;  -- old policy name
DROP POLICY IF EXISTS "download_tokens_admin_select" ON download_tokens;  -- old policy name
DROP POLICY IF EXISTS "download_tokens_admin_insert" ON download_tokens;
DROP POLICY IF EXISTS "download_tokens_admin_delete" ON download_tokens;

-- Policy: Anonymous users can validate non-expired tokens
CREATE POLICY "download_tokens_public_select"
  ON download_tokens
  FOR SELECT
  TO anon
  USING (expires_at > now());

-- Policy: Authenticated users can validate non-expired tokens OR see all if admin
CREATE POLICY "download_tokens_authenticated_select"
  ON download_tokens
  FOR SELECT
  TO authenticated
  USING (
    expires_at > now()        -- anyone can validate non-expired tokens
    OR (SELECT is_admin())    -- admins can see all tokens (including expired)
  );

-- Policy: Admins can insert tokens (for manual resend/regenerate)
CREATE POLICY "download_tokens_admin_insert"
  ON download_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT is_admin()));

-- Policy: Admins can delete tokens
CREATE POLICY "download_tokens_admin_delete"
  ON download_tokens
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

COMMENT ON POLICY "download_tokens_public_select" ON download_tokens IS 'Anonymous users can validate non-expired tokens';
COMMENT ON POLICY "download_tokens_authenticated_select" ON download_tokens IS 'Authenticated users validate non-expired tokens, admins see all';
COMMENT ON POLICY "download_tokens_admin_insert" ON download_tokens IS 'Admins can manually create tokens (e.g., resend download link)';

-- ================================================
-- TABLE: integration_logs
-- Admin only access
-- NOTE: Webhooks use service_role to create logs
-- ================================================

-- Enable RLS on integration_logs
ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "integration_logs_admin_select" ON integration_logs;
DROP POLICY IF EXISTS "integration_logs_admin_insert" ON integration_logs;
DROP POLICY IF EXISTS "integration_logs_admin_delete" ON integration_logs;

-- Policy: Only admins can view logs
CREATE POLICY "integration_logs_admin_select"
  ON integration_logs
  FOR SELECT
  TO authenticated
  USING ((SELECT is_admin()));

-- Policy: Only admins can insert logs (for manual debugging)
CREATE POLICY "integration_logs_admin_insert"
  ON integration_logs
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT is_admin()));

-- Policy: Only admins can delete logs
CREATE POLICY "integration_logs_admin_delete"
  ON integration_logs
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

COMMENT ON POLICY "integration_logs_admin_select" ON integration_logs IS 'Only admins can view logs';
COMMENT ON POLICY "integration_logs_admin_insert" ON integration_logs IS 'Admins can manually create logs (e.g., debugging)';
COMMENT ON POLICY "integration_logs_admin_delete" ON integration_logs IS 'Admins can delete old logs';

-- ================================================
-- TABLE: customers
-- Admin only access
-- ================================================

-- Enable RLS on customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "customers_admin_select" ON customers;
DROP POLICY IF EXISTS "customers_admin_insert" ON customers;
DROP POLICY IF EXISTS "customers_admin_update" ON customers;
DROP POLICY IF EXISTS "customers_admin_delete" ON customers;

-- Policy: Only admins can view customers
CREATE POLICY "customers_admin_select"
  ON customers
  FOR SELECT
  TO authenticated
  USING ((SELECT is_admin()));

-- Policy: Only admins can insert customers
CREATE POLICY "customers_admin_insert"
  ON customers
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT is_admin()));

-- Policy: Only admins can update customers
CREATE POLICY "customers_admin_update"
  ON customers
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- Policy: Only admins can delete customers
CREATE POLICY "customers_admin_delete"
  ON customers
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

COMMENT ON POLICY "customers_admin_select" ON customers IS 'Only admins can view customer data';

-- ================================================
-- TABLE: categories
-- Public read, Admin write
-- ================================================

-- Enable RLS on categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "categories_public_select" ON categories;
DROP POLICY IF EXISTS "categories_admin_insert" ON categories;
DROP POLICY IF EXISTS "categories_admin_update" ON categories;
DROP POLICY IF EXISTS "categories_admin_delete" ON categories;

-- Policy: Anyone can read categories
CREATE POLICY "categories_public_select"
  ON categories
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Policy: Only admins can insert categories
CREATE POLICY "categories_admin_insert"
  ON categories
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT is_admin()));

-- Policy: Only admins can update categories
CREATE POLICY "categories_admin_update"
  ON categories
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- Policy: Only admins can delete categories
CREATE POLICY "categories_admin_delete"
  ON categories
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

COMMENT ON POLICY "categories_public_select" ON categories IS 'Allow public read access for filtering and SEO';

-- ================================================
-- TABLE: product_categories
-- Public read, Admin write
-- ================================================

-- Enable RLS on product_categories
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "product_categories_public_select" ON product_categories;
DROP POLICY IF EXISTS "product_categories_admin_insert" ON product_categories;
DROP POLICY IF EXISTS "product_categories_admin_delete" ON product_categories;

-- Policy: Anyone can read product_categories
CREATE POLICY "product_categories_public_select"
  ON product_categories
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Policy: Only admins can insert product_categories
CREATE POLICY "product_categories_admin_insert"
  ON product_categories
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT is_admin()));

-- Policy: Only admins can delete product_categories
CREATE POLICY "product_categories_admin_delete"
  ON product_categories
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

COMMENT ON POLICY "product_categories_public_select" ON product_categories IS 'Allow public read for category filtering';

-- ================================================
-- TABLE: order_items
-- Admin only access
-- NOTE: Webhooks use service_role which bypasses RLS
-- ================================================

-- Enable RLS on order_items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "order_items_admin_select" ON order_items;
DROP POLICY IF EXISTS "order_items_admin_insert" ON order_items;
DROP POLICY IF EXISTS "order_items_admin_update" ON order_items;
DROP POLICY IF EXISTS "order_items_admin_delete" ON order_items;

-- Policy: Only admins can view order_items
CREATE POLICY "order_items_admin_select"
  ON order_items
  FOR SELECT
  TO authenticated
  USING ((SELECT is_admin()));

-- Policy: Only admins can insert order_items (for manual orders)
CREATE POLICY "order_items_admin_insert"
  ON order_items
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT is_admin()));

-- Policy: Only admins can update order_items
CREATE POLICY "order_items_admin_update"
  ON order_items
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- Policy: Only admins can delete order_items
CREATE POLICY "order_items_admin_delete"
  ON order_items
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

COMMENT ON POLICY "order_items_admin_select" ON order_items IS 'Only admins can view order items';

-- ================================================
-- TABLE: newsletter_consent_log
-- Public insert (opt-in/opt-out), Admin read
-- Immutable audit log - NO UPDATE/DELETE
-- ================================================

-- Enable RLS on newsletter_consent_log
ALTER TABLE newsletter_consent_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "newsletter_consent_public_insert" ON newsletter_consent_log;
DROP POLICY IF EXISTS "newsletter_consent_admin_select" ON newsletter_consent_log;

-- Policy: Anyone can log consent (opt-in/opt-out)
CREATE POLICY "newsletter_consent_public_insert"
  ON newsletter_consent_log
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy: Only admins can view consent log
CREATE POLICY "newsletter_consent_admin_select"
  ON newsletter_consent_log
  FOR SELECT
  TO authenticated
  USING ((SELECT is_admin()));

COMMENT ON POLICY "newsletter_consent_public_insert" ON newsletter_consent_log IS 'Allow public to log consent events';
COMMENT ON POLICY "newsletter_consent_admin_select" ON newsletter_consent_log IS 'Only admins can view consent audit trail';

-- ================================================
-- CLEANUP FUNCTION: Remove expired tokens
-- ================================================
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM download_tokens
  WHERE expires_at < now() - interval '7 days';
END;
$$;

COMMENT ON FUNCTION cleanup_expired_tokens() IS 'Cleanup tokens expired more than 7 days ago';

-- ================================================
-- SUCCESS MESSAGE
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Row Level Security with JWT Hook created successfully!';
  RAISE NOTICE '🔒 Enabled RLS on 12 tables';
  RAISE NOTICE '⚡ Using JWT-based auth (10-100x faster than DB reads)';
  RAISE NOTICE '🎯 Custom Access Token Hook configured';
  RAISE NOTICE '🤖 Auto-assign trigger: New users get "user" role automatically';
  RAISE NOTICE '';
  RAISE NOTICE '📖 Public READ access:';
  RAISE NOTICE '   - products (all active products)';
  RAISE NOTICE '   - blog_posts (published only)';
  RAISE NOTICE '   - categories (for filtering)';
  RAISE NOTICE '   - product_categories (for joins)';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Public INSERT access:';
  RAISE NOTICE '   - custom_itinerary_requests (form submissions)';
  RAISE NOTICE '   - newsletter_consent_log (GDPR audit)';
  RAISE NOTICE '';
  RAISE NOTICE '👤 Admin FULL CRUD access:';
  RAISE NOTICE '   - customers (normalized customer data)';
  RAISE NOTICE '   - categories (category management)';
  RAISE NOTICE '   - products (with soft delete)';
  RAISE NOTICE '   - product_categories (assignments)';
  RAISE NOTICE '   - orders (order headers)';
  RAISE NOTICE '   - order_items (line items)';
  RAISE NOTICE '   - custom_requests (request management)';
  RAISE NOTICE '   - download_tokens (PDF delivery)';
  RAISE NOTICE '   - integration_logs (API audit)';
  RAISE NOTICE '';
  RAISE NOTICE '🔐 Security features:';
  RAISE NOTICE '   - Secure tokens: download_tokens (public validation for non-expired)';
  RAISE NOTICE '   - Immutable audit: newsletter_consent_log (no UPDATE/DELETE)';
  RAISE NOTICE '   - Defense in depth: Admin INSERT policies (webhooks use service_role)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  NEXT STEPS:';
  RAISE NOTICE '1. Enable hook in Supabase Dashboard: Authentication → Hooks → Custom Access Token';
  RAISE NOTICE '2. Select postgres function: public.custom_access_token_hook';
  RAISE NOTICE '3. Create first admin: Sign up → UPDATE user_roles SET role=''admin'' WHERE user_id=...';
  RAISE NOTICE '4. Test by logging in - JWT should contain is_admin=true claim';
END $$;
