# RLS Policies Audit - Kompletní verze

> **Verze:** 2.0
> **Datum:** 2026-01-24
> **Stav:** Po migraci 025 (finální cleanup)

---

## 1. Souhrn

| Metrika | Hodnota |
|---------|---------|
| Tabulky celkem | 11 |
| RLS ENABLED | 11/11 (100%) |
| Policies celkem | ~45 |
| Storage buckety | 3 |
| Storage policies | 10 |

### Kategorizace tabulek

| Kategorie | Tabulky | Popis |
|-----------|---------|-------|
| **A) Public Read, Admin Write** | products, categories | Veřejně čitelné, admin spravuje |
| **B) Conditional Read, Admin Write** | blog_posts, download_tokens | Podmíněné čtení (published, valid) |
| **C) Admin Only** | customers, integration_logs | Pouze admin přístup |
| **D) User + Admin** | orders, order_items, custom_itinerary_requests, user_roles | Vlastní záznamy + admin |
| **E) Public Insert, Admin Read** | newsletter_consent_log | Audit log - append only |

---

## 2. Helper funkce

### is_admin()

```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  jwt_data jsonb;
BEGIN
  jwt_data := (SELECT auth.jwt());
  RETURN
    COALESCE((jwt_data->>'is_admin')::boolean, false)
    AND
    (jwt_data->>'is_anonymous')::boolean IS FALSE;
END;
$$;
```

**Vlastnosti:**
- ✅ Cachuje JWT do proměnné (1x volání per query)
- ✅ Fail-closed: COALESCE(..., false)
- ✅ Blokuje anonymous users: `is_anonymous IS FALSE`

### is_permanent_user()

```sql
CREATE OR REPLACE FUNCTION is_permanent_user()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  jwt_data jsonb;
BEGIN
  jwt_data := (SELECT auth.jwt());
  RETURN (jwt_data->>'is_anonymous')::boolean IS NOT TRUE;
END;
$$;
```

**Vlastnosti:**
- ✅ Pro UPDATE policies kde anonymous nemá právo měnit vlastní záznamy
- ✅ `IS NOT TRUE` handles: null→true, false→true, true→false

---

## 3. Standardy pojmenování

### Použité formáty v projektu

| Formát | Použití | Příklad |
|--------|---------|---------|
| `{table}_{role}_{op}` | Jednoduché policies | `products_admin_update` |
| `{table}_{scope}_{op}` | Public/authenticated | `blog_posts_public_select` |
| `"Human readable"` | Komplexní user+admin | `"Users and admins can select orders"` |

### Doporučení pro konzistenci

**Pravidlo:** Jedna tabulka = jeden formát

- **Kategorie A, B, C, E, F:** Snake case (`{table}_{role}_{op}`)
- **Kategorie D:** Human readable (`"Users and admins can..."`)

---

## 4. Finální stav policies - Všechny tabulky

### 4.1 products (Kategorie A)

**RLS:** ✅ ENABLED

| Policy | Operace | Role | USING | WITH CHECK |
|--------|---------|------|-------|------------|
| `products_public_select` | SELECT | anon, authenticated | `true` | - |
| `products_admin_insert` | INSERT | authenticated | - | `(SELECT is_admin())` |
| `products_admin_update` | UPDATE | authenticated | `(SELECT is_admin())` | `(SELECT is_admin())` |
| `products_admin_delete` | DELETE | authenticated | `(SELECT is_admin())` | - |

**Poznámky:**
- Veřejné čtení pro e-shop frontend
- Soft delete pomocí `is_deleted` flag

---

### 4.2 categories (Kategorie A)

**RLS:** ✅ ENABLED

| Policy | Operace | Role | USING | WITH CHECK |
|--------|---------|------|-------|------------|
| `categories_public_select` | SELECT | anon, authenticated | `true` | - |
| `categories_admin_insert` | INSERT | authenticated | - | `(SELECT is_admin())` |
| `categories_admin_update` | UPDATE | authenticated | `(SELECT is_admin())` | `(SELECT is_admin())` |
| `categories_admin_delete` | DELETE | authenticated | `(SELECT is_admin())` | - |

**Poznámky:**
- Veřejné čtení pro filtrování produktů

---

### 4.3 blog_posts (Kategorie B)

**RLS:** ✅ ENABLED

| Policy | Operace | Role | USING | WITH CHECK |
|--------|---------|------|-------|------------|
| `blog_posts_public_select` | SELECT | anon | `published_at IS NOT NULL` | - |
| `blog_posts_authenticated_select` | SELECT | authenticated | `published_at IS NOT NULL OR (SELECT is_admin())` | - |
| `blog_posts_admin_insert` | INSERT | authenticated | - | `(SELECT is_admin())` |
| `blog_posts_admin_update` | UPDATE | authenticated | `(SELECT is_admin())` | `(SELECT is_admin())` |
| `blog_posts_admin_delete` | DELETE | authenticated | `(SELECT is_admin())` | - |

**Poznámky:**
- Anon vidí pouze publikované články
- Admin vidí i drafty (authenticated SELECT)

---

### 4.4 customers (Kategorie C)

**RLS:** ✅ ENABLED

| Policy | Operace | Role | USING | WITH CHECK |
|--------|---------|------|-------|------------|
| `customers_admin_select` | SELECT | authenticated | `(SELECT is_admin())` | - |
| `customers_admin_insert` | INSERT | authenticated | - | `(SELECT is_admin())` |
| `customers_admin_update` | UPDATE | authenticated | `(SELECT is_admin())` | `(SELECT is_admin())` |
| `customers_admin_delete` | DELETE | authenticated | `(SELECT is_admin())` | - |

**Poznámky:**
- Citlivá zákaznická data - pouze admin
- Propojeno s auth.users přes trigger

---

### 4.5 orders (Kategorie D)

**RLS:** ✅ ENABLED

| Policy | Operace | Role | USING | WITH CHECK |
|--------|---------|------|-------|------------|
| `"Users and admins can insert orders"` | INSERT | authenticated | - | `auth_user_id = (SELECT auth.uid()) OR (SELECT is_admin())` |
| `"Users and admins can select orders"` | SELECT | authenticated | `auth_user_id = (SELECT auth.uid()) OR (SELECT is_admin())` | - |
| `"Admins can update orders"` | UPDATE | authenticated | `(SELECT is_admin())` | `(SELECT is_admin())` |
| `"Admins can delete orders"` | DELETE | authenticated | `(SELECT is_admin())` | - |

**Poznámky:**
- Uživatel vidí/vytváří vlastní objednávky
- Anonymous users mohou vytvořit objednávku (guest checkout)
- UPDATE/DELETE pouze admin
- Stripe webhook používá service_role (bypass RLS)

---

### 4.6 order_items (Kategorie D)

**RLS:** ✅ ENABLED

| Policy | Operace | Role | USING | WITH CHECK |
|--------|---------|------|-------|------------|
| `"Users and admins can insert order_items"` | INSERT | authenticated | - | `EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.auth_user_id = (SELECT auth.uid())) OR (SELECT is_admin())` |
| `"Users and admins can select order_items"` | SELECT | authenticated | `EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.auth_user_id = (SELECT auth.uid())) OR (SELECT is_admin())` | - |
| `"Admins can update order_items"` | UPDATE | authenticated | `(SELECT is_admin())` | `(SELECT is_admin())` |
| `"Admins can delete order_items"` | DELETE | authenticated | `(SELECT is_admin())` | - |

**Poznámky:**
- Přístup děděn z parent order (EXISTS subquery)
- Stripe webhook používá service_role

---

### 4.7 custom_itinerary_requests (Kategorie D)

**RLS:** ✅ ENABLED

| Policy | Operace | Role | USING | WITH CHECK |
|--------|---------|------|-------|------------|
| `"Users and admins can insert requests"` | INSERT | authenticated | - | `auth_user_id = (SELECT auth.uid()) OR (SELECT is_admin())` |
| `"Users and admins can select requests"` | SELECT | authenticated | `auth_user_id = (SELECT auth.uid()) OR (SELECT is_admin())` | - |
| `"Users and admins can update requests"` | UPDATE | authenticated | `auth_user_id = (SELECT auth.uid()) OR (SELECT is_admin())` | `(auth_user_id = (SELECT auth.uid()) AND (SELECT is_permanent_user())) OR (SELECT is_admin())` |
| `"Admins can delete requests"` | DELETE | authenticated | `(SELECT is_admin())` | - |

**Poznámky:**
- UPDATE: Anonymous users NEMOHOU měnit vlastní requests (is_permanent_user check)
- Logika: Guest vytvoří request → po registraci může editovat

---

### 4.8 download_tokens (Kategorie B/F)

**RLS:** ✅ ENABLED

| Policy | Operace | Role | USING | WITH CHECK |
|--------|---------|------|-------|------------|
| `download_tokens_public_select` | SELECT | anon | `expires_at > now()` | - |
| `download_tokens_authenticated_select` | SELECT | authenticated | `expires_at > now() OR (SELECT is_admin())` | - |
| `download_tokens_admin_insert` | INSERT | authenticated | - | `(SELECT is_admin())` |
| `download_tokens_admin_delete` | DELETE | authenticated | `(SELECT is_admin())` | - |

**Poznámky:**
- Validace tokenů (non-expired) pro public
- Admin vidí všechny (včetně expired)
- Žádný UPDATE - tokeny jsou immutable
- Webhook vytváří přes service_role

---

### 4.9 integration_logs (Kategorie C)

**RLS:** ✅ ENABLED

| Policy | Operace | Role | USING | WITH CHECK |
|--------|---------|------|-------|------------|
| `integration_logs_admin_select` | SELECT | authenticated | `(SELECT is_admin())` | - |
| `integration_logs_admin_insert` | INSERT | authenticated | - | `(SELECT is_admin())` |
| `integration_logs_admin_delete` | DELETE | authenticated | `(SELECT is_admin())` | - |

**Poznámky:**
- Audit log pro API integrace
- Žádný UPDATE - log je append-only pro admin
- Edge Functions zapisují přes service_role

---

### 4.10 newsletter_consent_log (Kategorie E)

**RLS:** ✅ ENABLED

| Policy | Operace | Role | USING | WITH CHECK |
|--------|---------|------|-------|------------|
| `newsletter_consent_public_insert` | INSERT | anon, authenticated | - | `email IS NOT NULL AND consent_given IS NOT NULL AND source IS NOT NULL` |
| `newsletter_consent_admin_select` | SELECT | authenticated | `(SELECT is_admin())` | - |

**Poznámky:**
- GDPR consent log - append only
- Public INSERT s validací povinných polí
- Žádný UPDATE/DELETE - immutable audit trail
- Admin pouze čtení

---

### 4.11 user_roles (Kategorie D)

**RLS:** ✅ ENABLED

| Policy | Operace | Role | USING | WITH CHECK |
|--------|---------|------|-------|------------|
| `auth_admin_read_user_roles` | SELECT | supabase_auth_admin | `true` | - |
| `user_roles_select` | SELECT | authenticated | `user_id = (SELECT auth.uid()) OR (SELECT is_admin())` | - |
| `user_roles_admin_insert` | INSERT | authenticated | - | `(SELECT is_admin())` |
| `user_roles_admin_update` | UPDATE | authenticated | `(SELECT is_admin())` | `(SELECT is_admin())` |
| `user_roles_admin_delete` | DELETE | authenticated | `(SELECT is_admin())` | - |

**Poznámky:**
- `auth_admin_read_user_roles` je KRITICKÁ pro JWT hook
- User vidí vlastní role, admin vidí všechny
- Pouze admin může měnit role

---

## 5. Storage policies

### 5.1 blog-images (public bucket)

| Policy | Operace | Podmínka |
|--------|---------|----------|
| `blog_images_admin_insert` | INSERT | `bucket_id = 'blog-images' AND (SELECT public.is_admin())` |
| `blog_images_admin_update` | UPDATE | `bucket_id = 'blog-images' AND (SELECT public.is_admin())` |
| `blog_images_admin_delete` | DELETE | `bucket_id = 'blog-images' AND (SELECT public.is_admin())` |

**Poznámky:** Public bucket - SELECT nepotřebuje policy

### 5.2 products-images (public bucket)

| Policy | Operace | Podmínka |
|--------|---------|----------|
| `products_images_admin_insert` | INSERT | `bucket_id = 'products-images' AND (SELECT public.is_admin())` |
| `products_images_admin_update` | UPDATE | `bucket_id = 'products-images' AND (SELECT public.is_admin())` |
| `products_images_admin_delete` | DELETE | `bucket_id = 'products-images' AND (SELECT public.is_admin())` |

**Poznámky:** Public bucket - SELECT nepotřebuje policy

### 5.3 products-pdfs (private bucket)

| Policy | Operace | Podmínka |
|--------|---------|----------|
| `products_pdfs_admin_select` | SELECT | `bucket_id = 'products-pdfs' AND (SELECT public.is_admin())` |
| `products_pdfs_admin_insert` | INSERT | `bucket_id = 'products-pdfs' AND (SELECT public.is_admin())` |
| `products_pdfs_admin_update` | UPDATE | `bucket_id = 'products-pdfs' AND (SELECT public.is_admin())` |
| `products_pdfs_admin_delete` | DELETE | `bucket_id = 'products-pdfs' AND (SELECT public.is_admin())` |

**Poznámky:**
- Private bucket - SELECT policy vyžadována
- PDF delivery přes signed URLs (Edge Function)

---

## 6. Service Role Operations

Následující operace vyžadují `service_role` key (bypass RLS):

| Operace | Tabulka | Kontext |
|---------|---------|---------|
| Stripe webhook | orders | Vytvoření objednávky po platbě |
| Stripe webhook | order_items | Položky objednávky |
| Token generation | download_tokens | Vytvoření download linku |
| API logging | integration_logs | Logování z Edge Functions |

**Bezpečnost:** Service role key je uložen pouze v Edge Functions environment variables, nikdy na frontendu.

---

## 7. Známé odchylky od standardů

| Tabulka | Odchylka | Důvod | Akce |
|---------|----------|-------|------|
| newsletter_consent_log | INSERT WITH CHECK bez `(SELECT ...)` | Nepoužívá funkce, pouze NULL checks | ✅ OK |
| user_roles | Extra policy pro `supabase_auth_admin` | JWT hook requirement | ✅ Nutné |
| download_tokens | Žádný UPDATE | Tokeny jsou immutable | ✅ By design |
| integration_logs | Žádný UPDATE | Audit log append-only | ✅ By design |

---

## 8. Verifikační query

```sql
-- Spustit po jakékoliv změně RLS
SELECT
  t.tablename,
  t.rowsecurity as rls_enabled,
  COUNT(p.policyname) as policy_count,
  STRING_AGG(p.cmd || ': ' || p.policyname, E'\n' ORDER BY p.cmd) as policies
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public'
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;
```

---

*Audit dokončen: 2026-01-24*
*Poslední migrace: 025_cleanup_duplicate_policies*
