-- ============================================================================
-- BASELINE — konsolidace 49 migrací (001–049) do jediného souboru
-- Projekt: Cesty bez mapy (dkblgznhnixubyoghrqe) · Postgres 17 · 2026-06-04
--
-- Původ: supabase db dump --linked --keep-comments (živé schéma po bezpečnostní
-- remediaci, migrace 047–049) + doplněno:
--   (1) STORAGE object RLS policies (storage schéma je managed; db dump je nebere)
--   (2) explicitní FUNCTION EXECUTE granty (Supabase local default-privileges by
--       jinak daly anon/authenticated execute; pg_dump revoked stav nereprodukuje)
-- Ověřeno: `supabase db reset --local` projde + introspekční hash schématu
-- (tabulky/RLS, 67 policies public+storage, 14 funkcí, granty, extensions, triggery)
-- je IDENTICKÝ s remote (mimo base-image pg_graphql, který je v každém lokálu).
-- Původní migrace 001–049 archivovány v supabase/_archive/migrations-pre-baseline/.
-- ============================================================================

--
-- PostgreSQL database dump
--

-- \restrict EmxEygOzBB4xiEeJ1qwyhDkraYQ16hYS2pXF6AH3s0iFE8KkU6g7satmVUTb4Cr

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
-- SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_net; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "pg_net"; Type: COMMENT; Schema: -; Owner: 
--

-- COMMENT ON EXTENSION "pg_net" IS 'Async HTTP';


--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: moddatetime; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "moddatetime" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "moddatetime"; Type: COMMENT; Schema: -; Owner: 
--

-- COMMENT ON EXTENSION "moddatetime" IS 'functions for tracking last modification time';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "pg_stat_statements"; Type: COMMENT; Schema: -; Owner: 
--

-- COMMENT ON EXTENSION "pg_stat_statements" IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "pgcrypto"; Type: COMMENT; Schema: -; Owner: 
--

-- COMMENT ON EXTENSION "pgcrypto" IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";


--
-- Name: EXTENSION "supabase_vault"; Type: COMMENT; Schema: -; Owner: 
--

-- COMMENT ON EXTENSION "supabase_vault" IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

-- COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: cleanup_orphaned_anon_users(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."cleanup_orphaned_anon_users"("retention_days" integer DEFAULT 60) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_deleted_count int;
BEGIN
  WITH deleted AS (
    DELETE FROM auth.users u
    WHERE u.is_anonymous = true
      AND u.created_at < now() - (retention_days || ' days')::interval
      AND NOT EXISTS (
        SELECT 1 FROM public.orders o WHERE o.auth_user_id = u.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.custom_itinerary_requests r WHERE r.auth_user_id = u.id
      )
    RETURNING u.id
  )
  SELECT count(*) INTO v_deleted_count FROM deleted;

  RAISE NOTICE 'cleanup_orphaned_anon_users: deleted % orphaned anonymous user(s) older than % days', v_deleted_count, retention_days;

  RETURN v_deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_orphaned_anon_users"("retention_days" integer) OWNER TO "postgres";

--
-- Name: FUNCTION "cleanup_orphaned_anon_users"("retention_days" integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."cleanup_orphaned_anon_users"("retention_days" integer) IS 'Maze anonymni auth.users starsi nez retention_days bez vazby na orders/custom_itinerary_requests. Vola pg_cron.';


--
-- Name: create_order_with_items("jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."create_order_with_items"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_order_id uuid;
  v_was_created boolean;
  v_customer_id uuid;
  v_total_amount numeric;
  v_download_token text;
  v_linked_request_ids uuid[];
  v_item jsonb;
BEGIN
  v_customer_id := NULLIF(p_payload->>'customer_id', '')::uuid;
  v_total_amount := (p_payload->>'total_amount')::numeric;
  v_download_token := NULLIF(p_payload->>'download_token', '');

  INSERT INTO orders (
    auth_user_id,
    customer_id,
    customer_email,
    customer_name,
    total_amount,
    stripe_payment_id,
    status,
    is_company,
    company_name,
    company_ico,
    company_dic,
    billing_street,
    billing_city,
    billing_zip
  ) VALUES (
    NULLIF(p_payload->>'auth_user_id', '')::uuid,
    v_customer_id,
    p_payload->>'customer_email',
    p_payload->>'customer_name',
    v_total_amount,
    p_payload->>'stripe_payment_id',
    'completed',
    COALESCE((p_payload->>'is_company')::boolean, false),
    NULLIF(p_payload->>'company_name', ''),
    NULLIF(p_payload->>'company_ico', ''),
    NULLIF(p_payload->>'company_dic', ''),
    NULLIF(p_payload->>'billing_street', ''),
    NULLIF(p_payload->>'billing_city', ''),
    NULLIF(p_payload->>'billing_zip', '')
  )
  ON CONFLICT (stripe_payment_id) DO NOTHING
  RETURNING id INTO v_order_id;

  IF v_order_id IS NOT NULL THEN
    v_was_created := true;
  ELSE
    v_was_created := false;
    SELECT id INTO v_order_id
      FROM orders
      WHERE stripe_payment_id = p_payload->>'stripe_payment_id';
  END IF;

  v_linked_request_ids := ARRAY[]::uuid[];
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items')
  LOOP
    INSERT INTO order_items (
      order_id,
      product_id,
      quantity,
      price_at_purchase,
      vat_rate_at_purchase,
      custom_itinerary_request_id
    ) VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::int,
      (v_item->>'price_at_purchase')::numeric,
      (v_item->>'vat_rate_at_purchase')::numeric,
      NULLIF(v_item->>'custom_itinerary_request_id', '')::uuid
    )
    ON CONFLICT (order_id, product_id) DO NOTHING;

    IF NULLIF(v_item->>'custom_itinerary_request_id', '') IS NOT NULL THEN
      v_linked_request_ids := v_linked_request_ids
        || (v_item->>'custom_itinerary_request_id')::uuid;
    END IF;
  END LOOP;

  IF array_length(v_linked_request_ids, 1) IS NOT NULL THEN
    UPDATE custom_itinerary_requests
       SET status = 'paid',
           updated_at = now()
     WHERE id = ANY(v_linked_request_ids)
       AND status = 'new';
  END IF;

  IF v_download_token IS NOT NULL THEN
    INSERT INTO download_tokens (order_id, token)
    SELECT v_order_id, v_download_token
    WHERE NOT EXISTS (
      SELECT 1 FROM download_tokens WHERE order_id = v_order_id
    );
  END IF;

  IF v_was_created AND v_customer_id IS NOT NULL THEN
    UPDATE customers
       SET total_spent = COALESCE(total_spent, 0) + v_total_amount,
           last_purchase_at = now()
     WHERE id = v_customer_id;
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'was_created', v_was_created
  );
END;
$$;


ALTER FUNCTION "public"."create_order_with_items"("p_payload" "jsonb") OWNER TO "postgres";

--
-- Name: FUNCTION "create_order_with_items"("p_payload" "jsonb"); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."create_order_with_items"("p_payload" "jsonb") IS 'Atomické vytvoření objednávky s položkami; idempotentní podle stripe_payment_id. Po 038: přijímá B2B billing pole (is_company, company_name, company_ico, company_dic, billing_street, billing_city, billing_zip) pro Fakturoid fakturaci.';


--
-- Name: custom_access_token_hook("jsonb"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."custom_access_token_hook"("event" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
DECLARE
  claims jsonb;
  is_admin boolean;
BEGIN
  -- Extract claims from event
  claims := event->'claims';

  -- Check if user is admin - read user_id directly from event parameter
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (event->>'user_id')::uuid
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


ALTER FUNCTION "public"."custom_access_token_hook"("event" "jsonb") OWNER TO "postgres";

--
-- Name: FUNCTION "custom_access_token_hook"("event" "jsonb"); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") IS 'Custom access token hook - adds is_admin and user_role claims to JWT based on user_roles table';


--
-- Name: handle_new_permanent_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."handle_new_permanent_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Kontroluj přímo sloupec is_anonymous (NE raw_user_meta_data)
  IF NEW.is_anonymous = true THEN
    RAISE NOTICE 'Skipped customer creation for anonymous user: %', NEW.id;
    RETURN NEW;
  END IF;

  -- Pouze pro NON-anonymous uživatele s emailem
  IF NEW.email IS NOT NULL THEN
    INSERT INTO public.customers (
      id,
      email,
      name,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', 'Nepojmenovaný zákazník'),
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Created customer record for user: %', NEW.email;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_permanent_user"() OWNER TO "postgres";

--
-- Name: FUNCTION "handle_new_permanent_user"(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."handle_new_permanent_user"() IS 'Automatically create customer record AND assign role for new permanent users (merged from migrations 002 + 013)';


--
-- Name: handle_user_email_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."handle_user_email_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- When anonymous user adds email (upgrade to permanent)
  IF OLD.email IS NULL AND NEW.email IS NOT NULL THEN
    INSERT INTO public.customers (
      id,
      email,
      name,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'name', 'Nepojmenovaný zákazník'),
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = COALESCE(EXCLUDED.name, public.customers.name),
      updated_at = NOW();

    RAISE NOTICE 'Upgraded anonymous user to permanent customer: %', NEW.email;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_user_email_update"() OWNER TO "postgres";

--
-- Name: FUNCTION "handle_user_email_update"(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."handle_user_email_update"() IS 'Create customer record when anonymous user upgrades to permanent (adds email)';


--
-- Name: increment_download_count("uuid"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."increment_download_count"("token_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  UPDATE public.download_tokens
  SET download_count = download_count + 1
  WHERE id = token_id;
$$;


ALTER FUNCTION "public"."increment_download_count"("token_id" "uuid") OWNER TO "postgres";

--
-- Name: increment_email_resend_count("text", "uuid", "text"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."increment_email_resend_count"("table_name" "text", "row_id" "uuid", "key" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  new_count integer;
BEGIN
  IF table_name = 'orders' THEN
    UPDATE public.orders
    SET email_resend_counts = jsonb_set(
      email_resend_counts,
      ARRAY[key],
      to_jsonb(COALESCE((email_resend_counts->>key)::integer, 0) + 1)
    )
    WHERE id = row_id
    RETURNING (email_resend_counts->>key)::integer INTO new_count;
  ELSIF table_name = 'custom_itinerary_requests' THEN
    UPDATE public.custom_itinerary_requests
    SET email_resend_counts = jsonb_set(
      email_resend_counts,
      ARRAY[key],
      to_jsonb(COALESCE((email_resend_counts->>key)::integer, 0) + 1)
    )
    WHERE id = row_id
    RETURNING (email_resend_counts->>key)::integer INTO new_count;
  ELSE
    RAISE EXCEPTION 'Unknown table_name: %', table_name;
  END IF;

  RETURN new_count;
END;
$$;


ALTER FUNCTION "public"."increment_email_resend_count"("table_name" "text", "row_id" "uuid", "key" "text") OWNER TO "postgres";

--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
DECLARE
  jwt_data jsonb;
BEGIN
  -- Cache JWT data in a variable - called only once per query
  jwt_data := (SELECT auth.jwt());

  -- Check both conditions using the cached JWT
  RETURN
    -- Must have is_admin = true in JWT (from custom_access_token_hook)
    -- COALESCE: if null/missing, treat as false (not admin) = fail closed
    COALESCE((jwt_data->>'is_admin')::boolean, false)
    AND
    -- Must NOT be an anonymous user
    -- IS FALSE: if null/missing, returns false (deny access) = fail closed
    (jwt_data->>'is_anonymous')::boolean IS FALSE;
END;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";

--
-- Name: FUNCTION "is_admin"(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."is_admin"() IS 'Checks if current user is admin AND not anonymous. Uses PL/pgSQL with cached JWT for performance (single auth.jwt() call per query). Uses "fail closed" pattern - unknown/null values deny access. Updated in migration 024.';


--
-- Name: is_permanent_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."is_permanent_user"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
DECLARE
  jwt_data jsonb;
BEGIN
  -- Cache JWT data in a variable
  jwt_data := (SELECT auth.jwt());

  -- User is permanent (not anonymous) if is_anonymous is not true
  -- IS NOT TRUE handles: false -> true, null -> true, true -> false
  RETURN (jwt_data->>'is_anonymous')::boolean IS NOT TRUE;
END;
$$;


ALTER FUNCTION "public"."is_permanent_user"() OWNER TO "postgres";

--
-- Name: FUNCTION "is_permanent_user"(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."is_permanent_user"() IS 'Checks if current user is NOT anonymous (i.e., has a permanent account). Uses PL/pgSQL with cached JWT for performance. Updated in migration 024.';


--
-- Name: link_orders_to_customer(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."link_orders_to_customer"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  updated_count int;
BEGIN
  -- Link all orders with matching email
  UPDATE public.orders
  SET customer_id = NEW.id,
      updated_at = NOW()
  WHERE customer_email = NEW.email
    AND customer_id IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count > 0 THEN
    RAISE NOTICE 'Linked % order(s) to customer: %', updated_count, NEW.email;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."link_orders_to_customer"() OWNER TO "postgres";

--
-- Name: FUNCTION "link_orders_to_customer"(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."link_orders_to_customer"() IS 'Automatically link existing orders to newly created customer record (by email)';


--
-- Name: link_requests_to_customer(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."link_requests_to_customer"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  updated_count int;
BEGIN
  -- Link requests by either auth_user_id (in-place anon to permanent conversion)
  -- OR customer_email (separate-account registration with same email).
  -- Mirrors the email-based pattern from link_orders_to_customer.
  UPDATE public.custom_itinerary_requests
  SET customer_id = NEW.id,
      updated_at = NOW()
  WHERE (auth_user_id = NEW.id OR customer_email = NEW.email)
    AND customer_id IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count > 0 THEN
    RAISE NOTICE 'Linked % custom itinerary request(s) to customer: %', updated_count, NEW.email;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."link_requests_to_customer"() OWNER TO "postgres";

--
-- Name: FUNCTION "link_requests_to_customer"(); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."link_requests_to_customer"() IS 'Automatically link existing requests to newly created customer record (matches by auth_user_id OR customer_email)';


--
-- Name: notify_vercel_blog_publish(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."notify_vercel_blog_publish"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  hook_url text;
  is_relevant boolean;
begin
  -- Rebuild jen kdyz se to dotyka publikovaneho obsahu
  -- (novy/upraveny/smazany publikovany, vc. prechodu koncept<->publikovano).
  is_relevant :=
       (TG_OP = 'INSERT' and NEW.published_at is not null)
    or (TG_OP = 'UPDATE' and (NEW.published_at is not null or OLD.published_at is not null))
    or (TG_OP = 'DELETE' and OLD.published_at is not null);
  if not is_relevant then
    return coalesce(NEW, OLD);
  end if;

  select decrypted_secret into hook_url
  from vault.decrypted_secrets
  where name = 'vercel_deploy_hook';

  if hook_url is not null then
    perform net.http_post(
      url := hook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  end if;

  return coalesce(NEW, OLD);
end;
$$;


ALTER FUNCTION "public"."notify_vercel_blog_publish"() OWNER TO "postgres";

--
-- Name: update_all_products_in_order(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."update_all_products_in_order"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  UPDATE public.products
  SET total_sales = (
    SELECT COALESCE(SUM(oi.quantity), 0)
    FROM public.order_items oi
    JOIN public.orders o ON oi.order_id = o.id
    WHERE oi.product_id = public.products.id
      AND o.status = 'completed'
  )
  WHERE id IN (
    SELECT product_id FROM public.order_items WHERE order_id = NEW.id
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_all_products_in_order"() OWNER TO "postgres";

--
-- Name: update_product_total_sales(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."update_product_total_sales"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Handle INSERT or UPDATE
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE') THEN
    UPDATE public.products
    SET total_sales = (
      SELECT COALESCE(SUM(oi.quantity), 0)
      FROM public.order_items oi
      JOIN public.orders o ON oi.order_id = o.id
      WHERE oi.product_id = NEW.product_id
        AND o.status = 'completed'
    )
    WHERE id = NEW.product_id;

    -- If UPDATE changed product_id, update old product too
    IF (TG_OP = 'UPDATE') AND (OLD.product_id IS DISTINCT FROM NEW.product_id) THEN
      UPDATE public.products
      SET total_sales = (
        SELECT COALESCE(SUM(oi.quantity), 0)
        FROM public.order_items oi
        JOIN public.orders o ON oi.order_id = o.id
        WHERE oi.product_id = OLD.product_id
          AND o.status = 'completed'
      )
      WHERE id = OLD.product_id;
    END IF;
  END IF;

  -- Handle DELETE
  IF (TG_OP = 'DELETE') THEN
    UPDATE public.products
    SET total_sales = (
      SELECT COALESCE(SUM(oi.quantity), 0)
      FROM public.order_items oi
      JOIN public.orders o ON oi.order_id = o.id
      WHERE oi.product_id = OLD.product_id
        AND o.status = 'completed'
    )
    WHERE id = OLD.product_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_product_total_sales"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: blog_posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."blog_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "excerpt" "text",
    "image_url" "text",
    "slug" "text" NOT NULL,
    "seo_title" "text",
    "seo_description" "text",
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tag_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "preview_token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "public"."blog_posts" OWNER TO "postgres";

--
-- Name: TABLE "blog_posts"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."blog_posts" IS 'Blog articles for travel inspiration';


--
-- Name: COLUMN "blog_posts"."excerpt"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."blog_posts"."excerpt" IS 'Short excerpt for blog listing page';


--
-- Name: COLUMN "blog_posts"."published_at"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."blog_posts"."published_at" IS 'NULL = draft, timestamptz = published';


--
-- Name: COLUMN "blog_posts"."tag_ids"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."blog_posts"."tag_ids" IS 'Pole ID tagů (vzor products.category_ids, migrace 009)';


--
-- Name: COLUMN "blog_posts"."preview_token"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."blog_posts"."preview_token" IS 'Tajný token pro náhled konceptu přes edge fn get-blog-preview (per článek, rotovatelný).';


--
-- Name: blog_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."blog_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."blog_tags" OWNER TO "postgres";

--
-- Name: TABLE "blog_tags"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."blog_tags" IS 'Tagy pro blogové články (spravované adminem)';


--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."categories" OWNER TO "postgres";

--
-- Name: TABLE "categories"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."categories" IS 'Product categories for filtering, SEO, and quiz matching';


--
-- Name: contact_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."contact_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "subject" "text",
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "admin_notes" "text",
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "contact_messages_form_type_check" CHECK (("form_type" = ANY (ARRAY['contact'::"text", 'collaboration'::"text"]))),
    CONSTRAINT "contact_messages_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'in_progress'::"text", 'resolved'::"text", 'spam'::"text"])))
);


ALTER TABLE "public"."contact_messages" OWNER TO "postgres";

--
-- Name: csp_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."csp_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "disposition" "text" NOT NULL,
    "effective_directive" "text",
    "blocked_uri" "text",
    "document_uri" "text",
    "source_file" "text",
    "line_number" integer,
    "column_number" integer,
    "referrer" "text",
    "status_code" integer,
    "sample" "text",
    "user_agent" "text",
    "client_ip" "inet",
    "raw" "jsonb" NOT NULL,
    CONSTRAINT "csp_reports_disposition_check" CHECK (("disposition" = ANY (ARRAY['enforce'::"text", 'report'::"text"])))
);


ALTER TABLE "public"."csp_reports" OWNER TO "postgres";

--
-- Name: custom_itinerary_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."custom_itinerary_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid",
    "customer_email" "text" NOT NULL,
    "customer_name" "text" NOT NULL,
    "form_data" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "consultation_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auth_user_id" "uuid",
    "final_pdf_url" "text",
    "final_pdf_uploaded_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "delivery_email_sent_at" timestamp with time zone,
    "delivery_email_message_id" "text",
    "email_resend_counts" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "custom_itinerary_requests_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'paid'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."custom_itinerary_requests" OWNER TO "postgres";

--
-- Name: TABLE "custom_itinerary_requests"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."custom_itinerary_requests" IS 'Custom itinerary requests from customers';


--
-- Name: COLUMN "custom_itinerary_requests"."customer_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."custom_itinerary_requests"."customer_id" IS 'Customer ID (from customers table) - NULL for guests, automatically populated after account creation via trigger';


--
-- Name: COLUMN "custom_itinerary_requests"."customer_email"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."custom_itinerary_requests"."customer_email" IS 'Denormalized for fast queries without JOIN';


--
-- Name: COLUMN "custom_itinerary_requests"."customer_name"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."custom_itinerary_requests"."customer_name" IS 'Denormalized for fast queries without JOIN';


--
-- Name: COLUMN "custom_itinerary_requests"."form_data"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."custom_itinerary_requests"."form_data" IS 'JSONB data from custom itinerary form';


--
-- Name: COLUMN "custom_itinerary_requests"."consultation_notes"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."custom_itinerary_requests"."consultation_notes" IS 'Jana''s notes about consultation';


--
-- Name: COLUMN "custom_itinerary_requests"."auth_user_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."custom_itinerary_requests"."auth_user_id" IS 'Auth user ID (from auth.users) - supports both anonymous and permanent users. Used for RLS policies.';


--
-- Name: COLUMN "custom_itinerary_requests"."final_pdf_url"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."custom_itinerary_requests"."final_pdf_url" IS 'Cesta k finálnímu PDF v bucketu custom-itinerary-pdfs (NE plná URL — používá se pro tvorbu signed URL).';


--
-- Name: COLUMN "custom_itinerary_requests"."final_pdf_uploaded_at"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."custom_itinerary_requests"."final_pdf_uploaded_at" IS 'Časová značka, kdy admin nahrál finální PDF itinerář.';


--
-- Name: COLUMN "custom_itinerary_requests"."delivered_at"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."custom_itinerary_requests"."delivered_at" IS 'Časová značka, kdy admin označil itinerář jako doručený zákazníkovi.';


--
-- Name: COLUMN "custom_itinerary_requests"."delivery_email_sent_at"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."custom_itinerary_requests"."delivery_email_sent_at" IS 'Timestamp when custom itinerary delivery email (mail 3) was successfully sent.';


--
-- Name: COLUMN "custom_itinerary_requests"."delivery_email_message_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."custom_itinerary_requests"."delivery_email_message_id" IS 'Resend message ID for delivery email.';


--
-- Name: COLUMN "custom_itinerary_requests"."email_resend_counts"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."custom_itinerary_requests"."email_resend_counts" IS 'Per-email-type retry counter for admin manual resends. Keys: delivery.';


--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text",
    "ecomail_subscriber_id" "text",
    "total_spent" numeric(10,2) DEFAULT 0,
    "last_purchase_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customers_phone_check" CHECK ((("phone" IS NULL) OR ("phone" ~ '^\+?[0-9\s\-()]+$'::"text"))),
    CONSTRAINT "customers_total_spent_check" CHECK (("total_spent" >= (0)::numeric))
);


ALTER TABLE "public"."customers" OWNER TO "postgres";

--
-- Name: TABLE "customers"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."customers" IS 'Customer profiles - id matches auth.users.id (created via triggers from auth events)';


--
-- Name: COLUMN "customers"."ecomail_subscriber_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."customers"."ecomail_subscriber_id" IS 'Ecomail subscriber ID for tracking sync status';


--
-- Name: COLUMN "customers"."total_spent"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."customers"."total_spent" IS 'Lifetime value - total amount spent by customer';


--
-- Name: COLUMN "customers"."last_purchase_at"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."customers"."last_purchase_at" IS 'Timestamp of most recent purchase';


--
-- Name: download_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."download_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "token" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "asset_type" "text" DEFAULT 'product_pdf'::"text" NOT NULL,
    "custom_itinerary_request_id" "uuid",
    "download_count" integer DEFAULT 0 NOT NULL,
    "last_downloaded_at" timestamp with time zone,
    CONSTRAINT "download_tokens_asset_type_check" CHECK (("asset_type" = ANY (ARRAY['product_pdf'::"text", 'custom_itinerary_pdf'::"text"]))),
    CONSTRAINT "download_tokens_one_target" CHECK (((("asset_type" = 'product_pdf'::"text") AND ("order_id" IS NOT NULL) AND ("custom_itinerary_request_id" IS NULL)) OR (("asset_type" = 'custom_itinerary_pdf'::"text") AND ("custom_itinerary_request_id" IS NOT NULL) AND ("order_id" IS NULL))))
);


ALTER TABLE "public"."download_tokens" OWNER TO "postgres";

--
-- Name: TABLE "download_tokens"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."download_tokens" IS 'Secure tokens for PDF download links';


--
-- Name: COLUMN "download_tokens"."token"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."download_tokens"."token" IS 'Random unique token for download URL';


--
-- Name: COLUMN "download_tokens"."asset_type"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."download_tokens"."asset_type" IS 'Discriminator: product_pdf (multi-buyer master from products-pdfs) or custom_itinerary_pdf (per-customer file from custom-itinerary-pdfs).';


--
-- Name: COLUMN "download_tokens"."custom_itinerary_request_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."download_tokens"."custom_itinerary_request_id" IS 'Reference to custom_itinerary_requests when asset_type=custom_itinerary_pdf; NULL otherwise.';


--
-- Name: COLUMN "download_tokens"."download_count"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."download_tokens"."download_count" IS 'Number of successful download attempts (audit).';


--
-- Name: COLUMN "download_tokens"."last_downloaded_at"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."download_tokens"."last_downloaded_at" IS 'Timestamp of most recent successful download.';


--
-- Name: email_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."email_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "resend_email_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "email_to" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_events" OWNER TO "postgres";

--
-- Name: TABLE "email_events"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."email_events" IS 'Append-only log of every Resend webhook event. Unique (resend_email_id, event_type) for idempotent inserts.';


--
-- Name: email_suppressions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."email_suppressions" (
    "email" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "source_event_id" "text",
    "suppressed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text",
    CONSTRAINT "email_suppressions_reason_check" CHECK (("reason" = ANY (ARRAY['hard_bounce'::"text", 'complaint'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."email_suppressions" OWNER TO "postgres";

--
-- Name: TABLE "email_suppressions"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."email_suppressions" IS 'Addresses we must not send to. First reason wins (never demote). Manual entries inserted out-of-band.';


--
-- Name: COLUMN "email_suppressions"."email"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."email_suppressions"."email" IS 'Recipient address, lowercased by caller.';


--
-- Name: COLUMN "email_suppressions"."source_event_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."email_suppressions"."source_event_id" IS 'Resend webhook event id that triggered this entry. NULL for manual entries.';


--
-- Name: fakturoid_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."fakturoid_tokens" (
    "id" boolean DEFAULT true NOT NULL,
    "access_token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "fakturoid_tokens_id_check" CHECK (("id" = true))
);


ALTER TABLE "public"."fakturoid_tokens" OWNER TO "postgres";

--
-- Name: TABLE "fakturoid_tokens"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."fakturoid_tokens" IS 'Singleton row storing the current Fakturoid OAuth access token. Only service_role can access (RLS denies everyone else).';


--
-- Name: integration_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."integration_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service" "text" NOT NULL,
    "action" "text" NOT NULL,
    "status" "text" NOT NULL,
    "error_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "integration_logs_service_check" CHECK (("service" = ANY (ARRAY['ecomail'::"text", 'facturoid'::"text", 'stripe'::"text", 'other'::"text"]))),
    CONSTRAINT "integration_logs_status_check" CHECK (("status" = ANY (ARRAY['success'::"text", 'failed'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."integration_logs" OWNER TO "postgres";

--
-- Name: TABLE "integration_logs"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."integration_logs" IS 'Logs for external API calls (Ecomail, Facturoid, Stripe)';


--
-- Name: COLUMN "integration_logs"."service"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."integration_logs"."service" IS 'Service name: ecomail, facturoid, stripe, other';


--
-- Name: COLUMN "integration_logs"."action"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."integration_logs"."action" IS 'Action performed: add_subscriber, create_invoice, etc.';


--
-- Name: COLUMN "integration_logs"."metadata"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."integration_logs"."metadata" IS 'Extra data like order_id, response body, etc.';


--
-- Name: newsletter_consent_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."newsletter_consent_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "consent_given" boolean NOT NULL,
    "source" "text" NOT NULL,
    "ip_address" "inet",
    "user_agent" "text",
    "privacy_policy_version" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."newsletter_consent_log" OWNER TO "postgres";

--
-- Name: TABLE "newsletter_consent_log"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."newsletter_consent_log" IS 'GDPR audit log for newsletter opt-in/opt-out (proof of consent)';


--
-- Name: COLUMN "newsletter_consent_log"."consent_given"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."newsletter_consent_log"."consent_given" IS 'true = opt-in, false = opt-out';


--
-- Name: COLUMN "newsletter_consent_log"."source"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."newsletter_consent_log"."source" IS 'Where consent was given: blog, checkout, footer, etc.';


--
-- Name: COLUMN "newsletter_consent_log"."ip_address"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."newsletter_consent_log"."ip_address" IS 'IP address at time of consent (GDPR requirement)';


--
-- Name: COLUMN "newsletter_consent_log"."user_agent"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."newsletter_consent_log"."user_agent" IS 'Browser/device info (GDPR requirement)';


--
-- Name: COLUMN "newsletter_consent_log"."privacy_policy_version"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."newsletter_consent_log"."privacy_policy_version" IS 'Version of privacy policy shown to user';


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "price_at_purchase" numeric(10,2) NOT NULL,
    "vat_rate_at_purchase" numeric(5,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "custom_itinerary_request_id" "uuid",
    CONSTRAINT "order_items_price_at_purchase_check" CHECK (("price_at_purchase" >= (0)::numeric)),
    CONSTRAINT "order_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "order_items_vat_rate_at_purchase_check" CHECK ((("vat_rate_at_purchase" >= (0)::numeric) AND ("vat_rate_at_purchase" <= (100)::numeric)))
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";

--
-- Name: TABLE "order_items"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."order_items" IS 'Line items - products in each order';


--
-- Name: COLUMN "order_items"."quantity"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."order_items"."quantity" IS 'Quantity of product (usually 1 for digital products)';


--
-- Name: COLUMN "order_items"."price_at_purchase"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."order_items"."price_at_purchase" IS 'Product price at time of purchase (for historical accuracy)';


--
-- Name: COLUMN "order_items"."vat_rate_at_purchase"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."order_items"."vat_rate_at_purchase" IS 'VAT rate at time of purchase (for invoicing)';


--
-- Name: COLUMN "order_items"."custom_itinerary_request_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."order_items"."custom_itinerary_request_id" IS 'Link to custom itinerary request (NULL for standard products, UUID for custom itinerary orders)';


--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid",
    "customer_email" "text" NOT NULL,
    "customer_name" "text",
    "total_amount" numeric(10,2) NOT NULL,
    "stripe_payment_id" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "facturoid_invoice_id" "text",
    "facturoid_invoice_number" "text",
    "invoice_sent" boolean DEFAULT false NOT NULL,
    "ecomail_synced" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auth_user_id" "uuid",
    "confirmation_email_sent_at" timestamp with time zone,
    "confirmation_email_message_id" "text",
    "refund_email_sent_at" timestamp with time zone,
    "refund_email_message_id" "text",
    "email_resend_counts" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "facturoid_invoice_url" "text",
    "facturoid_storno_id" "text",
    "facturoid_storno_number" "text",
    "invoice_sent_at" timestamp with time zone,
    "invoice_error" "text",
    "is_company" boolean DEFAULT false NOT NULL,
    "company_name" "text",
    "company_ico" "text",
    "company_dic" "text",
    "billing_street" "text",
    "billing_city" "text",
    "billing_zip" "text",
    CONSTRAINT "orders_company_billing_check" CHECK ((("is_company" = false) OR (("company_name" IS NOT NULL) AND ("company_ico" IS NOT NULL) AND ("billing_street" IS NOT NULL) AND ("billing_city" IS NOT NULL) AND ("billing_zip" IS NOT NULL)))),
    CONSTRAINT "orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'failed'::"text", 'refunded'::"text"]))),
    CONSTRAINT "orders_total_amount_check" CHECK (("total_amount" >= (0)::numeric))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";

--
-- Name: TABLE "orders"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."orders" IS 'Customer orders (header) - see order_items for line items';


--
-- Name: COLUMN "orders"."customer_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."orders"."customer_id" IS 'Reference to customers table (NULL if customer record not created yet)';


--
-- Name: COLUMN "orders"."customer_email"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."orders"."customer_email" IS 'Denormalized for fast queries without JOIN';


--
-- Name: COLUMN "orders"."customer_name"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."orders"."customer_name" IS 'Denormalized for fast queries without JOIN';


--
-- Name: COLUMN "orders"."total_amount"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."orders"."total_amount" IS 'Total order amount including all items (in CZK)';


--
-- Name: COLUMN "orders"."stripe_payment_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."orders"."stripe_payment_id" IS 'Stripe Payment Intent ID for webhook lookup';


--
-- Name: COLUMN "orders"."status"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."orders"."status" IS 'Order status: pending, completed, failed, refunded';


--
-- Name: COLUMN "orders"."invoice_sent"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."orders"."invoice_sent" IS 'Has invoice been sent via email?';


--
-- Name: COLUMN "orders"."ecomail_synced"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."orders"."ecomail_synced" IS 'Has customer been added to Ecomail?';


--
-- Name: COLUMN "orders"."auth_user_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."orders"."auth_user_id" IS 'Link to auth.users for anonymous users';


--
-- Name: COLUMN "orders"."confirmation_email_sent_at"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."orders"."confirmation_email_sent_at" IS 'Timestamp when confirmation email (mail 1a or 1b) was successfully sent.';


--
-- Name: COLUMN "orders"."confirmation_email_message_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."orders"."confirmation_email_message_id" IS 'Resend message ID for confirmation email.';


--
-- Name: COLUMN "orders"."refund_email_sent_at"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."orders"."refund_email_sent_at" IS 'Timestamp when refund or payment-failed email (mail 2) was successfully sent.';


--
-- Name: COLUMN "orders"."refund_email_message_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."orders"."refund_email_message_id" IS 'Resend message ID for refund/failed email.';


--
-- Name: COLUMN "orders"."email_resend_counts"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."orders"."email_resend_counts" IS 'Per-email-type retry counter for admin manual resends. Keys: confirmation, refund, payment_failed.';


--
-- Name: COLUMN "orders"."facturoid_invoice_url"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."orders"."facturoid_invoice_url" IS 'Public HTML URL of invoice in Fakturoid app';


--
-- Name: COLUMN "orders"."invoice_error"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."orders"."invoice_error" IS 'Last error from Fakturoid API; NULL when success or not yet attempted';


--
-- Name: COLUMN "orders"."is_company"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."orders"."is_company" IS 'True if buyer purchased as a company (B2B with IČO)';


--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "duration" "text",
    "badge" "text",
    "pdf_url" "text",
    "image_url" "text",
    "slug" "text" NOT NULL,
    "seo_title" "text",
    "seo_description" "text",
    "vat_rate" numeric(5,2) DEFAULT 0,
    "quiz_data" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stripe_product_id" "text",
    "stripe_price_id" "text",
    "budget_level" integer,
    "spring_description" "text",
    "summer_description" "text",
    "autumn_description" "text",
    "winter_description" "text",
    "gallery_images" "jsonb" DEFAULT '[]'::"jsonb",
    "average_rating" numeric(3,2) DEFAULT 0.00,
    "review_count" integer DEFAULT 0,
    "detail_title" "text",
    "hero_subtitle" "text",
    "hero_line_1" "text",
    "hero_line_2" "text",
    "hero_line_3" "text",
    "hero_line_4" "text",
    "category_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "total_sales" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "products_average_rating_check" CHECK ((("average_rating" >= (0)::numeric) AND ("average_rating" <= (5)::numeric))),
    CONSTRAINT "products_budget_level_check" CHECK ((("budget_level" IS NULL) OR (("budget_level" >= 1) AND ("budget_level" <= 3)))),
    CONSTRAINT "products_gallery_images_check" CHECK (("jsonb_typeof"("gallery_images") = 'array'::"text")),
    CONSTRAINT "products_price_check" CHECK (("price" >= (0)::numeric)),
    CONSTRAINT "products_review_count_check" CHECK (("review_count" >= 0)),
    CONSTRAINT "products_total_sales_check" CHECK (("total_sales" >= 0)),
    CONSTRAINT "products_vat_rate_check" CHECK ((("vat_rate" >= (0)::numeric) AND ("vat_rate" <= (100)::numeric)))
);


ALTER TABLE "public"."products" OWNER TO "postgres";

--
-- Name: TABLE "products"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."products" IS 'Travel guide products sold in the e-shop';


--
-- Name: COLUMN "products"."title"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."title" IS 'Card title (longer, descriptive) - displayed on TravelGuides listing page';


--
-- Name: COLUMN "products"."description"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."description" IS 'Card description/preview text - displayed on TravelGuides listing page';


--
-- Name: COLUMN "products"."duration"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."duration" IS 'Trip duration (e.g., "5 dní", "1 týden")';


--
-- Name: COLUMN "products"."badge"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."badge" IS 'Marketing badge (e.g., "Novinka", "Bestseller", "Sleva")';


--
-- Name: COLUMN "products"."vat_rate"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."vat_rate" IS 'VAT rate in percentage (default 21% for Czech Republic)';


--
-- Name: COLUMN "products"."quiz_data"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."quiz_data" IS 'JSONB metadata for quiz matching (FÁZE 5)';


--
-- Name: COLUMN "products"."is_active"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."is_active" IS 'Product visibility (true = shown, false = hidden)';


--
-- Name: COLUMN "products"."is_deleted"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."is_deleted" IS 'Soft delete flag (true = deleted, false = active)';


--
-- Name: COLUMN "products"."deleted_at"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."deleted_at" IS 'Timestamp when product was soft deleted';


--
-- Name: COLUMN "products"."stripe_product_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."stripe_product_id" IS 'Stripe Product ID (prod_xxxxx) - for reference and metadata sync';


--
-- Name: COLUMN "products"."stripe_price_id"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."stripe_price_id" IS 'Stripe Price ID (price_xxxxx) - PRIMARY, used in Checkout Sessions';


--
-- Name: COLUMN "products"."budget_level"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."budget_level" IS 'Budget indicator: 1 = $, 2 = $$, 3 = $$$ (NULL if not applicable). Validated by CHECK constraint.';


--
-- Name: COLUMN "products"."spring_description"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."spring_description" IS 'Spring season (🌸 Jaro) - description of why this period is good for the trip. Icons and titles are hardcoded in frontend.';


--
-- Name: COLUMN "products"."summer_description"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."summer_description" IS 'Summer season (☀️ Léto) - description of why this period is good for the trip. Icons and titles are hardcoded in frontend.';


--
-- Name: COLUMN "products"."autumn_description"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."autumn_description" IS 'Autumn season (🍂 Podzim) - description of why this period is good for the trip. Icons and titles are hardcoded in frontend.';


--
-- Name: COLUMN "products"."winter_description"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."winter_description" IS 'Winter season (❄️ Zima) - description of why this period is good for the trip. Icons and titles are hardcoded in frontend.';


--
-- Name: COLUMN "products"."gallery_images"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."gallery_images" IS 'JSONB array with gallery images: [{url: "...", alt: "...", caption: "..."}]. Must be array type (validated by CHECK constraint).';


--
-- Name: COLUMN "products"."average_rating"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."average_rating" IS 'Average customer rating (0.00-5.00). Initially 0.00, will be calculated automatically by trigger when reviews table is implemented.';


--
-- Name: COLUMN "products"."review_count"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."review_count" IS 'Total number of approved reviews. Initially 0, will be calculated automatically by trigger when reviews table is implemented.';


--
-- Name: COLUMN "products"."detail_title"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."detail_title" IS 'Main h1 title for detail page (shorter, punchier) - if NULL, falls back to title';


--
-- Name: COLUMN "products"."hero_subtitle"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."hero_subtitle" IS 'h2 subtitle/tagline on detail page hero section - displayed below h1';


--
-- Name: COLUMN "products"."hero_line_1"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."hero_line_1" IS 'Hero line 1 (bold green) - emphasized question or statement';


--
-- Name: COLUMN "products"."hero_line_2"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."hero_line_2" IS 'Hero line 2 (normal text) - descriptive answer or detail';


--
-- Name: COLUMN "products"."hero_line_3"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."hero_line_3" IS 'Hero line 3 (bold green) - emphasized question or statement';


--
-- Name: COLUMN "products"."hero_line_4"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."hero_line_4" IS 'Hero line 4 (normal text) - descriptive answer or detail';


--
-- Name: COLUMN "products"."total_sales"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."total_sales" IS 'Total number of sales (sum of order_items.quantity for COMPLETED orders only). Automatically updated by triggers on order_items and orders tables.';


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_roles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'user'::"text"])))
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";

--
-- Name: TABLE "user_roles"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."user_roles" IS 'User roles for RBAC - roles are added to JWT via custom_access_token_hook. NOTE: After role change, user must sign out and sign in again to get updated JWT claims.';


--
-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id");


--
-- Name: blog_posts blog_posts_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_slug_key" UNIQUE ("slug");


--
-- Name: blog_tags blog_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."blog_tags"
    ADD CONSTRAINT "blog_tags_pkey" PRIMARY KEY ("id");


--
-- Name: blog_tags blog_tags_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."blog_tags"
    ADD CONSTRAINT "blog_tags_slug_key" UNIQUE ("slug");


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_slug_key" UNIQUE ("slug");


--
-- Name: contact_messages contact_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."contact_messages"
    ADD CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id");


--
-- Name: csp_reports csp_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."csp_reports"
    ADD CONSTRAINT "csp_reports_pkey" PRIMARY KEY ("id");


--
-- Name: custom_itinerary_requests custom_itinerary_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."custom_itinerary_requests"
    ADD CONSTRAINT "custom_itinerary_requests_pkey" PRIMARY KEY ("id");


--
-- Name: customers customers_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_email_key" UNIQUE ("email");


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");


--
-- Name: download_tokens download_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."download_tokens"
    ADD CONSTRAINT "download_tokens_pkey" PRIMARY KEY ("id");


--
-- Name: download_tokens download_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."download_tokens"
    ADD CONSTRAINT "download_tokens_token_key" UNIQUE ("token");


--
-- Name: email_events email_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."email_events"
    ADD CONSTRAINT "email_events_pkey" PRIMARY KEY ("id");


--
-- Name: email_events email_events_resend_email_id_event_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."email_events"
    ADD CONSTRAINT "email_events_resend_email_id_event_type_key" UNIQUE ("resend_email_id", "event_type");


--
-- Name: email_suppressions email_suppressions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."email_suppressions"
    ADD CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("email");


--
-- Name: fakturoid_tokens fakturoid_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."fakturoid_tokens"
    ADD CONSTRAINT "fakturoid_tokens_pkey" PRIMARY KEY ("id");


--
-- Name: integration_logs integration_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."integration_logs"
    ADD CONSTRAINT "integration_logs_pkey" PRIMARY KEY ("id");


--
-- Name: newsletter_consent_log newsletter_consent_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."newsletter_consent_log"
    ADD CONSTRAINT "newsletter_consent_log_pkey" PRIMARY KEY ("id");


--
-- Name: order_items order_items_order_product_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_product_unique" UNIQUE ("order_id", "product_id");


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");


--
-- Name: orders orders_stripe_payment_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_stripe_payment_id_key" UNIQUE ("stripe_payment_id");


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");


--
-- Name: idx_blog_posts_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_blog_posts_created_at" ON "public"."blog_posts" USING "btree" ("created_at" DESC);


--
-- Name: idx_blog_posts_published_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_blog_posts_published_at" ON "public"."blog_posts" USING "btree" ("published_at" DESC NULLS LAST);


--
-- Name: idx_blog_posts_tag_ids; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_blog_posts_tag_ids" ON "public"."blog_posts" USING "gin" ("tag_ids");


--
-- Name: idx_contact_messages_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_contact_messages_created_at" ON "public"."contact_messages" USING "btree" ("created_at" DESC);


--
-- Name: idx_contact_messages_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_contact_messages_status" ON "public"."contact_messages" USING "btree" ("status");


--
-- Name: idx_csp_reports_disposition_directive_received_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_csp_reports_disposition_directive_received_at" ON "public"."csp_reports" USING "btree" ("disposition", "effective_directive", "received_at" DESC);


--
-- Name: idx_csp_reports_received_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_csp_reports_received_at" ON "public"."csp_reports" USING "btree" ("received_at" DESC);


--
-- Name: idx_custom_requests_auth_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_custom_requests_auth_user_id" ON "public"."custom_itinerary_requests" USING "btree" ("auth_user_id");


--
-- Name: idx_custom_requests_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_custom_requests_created_at" ON "public"."custom_itinerary_requests" USING "btree" ("created_at" DESC);


--
-- Name: idx_custom_requests_customer_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_custom_requests_customer_email" ON "public"."custom_itinerary_requests" USING "btree" ("customer_email");


--
-- Name: idx_custom_requests_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_custom_requests_customer_id" ON "public"."custom_itinerary_requests" USING "btree" ("customer_id");


--
-- Name: idx_custom_requests_delivery_email_unsent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_custom_requests_delivery_email_unsent" ON "public"."custom_itinerary_requests" USING "btree" ("created_at" DESC) WHERE (("delivery_email_sent_at" IS NULL) AND ("final_pdf_url" IS NOT NULL));


--
-- Name: idx_custom_requests_form_data; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_custom_requests_form_data" ON "public"."custom_itinerary_requests" USING "gin" ("form_data");


--
-- Name: idx_custom_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_custom_requests_status" ON "public"."custom_itinerary_requests" USING "btree" ("status");


--
-- Name: idx_customers_last_purchase_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_customers_last_purchase_at" ON "public"."customers" USING "btree" ("last_purchase_at" DESC);


--
-- Name: idx_download_tokens_asset_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_download_tokens_asset_type" ON "public"."download_tokens" USING "btree" ("asset_type");


--
-- Name: idx_download_tokens_custom_request_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_download_tokens_custom_request_id" ON "public"."download_tokens" USING "btree" ("custom_itinerary_request_id") WHERE ("custom_itinerary_request_id" IS NOT NULL);


--
-- Name: idx_download_tokens_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_download_tokens_order_id" ON "public"."download_tokens" USING "btree" ("order_id");


--
-- Name: idx_email_events_to_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_email_events_to_created" ON "public"."email_events" USING "btree" ("email_to", "created_at" DESC);


--
-- Name: idx_integration_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_integration_logs_created_at" ON "public"."integration_logs" USING "btree" ("created_at" DESC);


--
-- Name: idx_integration_logs_metadata; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_integration_logs_metadata" ON "public"."integration_logs" USING "gin" ("metadata");


--
-- Name: idx_integration_logs_service; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_integration_logs_service" ON "public"."integration_logs" USING "btree" ("service");


--
-- Name: idx_integration_logs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_integration_logs_status" ON "public"."integration_logs" USING "btree" ("status");


--
-- Name: idx_newsletter_consent_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_newsletter_consent_active" ON "public"."newsletter_consent_log" USING "btree" ("email", "created_at" DESC) WHERE ("consent_given" = true);


--
-- Name: INDEX "idx_newsletter_consent_active"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON INDEX "public"."idx_newsletter_consent_active" IS 'Partial index for active newsletter subscribers (consent_given = true). Optimizes queries for opt-in status.';


--
-- Name: idx_newsletter_consent_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_newsletter_consent_created_at" ON "public"."newsletter_consent_log" USING "btree" ("created_at" DESC);


--
-- Name: idx_newsletter_consent_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_newsletter_consent_email" ON "public"."newsletter_consent_log" USING "btree" ("email");


--
-- Name: idx_order_items_custom_request_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_order_items_custom_request_id" ON "public"."order_items" USING "btree" ("custom_itinerary_request_id") WHERE ("custom_itinerary_request_id" IS NOT NULL);


--
-- Name: idx_order_items_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_order_items_order_id" ON "public"."order_items" USING "btree" ("order_id");


--
-- Name: idx_order_items_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_order_items_product_id" ON "public"."order_items" USING "btree" ("product_id");


--
-- Name: idx_orders_auth_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_orders_auth_user_id" ON "public"."orders" USING "btree" ("auth_user_id");


--
-- Name: idx_orders_confirmation_email_unsent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_orders_confirmation_email_unsent" ON "public"."orders" USING "btree" ("created_at" DESC) WHERE ("confirmation_email_sent_at" IS NULL);


--
-- Name: idx_orders_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_orders_created_at" ON "public"."orders" USING "btree" ("created_at" DESC);


--
-- Name: idx_orders_customer_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_orders_customer_email" ON "public"."orders" USING "btree" ("customer_email");


--
-- Name: idx_orders_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_orders_customer_id" ON "public"."orders" USING "btree" ("customer_id");


--
-- Name: idx_orders_invoice_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_orders_invoice_status" ON "public"."orders" USING "btree" ("facturoid_invoice_id", "invoice_sent", "invoice_error") WHERE (("facturoid_invoice_id" IS NULL) OR ("invoice_error" IS NOT NULL));


--
-- Name: idx_orders_pending; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_orders_pending" ON "public"."orders" USING "btree" ("created_at" DESC) WHERE ("status" = 'pending'::"text");


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");


--
-- Name: idx_products_average_rating; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_products_average_rating" ON "public"."products" USING "btree" ("average_rating" DESC);


--
-- Name: idx_products_category_ids; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_products_category_ids" ON "public"."products" USING "gin" ("category_ids");


--
-- Name: idx_products_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_products_created_at" ON "public"."products" USING "btree" ("created_at" DESC);


--
-- Name: idx_products_deleted_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_products_deleted_at" ON "public"."products" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NOT NULL);


--
-- Name: idx_products_gallery_images; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_products_gallery_images" ON "public"."products" USING "gin" ("gallery_images");


--
-- Name: idx_products_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_products_is_active" ON "public"."products" USING "btree" ("is_active") WHERE ("is_active" = true);


--
-- Name: idx_products_is_deleted; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_products_is_deleted" ON "public"."products" USING "btree" ("is_deleted") WHERE ("is_deleted" = false);


--
-- Name: idx_products_quiz_data; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_products_quiz_data" ON "public"."products" USING "gin" ("quiz_data");


--
-- Name: idx_products_slug_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "idx_products_slug_unique" ON "public"."products" USING "btree" ("slug") WHERE ("is_deleted" = false);


--
-- Name: idx_products_stripe_price_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_products_stripe_price_id" ON "public"."products" USING "btree" ("stripe_price_id");


--
-- Name: idx_products_stripe_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_products_stripe_product_id" ON "public"."products" USING "btree" ("stripe_product_id");


--
-- Name: idx_products_total_sales; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_products_total_sales" ON "public"."products" USING "btree" ("total_sales" DESC);


--
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_user_roles_user_id" ON "public"."user_roles" USING "btree" ("user_id");


--
-- Name: blog_posts handle_blog_posts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "handle_blog_posts_updated_at" BEFORE UPDATE ON "public"."blog_posts" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');


--
-- Name: categories handle_categories_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "handle_categories_updated_at" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');


--
-- Name: contact_messages handle_contact_messages_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "handle_contact_messages_updated_at" BEFORE UPDATE ON "public"."contact_messages" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');


--
-- Name: custom_itinerary_requests handle_custom_requests_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "handle_custom_requests_updated_at" BEFORE UPDATE ON "public"."custom_itinerary_requests" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');


--
-- Name: customers handle_customers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "handle_customers_updated_at" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');


--
-- Name: orders handle_orders_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "handle_orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');


--
-- Name: products handle_products_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "handle_products_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "extensions"."moddatetime"('updated_at');


--
-- Name: customers on_customer_created; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "on_customer_created" AFTER INSERT ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."link_requests_to_customer"();


--
-- Name: customers on_customer_created_link_orders; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "on_customer_created_link_orders" AFTER INSERT ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."link_orders_to_customer"();


--
-- Name: blog_posts trg_blog_publish_deploy; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "trg_blog_publish_deploy" AFTER INSERT OR DELETE OR UPDATE ON "public"."blog_posts" FOR EACH ROW EXECUTE FUNCTION "public"."notify_vercel_blog_publish"();


--
-- Name: order_items update_total_sales_on_order_item_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "update_total_sales_on_order_item_change" AFTER INSERT OR DELETE OR UPDATE ON "public"."order_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_product_total_sales"();


--
-- Name: orders update_total_sales_on_order_status_change; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "update_total_sales_on_order_status_change" AFTER UPDATE OF "status" ON "public"."orders" FOR EACH ROW WHEN (("old"."status" IS DISTINCT FROM "new"."status")) EXECUTE FUNCTION "public"."update_all_products_in_order"();


--
-- Name: custom_itinerary_requests custom_itinerary_requests_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."custom_itinerary_requests"
    ADD CONSTRAINT "custom_itinerary_requests_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: custom_itinerary_requests custom_itinerary_requests_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."custom_itinerary_requests"
    ADD CONSTRAINT "custom_itinerary_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;


--
-- Name: download_tokens download_tokens_custom_itinerary_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."download_tokens"
    ADD CONSTRAINT "download_tokens_custom_itinerary_request_id_fkey" FOREIGN KEY ("custom_itinerary_request_id") REFERENCES "public"."custom_itinerary_requests"("id") ON DELETE CASCADE;


--
-- Name: download_tokens download_tokens_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."download_tokens"
    ADD CONSTRAINT "download_tokens_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;


--
-- Name: customers fk_customers_auth_users; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "fk_customers_auth_users" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: order_items order_items_custom_itinerary_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_custom_itinerary_request_id_fkey" FOREIGN KEY ("custom_itinerary_request_id") REFERENCES "public"."custom_itinerary_requests"("id") ON DELETE SET NULL;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;


--
-- Name: orders orders_auth_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: order_items Admins can delete order_items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete order_items" ON "public"."order_items" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: orders Admins can delete orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete orders" ON "public"."orders" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: custom_itinerary_requests Admins can delete requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete requests" ON "public"."custom_itinerary_requests" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: order_items Admins can update order_items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update order_items" ON "public"."order_items" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: orders Admins can update orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update orders" ON "public"."orders" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: order_items Users and admins can insert order_items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users and admins can insert order_items" ON "public"."order_items" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."id" = "order_items"."order_id") AND ("orders"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR ( SELECT "public"."is_admin"() AS "is_admin")));


--
-- Name: orders Users and admins can insert orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users and admins can insert orders" ON "public"."orders" FOR INSERT TO "authenticated" WITH CHECK (((("auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("customer_email" IS NOT NULL) AND ("total_amount" >= (0)::numeric)) OR ( SELECT "public"."is_admin"() AS "is_admin")));


--
-- Name: custom_itinerary_requests Users and admins can insert requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users and admins can insert requests" ON "public"."custom_itinerary_requests" FOR INSERT TO "authenticated" WITH CHECK ((("auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_admin"() AS "is_admin")));


--
-- Name: order_items Users and admins can select order_items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users and admins can select order_items" ON "public"."order_items" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."id" = "order_items"."order_id") AND ("orders"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR ( SELECT "public"."is_admin"() AS "is_admin")));


--
-- Name: orders Users and admins can select orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users and admins can select orders" ON "public"."orders" FOR SELECT TO "authenticated" USING ((("auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_admin"() AS "is_admin")));


--
-- Name: custom_itinerary_requests Users and admins can select requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users and admins can select requests" ON "public"."custom_itinerary_requests" FOR SELECT TO "authenticated" USING ((("auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_admin"() AS "is_admin")));


--
-- Name: custom_itinerary_requests Users and admins can update requests; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users and admins can update requests" ON "public"."custom_itinerary_requests" FOR UPDATE TO "authenticated" USING ((("auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_admin"() AS "is_admin"))) WITH CHECK (((("auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ( SELECT "public"."is_permanent_user"() AS "is_permanent_user")) OR ( SELECT "public"."is_admin"() AS "is_admin")));


--
-- Name: user_roles auth_admin_read_user_roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "auth_admin_read_user_roles" ON "public"."user_roles" FOR SELECT TO "supabase_auth_admin" USING (true);


--
-- Name: blog_posts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."blog_posts" ENABLE ROW LEVEL SECURITY;

--
-- Name: blog_posts blog_posts_admin_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "blog_posts_admin_delete" ON "public"."blog_posts" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: blog_posts blog_posts_admin_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "blog_posts_admin_insert" ON "public"."blog_posts" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: blog_posts blog_posts_admin_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "blog_posts_admin_update" ON "public"."blog_posts" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: blog_posts blog_posts_authenticated_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "blog_posts_authenticated_select" ON "public"."blog_posts" FOR SELECT TO "authenticated" USING ((("published_at" IS NOT NULL) OR ( SELECT "public"."is_admin"() AS "is_admin")));


--
-- Name: blog_posts blog_posts_public_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "blog_posts_public_select" ON "public"."blog_posts" FOR SELECT TO "anon" USING (("published_at" IS NOT NULL));


--
-- Name: POLICY "blog_posts_public_select" ON "blog_posts"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON POLICY "blog_posts_public_select" ON "public"."blog_posts" IS 'Anonymous users can read published posts only';


--
-- Name: blog_tags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."blog_tags" ENABLE ROW LEVEL SECURITY;

--
-- Name: blog_tags blog_tags_admin_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "blog_tags_admin_delete" ON "public"."blog_tags" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: blog_tags blog_tags_admin_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "blog_tags_admin_insert" ON "public"."blog_tags" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: blog_tags blog_tags_admin_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "blog_tags_admin_update" ON "public"."blog_tags" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: blog_tags blog_tags_public_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "blog_tags_public_read" ON "public"."blog_tags" FOR SELECT TO "authenticated", "anon" USING (true);


--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;

--
-- Name: categories categories_admin_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "categories_admin_delete" ON "public"."categories" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: categories categories_admin_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "categories_admin_insert" ON "public"."categories" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: categories categories_admin_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "categories_admin_update" ON "public"."categories" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: categories categories_public_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "categories_public_select" ON "public"."categories" FOR SELECT TO "authenticated", "anon" USING (true);


--
-- Name: POLICY "categories_public_select" ON "categories"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON POLICY "categories_public_select" ON "public"."categories" IS 'Allow public read access for filtering and SEO';


--
-- Name: contact_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."contact_messages" ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_messages contact_messages_admin_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "contact_messages_admin_delete" ON "public"."contact_messages" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: contact_messages contact_messages_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "contact_messages_admin_select" ON "public"."contact_messages" FOR SELECT TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: contact_messages contact_messages_admin_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "contact_messages_admin_update" ON "public"."contact_messages" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: csp_reports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."csp_reports" ENABLE ROW LEVEL SECURITY;

--
-- Name: csp_reports csp_reports_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "csp_reports_admin_select" ON "public"."csp_reports" FOR SELECT TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: custom_itinerary_requests; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."custom_itinerary_requests" ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;

--
-- Name: customers customers_admin_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "customers_admin_delete" ON "public"."customers" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: customers customers_admin_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "customers_admin_insert" ON "public"."customers" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: customers customers_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "customers_admin_select" ON "public"."customers" FOR SELECT TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: customers customers_admin_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "customers_admin_update" ON "public"."customers" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: download_tokens; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."download_tokens" ENABLE ROW LEVEL SECURITY;

--
-- Name: download_tokens download_tokens_admin_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "download_tokens_admin_delete" ON "public"."download_tokens" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: download_tokens download_tokens_admin_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "download_tokens_admin_insert" ON "public"."download_tokens" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: POLICY "download_tokens_admin_insert" ON "download_tokens"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON POLICY "download_tokens_admin_insert" ON "public"."download_tokens" IS 'Admins can manually create tokens (e.g., resend download link)';


--
-- Name: email_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."email_events" ENABLE ROW LEVEL SECURITY;

--
-- Name: email_events email_events_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "email_events_admin_select" ON "public"."email_events" FOR SELECT TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: email_suppressions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."email_suppressions" ENABLE ROW LEVEL SECURITY;

--
-- Name: email_suppressions email_suppressions_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "email_suppressions_admin_select" ON "public"."email_suppressions" FOR SELECT TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: fakturoid_tokens; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."fakturoid_tokens" ENABLE ROW LEVEL SECURITY;

--
-- Name: integration_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."integration_logs" ENABLE ROW LEVEL SECURITY;

--
-- Name: integration_logs integration_logs_admin_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "integration_logs_admin_delete" ON "public"."integration_logs" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: integration_logs integration_logs_admin_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "integration_logs_admin_insert" ON "public"."integration_logs" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: POLICY "integration_logs_admin_insert" ON "integration_logs"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON POLICY "integration_logs_admin_insert" ON "public"."integration_logs" IS 'Admins can manually create logs (e.g., debugging)';


--
-- Name: integration_logs integration_logs_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "integration_logs_admin_select" ON "public"."integration_logs" FOR SELECT TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: newsletter_consent_log newsletter_consent_admin_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "newsletter_consent_admin_select" ON "public"."newsletter_consent_log" FOR SELECT TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: newsletter_consent_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."newsletter_consent_log" ENABLE ROW LEVEL SECURITY;

--
-- Name: newsletter_consent_log newsletter_consent_public_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "newsletter_consent_public_insert" ON "public"."newsletter_consent_log" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("email" IS NOT NULL) AND ("consent_given" IS NOT NULL) AND ("source" IS NOT NULL)));


--
-- Name: POLICY "newsletter_consent_public_insert" ON "newsletter_consent_log"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON POLICY "newsletter_consent_public_insert" ON "public"."newsletter_consent_log" IS 'Allow public to log consent events. Validates required fields (email, consent_given, source). Updated in migration 028 for defense in depth.';


--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;

--
-- Name: products products_admin_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "products_admin_delete" ON "public"."products" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: products products_admin_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "products_admin_insert" ON "public"."products" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: POLICY "products_admin_insert" ON "products"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON POLICY "products_admin_insert" ON "public"."products" IS 'Only admins can create products';


--
-- Name: products products_admin_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "products_admin_update" ON "public"."products" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: products products_public_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "products_public_select" ON "public"."products" FOR SELECT TO "authenticated", "anon" USING (("is_deleted" = false));


--
-- Name: POLICY "products_public_select" ON "products"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON POLICY "products_public_select" ON "public"."products" IS 'Public read access to active products only (is_deleted = false). Updated in migration 028 for defense in depth.';


--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles user_roles_admin_delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "user_roles_admin_delete" ON "public"."user_roles" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: user_roles user_roles_admin_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "user_roles_admin_insert" ON "public"."user_roles" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: user_roles user_roles_admin_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "user_roles_admin_update" ON "public"."user_roles" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: user_roles user_roles_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "user_roles_select" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_admin"() AS "is_admin")));


--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: postgres
--

-- CREATE PUBLICATION "supabase_realtime" WITH (publish = 'insert, update, delete, truncate');


ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

--
-- Name: SCHEMA "net"; Type: ACL; Schema: -; Owner: supabase_admin
--

-- GRANT USAGE ON SCHEMA "net" TO "supabase_functions_admin";
-- GRANT USAGE ON SCHEMA "net" TO "postgres";
-- GRANT USAGE ON SCHEMA "net" TO "anon";
-- GRANT USAGE ON SCHEMA "net" TO "authenticated";
-- GRANT USAGE ON SCHEMA "net" TO "service_role";


--
-- Name: SCHEMA "public"; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "supabase_auth_admin";


--
-- Name: FUNCTION "armor"("bytea"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."armor"("bytea") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."armor"("bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."armor"("bytea") TO "dashboard_user";


--
-- Name: FUNCTION "armor"("bytea", "text"[], "text"[]); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."armor"("bytea", "text"[], "text"[]) FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."armor"("bytea", "text"[], "text"[]) TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."armor"("bytea", "text"[], "text"[]) TO "dashboard_user";


--
-- Name: FUNCTION "crypt"("text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."crypt"("text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."crypt"("text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."crypt"("text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "dearmor"("text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."dearmor"("text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."dearmor"("text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."dearmor"("text") TO "dashboard_user";


--
-- Name: FUNCTION "decrypt"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."decrypt"("bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."decrypt"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."decrypt"("bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "decrypt_iv"("bytea", "bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."decrypt_iv"("bytea", "bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."decrypt_iv"("bytea", "bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."decrypt_iv"("bytea", "bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "digest"("bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."digest"("bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."digest"("bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."digest"("bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "digest"("text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."digest"("text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."digest"("text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."digest"("text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "encrypt"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."encrypt"("bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."encrypt"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."encrypt"("bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "encrypt_iv"("bytea", "bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."encrypt_iv"("bytea", "bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."encrypt_iv"("bytea", "bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."encrypt_iv"("bytea", "bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "gen_random_bytes"(integer); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."gen_random_bytes"(integer) FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."gen_random_bytes"(integer) TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."gen_random_bytes"(integer) TO "dashboard_user";


--
-- Name: FUNCTION "gen_random_uuid"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."gen_random_uuid"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."gen_random_uuid"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."gen_random_uuid"() TO "dashboard_user";


--
-- Name: FUNCTION "gen_salt"("text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."gen_salt"("text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."gen_salt"("text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."gen_salt"("text") TO "dashboard_user";


--
-- Name: FUNCTION "gen_salt"("text", integer); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."gen_salt"("text", integer) FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."gen_salt"("text", integer) TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."gen_salt"("text", integer) TO "dashboard_user";


--
-- Name: FUNCTION "hmac"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."hmac"("bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."hmac"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."hmac"("bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "hmac"("text", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."hmac"("text", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."hmac"("text", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."hmac"("text", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "moddatetime"(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."moddatetime"() TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pg_stat_statements"("showtext" boolean, OUT "userid" "oid", OUT "dbid" "oid", OUT "toplevel" boolean, OUT "queryid" bigint, OUT "query" "text", OUT "plans" bigint, OUT "total_plan_time" double precision, OUT "min_plan_time" double precision, OUT "max_plan_time" double precision, OUT "mean_plan_time" double precision, OUT "stddev_plan_time" double precision, OUT "calls" bigint, OUT "total_exec_time" double precision, OUT "min_exec_time" double precision, OUT "max_exec_time" double precision, OUT "mean_exec_time" double precision, OUT "stddev_exec_time" double precision, OUT "rows" bigint, OUT "shared_blks_hit" bigint, OUT "shared_blks_read" bigint, OUT "shared_blks_dirtied" bigint, OUT "shared_blks_written" bigint, OUT "local_blks_hit" bigint, OUT "local_blks_read" bigint, OUT "local_blks_dirtied" bigint, OUT "local_blks_written" bigint, OUT "temp_blks_read" bigint, OUT "temp_blks_written" bigint, OUT "shared_blk_read_time" double precision, OUT "shared_blk_write_time" double precision, OUT "local_blk_read_time" double precision, OUT "local_blk_write_time" double precision, OUT "temp_blk_read_time" double precision, OUT "temp_blk_write_time" double precision, OUT "wal_records" bigint, OUT "wal_fpi" bigint, OUT "wal_bytes" numeric, OUT "jit_functions" bigint, OUT "jit_generation_time" double precision, OUT "jit_inlining_count" bigint, OUT "jit_inlining_time" double precision, OUT "jit_optimization_count" bigint, OUT "jit_optimization_time" double precision, OUT "jit_emission_count" bigint, OUT "jit_emission_time" double precision, OUT "jit_deform_count" bigint, OUT "jit_deform_time" double precision, OUT "stats_since" timestamp with time zone, OUT "minmax_stats_since" timestamp with time zone); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pg_stat_statements"("showtext" boolean, OUT "userid" "oid", OUT "dbid" "oid", OUT "toplevel" boolean, OUT "queryid" bigint, OUT "query" "text", OUT "plans" bigint, OUT "total_plan_time" double precision, OUT "min_plan_time" double precision, OUT "max_plan_time" double precision, OUT "mean_plan_time" double precision, OUT "stddev_plan_time" double precision, OUT "calls" bigint, OUT "total_exec_time" double precision, OUT "min_exec_time" double precision, OUT "max_exec_time" double precision, OUT "mean_exec_time" double precision, OUT "stddev_exec_time" double precision, OUT "rows" bigint, OUT "shared_blks_hit" bigint, OUT "shared_blks_read" bigint, OUT "shared_blks_dirtied" bigint, OUT "shared_blks_written" bigint, OUT "local_blks_hit" bigint, OUT "local_blks_read" bigint, OUT "local_blks_dirtied" bigint, OUT "local_blks_written" bigint, OUT "temp_blks_read" bigint, OUT "temp_blks_written" bigint, OUT "shared_blk_read_time" double precision, OUT "shared_blk_write_time" double precision, OUT "local_blk_read_time" double precision, OUT "local_blk_write_time" double precision, OUT "temp_blk_read_time" double precision, OUT "temp_blk_write_time" double precision, OUT "wal_records" bigint, OUT "wal_fpi" bigint, OUT "wal_bytes" numeric, OUT "jit_functions" bigint, OUT "jit_generation_time" double precision, OUT "jit_inlining_count" bigint, OUT "jit_inlining_time" double precision, OUT "jit_optimization_count" bigint, OUT "jit_optimization_time" double precision, OUT "jit_emission_count" bigint, OUT "jit_emission_time" double precision, OUT "jit_deform_count" bigint, OUT "jit_deform_time" double precision, OUT "stats_since" timestamp with time zone, OUT "minmax_stats_since" timestamp with time zone) FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements"("showtext" boolean, OUT "userid" "oid", OUT "dbid" "oid", OUT "toplevel" boolean, OUT "queryid" bigint, OUT "query" "text", OUT "plans" bigint, OUT "total_plan_time" double precision, OUT "min_plan_time" double precision, OUT "max_plan_time" double precision, OUT "mean_plan_time" double precision, OUT "stddev_plan_time" double precision, OUT "calls" bigint, OUT "total_exec_time" double precision, OUT "min_exec_time" double precision, OUT "max_exec_time" double precision, OUT "mean_exec_time" double precision, OUT "stddev_exec_time" double precision, OUT "rows" bigint, OUT "shared_blks_hit" bigint, OUT "shared_blks_read" bigint, OUT "shared_blks_dirtied" bigint, OUT "shared_blks_written" bigint, OUT "local_blks_hit" bigint, OUT "local_blks_read" bigint, OUT "local_blks_dirtied" bigint, OUT "local_blks_written" bigint, OUT "temp_blks_read" bigint, OUT "temp_blks_written" bigint, OUT "shared_blk_read_time" double precision, OUT "shared_blk_write_time" double precision, OUT "local_blk_read_time" double precision, OUT "local_blk_write_time" double precision, OUT "temp_blk_read_time" double precision, OUT "temp_blk_write_time" double precision, OUT "wal_records" bigint, OUT "wal_fpi" bigint, OUT "wal_bytes" numeric, OUT "jit_functions" bigint, OUT "jit_generation_time" double precision, OUT "jit_inlining_count" bigint, OUT "jit_inlining_time" double precision, OUT "jit_optimization_count" bigint, OUT "jit_optimization_time" double precision, OUT "jit_emission_count" bigint, OUT "jit_emission_time" double precision, OUT "jit_deform_count" bigint, OUT "jit_deform_time" double precision, OUT "stats_since" timestamp with time zone, OUT "minmax_stats_since" timestamp with time zone) TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements"("showtext" boolean, OUT "userid" "oid", OUT "dbid" "oid", OUT "toplevel" boolean, OUT "queryid" bigint, OUT "query" "text", OUT "plans" bigint, OUT "total_plan_time" double precision, OUT "min_plan_time" double precision, OUT "max_plan_time" double precision, OUT "mean_plan_time" double precision, OUT "stddev_plan_time" double precision, OUT "calls" bigint, OUT "total_exec_time" double precision, OUT "min_exec_time" double precision, OUT "max_exec_time" double precision, OUT "mean_exec_time" double precision, OUT "stddev_exec_time" double precision, OUT "rows" bigint, OUT "shared_blks_hit" bigint, OUT "shared_blks_read" bigint, OUT "shared_blks_dirtied" bigint, OUT "shared_blks_written" bigint, OUT "local_blks_hit" bigint, OUT "local_blks_read" bigint, OUT "local_blks_dirtied" bigint, OUT "local_blks_written" bigint, OUT "temp_blks_read" bigint, OUT "temp_blks_written" bigint, OUT "shared_blk_read_time" double precision, OUT "shared_blk_write_time" double precision, OUT "local_blk_read_time" double precision, OUT "local_blk_write_time" double precision, OUT "temp_blk_read_time" double precision, OUT "temp_blk_write_time" double precision, OUT "wal_records" bigint, OUT "wal_fpi" bigint, OUT "wal_bytes" numeric, OUT "jit_functions" bigint, OUT "jit_generation_time" double precision, OUT "jit_inlining_count" bigint, OUT "jit_inlining_time" double precision, OUT "jit_optimization_count" bigint, OUT "jit_optimization_time" double precision, OUT "jit_emission_count" bigint, OUT "jit_emission_time" double precision, OUT "jit_deform_count" bigint, OUT "jit_deform_time" double precision, OUT "stats_since" timestamp with time zone, OUT "minmax_stats_since" timestamp with time zone) TO "dashboard_user";


--
-- Name: FUNCTION "pg_stat_statements_info"(OUT "dealloc" bigint, OUT "stats_reset" timestamp with time zone); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pg_stat_statements_info"(OUT "dealloc" bigint, OUT "stats_reset" timestamp with time zone) FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements_info"(OUT "dealloc" bigint, OUT "stats_reset" timestamp with time zone) TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements_info"(OUT "dealloc" bigint, OUT "stats_reset" timestamp with time zone) TO "dashboard_user";


--
-- Name: FUNCTION "pg_stat_statements_reset"("userid" "oid", "dbid" "oid", "queryid" bigint, "minmax_only" boolean); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pg_stat_statements_reset"("userid" "oid", "dbid" "oid", "queryid" bigint, "minmax_only" boolean) FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements_reset"("userid" "oid", "dbid" "oid", "queryid" bigint, "minmax_only" boolean) TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements_reset"("userid" "oid", "dbid" "oid", "queryid" bigint, "minmax_only" boolean) TO "dashboard_user";


--
-- Name: FUNCTION "pgp_armor_headers"("text", OUT "key" "text", OUT "value" "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_armor_headers"("text", OUT "key" "text", OUT "value" "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_armor_headers"("text", OUT "key" "text", OUT "value" "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_armor_headers"("text", OUT "key" "text", OUT "value" "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_key_id"("bytea"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_key_id"("bytea") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_key_id"("bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_key_id"("bytea") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_decrypt"("bytea", "bytea"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_decrypt"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_decrypt"("bytea", "bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_decrypt_bytea"("bytea", "bytea"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_decrypt_bytea"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_decrypt_bytea"("bytea", "bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_encrypt"("text", "bytea"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_encrypt"("text", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_encrypt_bytea"("bytea", "bytea"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_pub_encrypt_bytea"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_decrypt"("bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_decrypt"("bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_decrypt_bytea"("bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_decrypt_bytea"("bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_encrypt"("text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_encrypt"("text", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_encrypt_bytea"("bytea", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text") TO "dashboard_user";


--
-- Name: FUNCTION "pgp_sym_encrypt_bytea"("bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text", "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text", "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text", "text") TO "dashboard_user";


--
-- Name: FUNCTION "uuid_generate_v1"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_generate_v1"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v1"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v1"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_generate_v1mc"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_generate_v1mc"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v1mc"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v1mc"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_generate_v3"("namespace" "uuid", "name" "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_generate_v3"("namespace" "uuid", "name" "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v3"("namespace" "uuid", "name" "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v3"("namespace" "uuid", "name" "text") TO "dashboard_user";


--
-- Name: FUNCTION "uuid_generate_v4"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_generate_v4"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v4"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v4"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_generate_v5"("namespace" "uuid", "name" "text"); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_generate_v5"("namespace" "uuid", "name" "text") FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v5"("namespace" "uuid", "name" "text") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v5"("namespace" "uuid", "name" "text") TO "dashboard_user";


--
-- Name: FUNCTION "uuid_nil"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_nil"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_nil"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_nil"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_ns_dns"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_ns_dns"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_dns"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_dns"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_ns_oid"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_ns_oid"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_oid"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_oid"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_ns_url"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_ns_url"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_url"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_url"() TO "dashboard_user";


--
-- Name: FUNCTION "uuid_ns_x500"(); Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON FUNCTION "extensions"."uuid_ns_x500"() FROM "postgres";
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_x500"() TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_x500"() TO "dashboard_user";


--
-- Name: FUNCTION "cleanup_orphaned_anon_users"("retention_days" integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."cleanup_orphaned_anon_users"("retention_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_orphaned_anon_users"("retention_days" integer) TO "service_role";


--
-- Name: FUNCTION "create_order_with_items"("p_payload" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."create_order_with_items"("p_payload" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_order_with_items"("p_payload" "jsonb") TO "service_role";


--
-- Name: FUNCTION "custom_access_token_hook"("event" "jsonb"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."custom_access_token_hook"("event" "jsonb") TO "supabase_auth_admin";


--
-- Name: FUNCTION "handle_new_permanent_user"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."handle_new_permanent_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_permanent_user"() TO "service_role";


--
-- Name: FUNCTION "handle_user_email_update"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."handle_user_email_update"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_user_email_update"() TO "service_role";


--
-- Name: FUNCTION "increment_download_count"("token_id" "uuid"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."increment_download_count"("token_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_download_count"("token_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "increment_email_resend_count"("table_name" "text", "row_id" "uuid", "key" "text"); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."increment_email_resend_count"("table_name" "text", "row_id" "uuid", "key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_email_resend_count"("table_name" "text", "row_id" "uuid", "key" "text") TO "service_role";


--
-- Name: FUNCTION "is_admin"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";


--
-- Name: FUNCTION "is_permanent_user"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."is_permanent_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_permanent_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_permanent_user"() TO "service_role";


--
-- Name: FUNCTION "link_orders_to_customer"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."link_orders_to_customer"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."link_orders_to_customer"() TO "service_role";


--
-- Name: FUNCTION "link_requests_to_customer"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."link_requests_to_customer"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."link_requests_to_customer"() TO "service_role";


--
-- Name: FUNCTION "notify_vercel_blog_publish"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."notify_vercel_blog_publish"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_vercel_blog_publish"() TO "service_role";


--
-- Name: FUNCTION "update_all_products_in_order"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."update_all_products_in_order"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_all_products_in_order"() TO "service_role";


--
-- Name: FUNCTION "update_product_total_sales"(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION "public"."update_product_total_sales"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_product_total_sales"() TO "service_role";


--
-- Name: FUNCTION "_crypto_aead_det_decrypt"("message" "bytea", "additional" "bytea", "key_id" bigint, "context" "bytea", "nonce" "bytea"); Type: ACL; Schema: vault; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "vault"."_crypto_aead_det_decrypt"("message" "bytea", "additional" "bytea", "key_id" bigint, "context" "bytea", "nonce" "bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "vault"."_crypto_aead_det_decrypt"("message" "bytea", "additional" "bytea", "key_id" bigint, "context" "bytea", "nonce" "bytea") TO "service_role";


--
-- Name: FUNCTION "create_secret"("new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid"); Type: ACL; Schema: vault; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "vault"."create_secret"("new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "vault"."create_secret"("new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "update_secret"("secret_id" "uuid", "new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid"); Type: ACL; Schema: vault; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "vault"."update_secret"("secret_id" "uuid", "new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "vault"."update_secret"("secret_id" "uuid", "new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid") TO "service_role";


--
-- Name: TABLE "pg_stat_statements"; Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON TABLE "extensions"."pg_stat_statements" FROM "postgres";
-- GRANT ALL ON TABLE "extensions"."pg_stat_statements" TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON TABLE "extensions"."pg_stat_statements" TO "dashboard_user";


--
-- Name: TABLE "pg_stat_statements_info"; Type: ACL; Schema: extensions; Owner: postgres
--

-- REVOKE ALL ON TABLE "extensions"."pg_stat_statements_info" FROM "postgres";
-- GRANT ALL ON TABLE "extensions"."pg_stat_statements_info" TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON TABLE "extensions"."pg_stat_statements_info" TO "dashboard_user";


--
-- Name: TABLE "blog_posts"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."blog_posts" TO "anon";
GRANT ALL ON TABLE "public"."blog_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_posts" TO "service_role";


--
-- Name: TABLE "blog_tags"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."blog_tags" TO "anon";
GRANT ALL ON TABLE "public"."blog_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_tags" TO "service_role";


--
-- Name: TABLE "categories"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";


--
-- Name: TABLE "contact_messages"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."contact_messages" TO "anon";
GRANT ALL ON TABLE "public"."contact_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_messages" TO "service_role";


--
-- Name: TABLE "csp_reports"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."csp_reports" TO "anon";
GRANT ALL ON TABLE "public"."csp_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."csp_reports" TO "service_role";


--
-- Name: TABLE "custom_itinerary_requests"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."custom_itinerary_requests" TO "anon";
GRANT ALL ON TABLE "public"."custom_itinerary_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_itinerary_requests" TO "service_role";


--
-- Name: TABLE "customers"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";


--
-- Name: TABLE "download_tokens"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."download_tokens" TO "anon";
GRANT ALL ON TABLE "public"."download_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."download_tokens" TO "service_role";


--
-- Name: TABLE "email_events"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."email_events" TO "anon";
GRANT ALL ON TABLE "public"."email_events" TO "authenticated";
GRANT ALL ON TABLE "public"."email_events" TO "service_role";


--
-- Name: TABLE "email_suppressions"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."email_suppressions" TO "anon";
GRANT ALL ON TABLE "public"."email_suppressions" TO "authenticated";
GRANT ALL ON TABLE "public"."email_suppressions" TO "service_role";


--
-- Name: TABLE "fakturoid_tokens"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."fakturoid_tokens" TO "anon";
GRANT ALL ON TABLE "public"."fakturoid_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."fakturoid_tokens" TO "service_role";


--
-- Name: TABLE "integration_logs"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."integration_logs" TO "anon";
GRANT ALL ON TABLE "public"."integration_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_logs" TO "service_role";


--
-- Name: TABLE "newsletter_consent_log"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."newsletter_consent_log" TO "anon";
GRANT ALL ON TABLE "public"."newsletter_consent_log" TO "authenticated";
GRANT ALL ON TABLE "public"."newsletter_consent_log" TO "service_role";


--
-- Name: TABLE "order_items"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";


--
-- Name: TABLE "orders"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";


--
-- Name: TABLE "products"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";


--
-- Name: TABLE "user_roles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";
GRANT SELECT ON TABLE "public"."user_roles" TO "supabase_auth_admin";


--
-- Name: TABLE "secrets"; Type: ACL; Schema: vault; Owner: supabase_admin
--

-- GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE "vault"."secrets" TO "postgres" WITH GRANT OPTION;
-- GRANT SELECT,DELETE ON TABLE "vault"."secrets" TO "service_role";


--
-- Name: TABLE "decrypted_secrets"; Type: ACL; Schema: vault; Owner: supabase_admin
--

-- GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE "vault"."decrypted_secrets" TO "postgres" WITH GRANT OPTION;
-- GRANT SELECT,DELETE ON TABLE "vault"."decrypted_secrets" TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
-- ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "issue_graphql_placeholder" ON "sql_drop"
--          WHEN TAG IN ('DROP EXTENSION')
--    EXECUTE FUNCTION "extensions"."set_graphql_placeholder"();


-- ALTER EVENT TRIGGER "issue_graphql_placeholder" OWNER TO "supabase_admin";

--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "issue_pg_cron_access" ON "ddl_command_end"
--          WHEN TAG IN ('CREATE EXTENSION')
--    EXECUTE FUNCTION "extensions"."grant_pg_cron_access"();


-- ALTER EVENT TRIGGER "issue_pg_cron_access" OWNER TO "supabase_admin";

--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "issue_pg_graphql_access" ON "ddl_command_end"
--          WHEN TAG IN ('CREATE FUNCTION')
--    EXECUTE FUNCTION "extensions"."grant_pg_graphql_access"();


-- ALTER EVENT TRIGGER "issue_pg_graphql_access" OWNER TO "supabase_admin";

--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "issue_pg_net_access" ON "ddl_command_end"
--          WHEN TAG IN ('CREATE EXTENSION')
--    EXECUTE FUNCTION "extensions"."grant_pg_net_access"();


-- ALTER EVENT TRIGGER "issue_pg_net_access" OWNER TO "supabase_admin";

--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "pgrst_ddl_watch" ON "ddl_command_end"
--    EXECUTE FUNCTION "extensions"."pgrst_ddl_watch"();


-- ALTER EVENT TRIGGER "pgrst_ddl_watch" OWNER TO "supabase_admin";

--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "pgrst_drop_watch" ON "sql_drop"
--    EXECUTE FUNCTION "extensions"."pgrst_drop_watch"();


-- ALTER EVENT TRIGGER "pgrst_drop_watch" OWNER TO "supabase_admin";

--
-- PostgreSQL database dump complete
--

-- \unrestrict EmxEygOzBB4xiEeJ1qwyhDkraYQ16hYS2pXF6AH3s0iFE8KkU6g7satmVUTb4Cr


-- ============================================================
-- STORAGE OBJECT RLS POLICIES (storage schema is Supabase-managed; db dump
-- excludes it). RLS on storage.objects is enabled by Supabase init; buckets
-- are dashboard-managed (orig migration 003 was documentation-only). We only
-- recreate the user-defined object policies. (audit konsolidace 2026-06-04)
-- ============================================================
CREATE POLICY "blog_images_admin_delete" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'blog-images'::"text") AND ( SELECT "public"."is_admin"() AS "is_admin")));
CREATE POLICY "blog_images_admin_insert" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'blog-images'::"text") AND ( SELECT "public"."is_admin"() AS "is_admin")));
CREATE POLICY "blog_images_admin_select" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'blog-images'::"text") AND ( SELECT "public"."is_admin"() AS "is_admin")));
CREATE POLICY "blog_images_admin_update" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'blog-images'::"text") AND ( SELECT "public"."is_admin"() AS "is_admin"))) WITH CHECK ((("bucket_id" = 'blog-images'::"text") AND ( SELECT "public"."is_admin"() AS "is_admin")));
CREATE POLICY "custom_itinerary_pdfs_admin_delete" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'custom-itinerary-pdfs'::"text") AND ( SELECT "public"."is_admin"() AS "is_admin")));
CREATE POLICY "custom_itinerary_pdfs_admin_insert" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'custom-itinerary-pdfs'::"text") AND ( SELECT "public"."is_admin"() AS "is_admin")));
CREATE POLICY "custom_itinerary_pdfs_admin_select" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'custom-itinerary-pdfs'::"text") AND ( SELECT "public"."is_admin"() AS "is_admin")));
CREATE POLICY "custom_itinerary_pdfs_admin_update" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'custom-itinerary-pdfs'::"text") AND ( SELECT "public"."is_admin"() AS "is_admin"))) WITH CHECK ((("bucket_id" = 'custom-itinerary-pdfs'::"text") AND ( SELECT "public"."is_admin"() AS "is_admin")));
CREATE POLICY "products_images_admin_delete" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'products-images'::"text") AND ( SELECT "public"."is_admin"() AS "is_admin")));
CREATE POLICY "products_images_admin_insert" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'products-images'::"text") AND ( SELECT "public"."is_admin"() AS "is_admin")));
CREATE POLICY "products_images_admin_select" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'products-images'::"text") AND ( SELECT "public"."is_admin"() AS "is_admin")));
CREATE POLICY "products_images_admin_update" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'products-images'::"text") AND ( SELECT "public"."is_admin"() AS "is_admin"))) WITH CHECK ((("bucket_id" = 'products-images'::"text") AND ( SELECT "public"."is_admin"() AS "is_admin")));
CREATE POLICY "products_pdfs_admin_delete" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'products-pdfs'::"text") AND ( SELECT "public"."is_admin"() AS "is_admin")));
CREATE POLICY "products_pdfs_admin_insert" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'products-pdfs'::"text") AND ( SELECT "public"."is_admin"() AS "is_admin")));
CREATE POLICY "products_pdfs_admin_select" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'products-pdfs'::"text") AND ( SELECT "public"."is_admin"() AS "is_admin")));
CREATE POLICY "products_pdfs_admin_update" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'products-pdfs'::"text") AND ( SELECT "public"."is_admin"() AS "is_admin"))) WITH CHECK ((("bucket_id" = 'products-pdfs'::"text") AND ( SELECT "public"."is_admin"() AS "is_admin")));

-- ============================================================
-- FUNCTION EXECUTE GRANTS — explicit least-privilege state.
-- Supabase local default-privileges auto-grant EXECUTE to anon+authenticated on
-- function creation; pg_dump does not reproduce the revoked per-role state, so a
-- fresh 'db reset' would otherwise leave these callable by anon/authenticated.
-- These REVOKEs reproduce the live remote grant matrix (service_role keeps EXECUTE
-- via its explicit grant). is_admin()/is_permanent_user() intentionally remain
-- callable by anon+authenticated (used inside RLS policy expressions).
-- (audit konsolidace 2026-06-04)
-- ============================================================
REVOKE EXECUTE ON FUNCTION "public"."cleanup_orphaned_anon_users"(integer) FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."create_order_with_items"("jsonb") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."custom_access_token_hook"("jsonb") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."handle_new_permanent_user"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."handle_user_email_update"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."increment_download_count"("uuid") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."increment_email_resend_count"("text", "uuid", "text") FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."link_orders_to_customer"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."link_requests_to_customer"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."notify_vercel_blog_publish"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."update_all_products_in_order"() FROM PUBLIC, "anon", "authenticated";
REVOKE EXECUTE ON FUNCTION "public"."update_product_total_sales"() FROM PUBLIC, "anon", "authenticated";

-- ============================================================
-- AUTH TRIGGERS on auth.users (auth schema is Supabase-managed; db dump excludes
-- it). These drive the anonymous→permanent customer sync. (audit konsolidace)
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_permanent_user();

DROP TRIGGER IF EXISTS on_auth_user_email_set ON auth.users;
CREATE TRIGGER on_auth_user_email_set
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.handle_user_email_update();
