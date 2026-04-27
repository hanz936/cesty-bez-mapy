# Návrh na sjednocení RLS Policies

> **Datum:** 2026-01-24
> **Status:** NÁVRH k diskuzi
> **Cíl:** Konzistentní pojmenování a struktura všech policies

---

## 1. Aktuální stav - identifikovaný chaos

### Problémy

| Problém | Příklad | Dopad |
|---------|---------|-------|
| **Mix pojmenování** | `products_admin_update` vs `"Users and admins can select orders"` | Těžší orientace |
| **Nekonzistentní slovesa** | `select` vs `can select` | Nejasný standard |
| **Různé formáty per operace** | SELECT human readable, DELETE snake_case | Zmatek |

### Aktuální mix

```
Tabulka                      | Formát
-----------------------------|------------------
products                     | snake_case
categories                   | snake_case
blog_posts                   | snake_case
customers                    | snake_case
orders                       | human readable ⚠️
order_items                  | human readable ⚠️
custom_itinerary_requests    | human readable ⚠️
download_tokens              | snake_case
integration_logs             | snake_case
newsletter_consent_log       | snake_case
user_roles                   | mix ⚠️
```

---

## 2. Navrhovaný standard

### Varianta A: Jednotný snake_case (DOPORUČENO)

**Pravidla:**
```
{table}_{scope}_{operation}
```

Kde:
- `{table}` = název tabulky (singular nebo jak je v DB)
- `{scope}` = `public` | `anon` | `authenticated` | `admin` | `user` | `owner`
- `{operation}` = `select` | `insert` | `update` | `delete`

**Příklady:**
```sql
-- Jednoduché admin-only
customers_admin_select
customers_admin_insert
customers_admin_update
customers_admin_delete

-- Public read
products_public_select
products_admin_insert

-- User + Admin (vlastní záznamy)
orders_owner_select      -- vlastník vidí své
orders_admin_select      -- admin vidí vše (nebo sloučit)
orders_owner_insert
orders_admin_update
orders_admin_delete

-- Alternativa pro kombinované policies
orders_owner_or_admin_select
```

**Výhody:**
- Snadno parsovatelné (grep, monitoring)
- Konzistentní délka
- Jasná taxonomie

**Nevýhody:**
- Méně čitelné pro komplexní logiku
- Delší názvy pro kombinované policies

---

### Varianta B: Jednotný human readable

**Pravidla:**
```
"{Subject} can {verb} {table}"
"{Subject} can {verb} own {table}"
```

**Příklady:**
```sql
-- Admin only
"Admins can select customers"
"Admins can insert customers"
"Admins can update customers"
"Admins can delete customers"

-- Public read
"Anyone can select products"
"Admins can insert products"

-- User + Admin
"Users can select own orders"
"Admins can select all orders"
"Users can insert orders"
"Admins can update orders"
"Admins can delete orders"
```

**Výhody:**
- Čitelné pro netechnické lidi
- Self-documenting

**Nevýhody:**
- Těžší grep/filtering
- Více prostoru pro nekonzistenci
- Nutnost escapovat uvozovky v SQL

---

### Varianta C: Hybrid (AKTUÁLNÍ STAV - upravený)

**Pravidla:**
- **Jednoduché policies (admin-only, public-read):** snake_case
- **Komplexní policies (user+admin kombinace):** human readable

**Toto je aktuální stav**, ale s jasnějšími pravidly:

| Kategorie tabulky | Formát |
|-------------------|--------|
| A) Public Read, Admin Write | snake_case |
| B) Conditional Read | snake_case |
| C) Admin Only | snake_case |
| D) User + Admin | human readable |
| E) Public Insert | snake_case |

---

## 3. Doporučení: Varianta A (snake_case)

### Důvody

1. **Jednoznačnost** - žádné uvozovky, žádné mezery
2. **Tooling friendly** - snadné grepování, monitoring, alerting
3. **Migrace** - jednodušší automatizované změny
4. **Dokumentace** - tabulkový formát

### Navrhované přejmenování

#### orders (aktuálně human readable → snake_case)

| Aktuální | Nový |
|----------|------|
| `"Users and admins can insert orders"` | `orders_owner_or_admin_insert` |
| `"Users and admins can select orders"` | `orders_owner_or_admin_select` |
| `"Admins can update orders"` | `orders_admin_update` |
| `"Admins can delete orders"` | `orders_admin_delete` |

#### order_items (aktuálně human readable → snake_case)

| Aktuální | Nový |
|----------|------|
| `"Users and admins can insert order_items"` | `order_items_owner_or_admin_insert` |
| `"Users and admins can select order_items"` | `order_items_owner_or_admin_select` |
| `"Admins can update order_items"` | `order_items_admin_update` |
| `"Admins can delete order_items"` | `order_items_admin_delete` |

#### custom_itinerary_requests (aktuálně human readable → snake_case)

| Aktuální | Nový |
|----------|------|
| `"Users and admins can insert requests"` | `custom_requests_owner_or_admin_insert` |
| `"Users and admins can select requests"` | `custom_requests_owner_or_admin_select` |
| `"Users and admins can update requests"` | `custom_requests_owner_or_admin_update` |
| `"Admins can delete requests"` | `custom_requests_admin_delete` |

#### user_roles (mix → snake_case)

| Aktuální | Nový |
|----------|------|
| `auth_admin_read_user_roles` | `user_roles_auth_admin_select` |
| `user_roles_select` | `user_roles_owner_or_admin_select` |
| `user_roles_admin_insert` | `user_roles_admin_insert` ✓ |
| `user_roles_admin_update` | `user_roles_admin_update` ✓ |
| `user_roles_admin_delete` | `user_roles_admin_delete` ✓ |

---

## 4. Migrační plán

### Migrace 026: Unify policy names

```sql
-- ================================================
-- Migration 026: Unify RLS Policy Names
-- ================================================
-- Created: 2026-01-XX
-- Description: Rename all policies to consistent snake_case format
-- Type: CLEANUP
-- ================================================

-- ================================================
-- PART 1: orders
-- ================================================

-- Rename INSERT
DROP POLICY IF EXISTS "Users and admins can insert orders" ON orders;
CREATE POLICY "orders_owner_or_admin_insert"
  ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth_user_id = (SELECT auth.uid())
    OR (SELECT is_admin())
  );

-- Rename SELECT
DROP POLICY IF EXISTS "Users and admins can select orders" ON orders;
CREATE POLICY "orders_owner_or_admin_select"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = (SELECT auth.uid())
    OR (SELECT is_admin())
  );

-- Rename UPDATE
DROP POLICY IF EXISTS "Admins can update orders" ON orders;
CREATE POLICY "orders_admin_update"
  ON orders
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- Rename DELETE
DROP POLICY IF EXISTS "Admins can delete orders" ON orders;
CREATE POLICY "orders_admin_delete"
  ON orders
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- PART 2: order_items
-- ================================================

DROP POLICY IF EXISTS "Users and admins can insert order_items" ON order_items;
CREATE POLICY "order_items_owner_or_admin_insert"
  ON order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.auth_user_id = (SELECT auth.uid())
    )
    OR (SELECT is_admin())
  );

DROP POLICY IF EXISTS "Users and admins can select order_items" ON order_items;
CREATE POLICY "order_items_owner_or_admin_select"
  ON order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.auth_user_id = (SELECT auth.uid())
    )
    OR (SELECT is_admin())
  );

DROP POLICY IF EXISTS "Admins can update order_items" ON order_items;
CREATE POLICY "order_items_admin_update"
  ON order_items
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

DROP POLICY IF EXISTS "Admins can delete order_items" ON order_items;
CREATE POLICY "order_items_admin_delete"
  ON order_items
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- PART 3: custom_itinerary_requests
-- ================================================

DROP POLICY IF EXISTS "Users and admins can insert requests" ON custom_itinerary_requests;
CREATE POLICY "custom_requests_owner_or_admin_insert"
  ON custom_itinerary_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth_user_id = (SELECT auth.uid())
    OR (SELECT is_admin())
  );

DROP POLICY IF EXISTS "Users and admins can select requests" ON custom_itinerary_requests;
CREATE POLICY "custom_requests_owner_or_admin_select"
  ON custom_itinerary_requests
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = (SELECT auth.uid())
    OR (SELECT is_admin())
  );

DROP POLICY IF EXISTS "Users and admins can update requests" ON custom_itinerary_requests;
CREATE POLICY "custom_requests_owner_or_admin_update"
  ON custom_itinerary_requests
  FOR UPDATE
  TO authenticated
  USING (
    auth_user_id = (SELECT auth.uid())
    OR (SELECT is_admin())
  )
  WITH CHECK (
    (
      auth_user_id = (SELECT auth.uid())
      AND (SELECT is_permanent_user())
    )
    OR (SELECT is_admin())
  );

DROP POLICY IF EXISTS "Admins can delete requests" ON custom_itinerary_requests;
CREATE POLICY "custom_requests_admin_delete"
  ON custom_itinerary_requests
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));

-- ================================================
-- PART 4: user_roles
-- ================================================

-- Keep auth_admin policy name (special case for JWT hook)
-- But rename for consistency if desired:

DROP POLICY IF EXISTS "user_roles_select" ON user_roles;
CREATE POLICY "user_roles_owner_or_admin_select"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT is_admin())
  );

-- ================================================
-- SUCCESS MESSAGE
-- ================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 026 completed!';
  RAISE NOTICE '';
  RAISE NOTICE '🔄 RENAMED POLICIES:';
  RAISE NOTICE '   orders: 4 policies';
  RAISE NOTICE '   order_items: 4 policies';
  RAISE NOTICE '   custom_itinerary_requests: 4 policies';
  RAISE NOTICE '   user_roles: 1 policy';
  RAISE NOTICE '';
  RAISE NOTICE '📋 NEW NAMING CONVENTION:';
  RAISE NOTICE '   {table}_{scope}_{operation}';
  RAISE NOTICE '   Scopes: public, admin, owner, owner_or_admin';
  RAISE NOTICE '   Operations: select, insert, update, delete';
END $$;
```

---

## 5. Finální přehled po sjednocení

| Tabulka | SELECT | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|--------|
| products | `_public_select` | `_admin_insert` | `_admin_update` | `_admin_delete` |
| categories | `_public_select` | `_admin_insert` | `_admin_update` | `_admin_delete` |
| blog_posts | `_public_select`, `_authenticated_select` | `_admin_insert` | `_admin_update` | `_admin_delete` |
| customers | `_admin_select` | `_admin_insert` | `_admin_update` | `_admin_delete` |
| orders | `_owner_or_admin_select` | `_owner_or_admin_insert` | `_admin_update` | `_admin_delete` |
| order_items | `_owner_or_admin_select` | `_owner_or_admin_insert` | `_admin_update` | `_admin_delete` |
| custom_requests | `_owner_or_admin_select` | `_owner_or_admin_insert` | `_owner_or_admin_update` | `_admin_delete` |
| download_tokens | `_public_select`, `_authenticated_select` | `_admin_insert` | ❌ | `_admin_delete` |
| integration_logs | `_admin_select` | `_admin_insert` | ❌ | `_admin_delete` |
| newsletter_consent | `_admin_select` | `_public_insert` | ❌ | ❌ |
| user_roles | `_auth_admin_select`, `_owner_or_admin_select` | `_admin_insert` | `_admin_update` | `_admin_delete` |

---

## 6. Rozhodnutí k učinění

1. **Souhlasíš s Variantou A (snake_case)?**
   - [ ] Ano, implementovat migraci 026
   - [ ] Ne, preferuji Variantu B (human readable)
   - [ ] Ne, preferuji Variantu C (hybrid - ponechat)

2. **Scope naming pro "vlastní záznamy":**
   - [ ] `owner` (kratší)
   - [ ] `user` (obecnější)
   - [ ] `own` (příslovce)

3. **Kombinované policies:**
   - [ ] `owner_or_admin` (explicitní)
   - [ ] `user_admin` (kratší)
   - [ ] `mixed` (obecný)

4. **Priorita implementace:**
   - [ ] Vysoká - implementovat hned
   - [ ] Střední - naplánovat na příští sprint
   - [ ] Nízká - pouze pro nové tabulky

---

*Návrh vytvořen: 2026-01-24*
