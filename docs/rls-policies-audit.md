# RLS Policies Audit - Cesty bez mapy

**Datum auditu:** 2026-01-23
**Autor:** Claude Code Audit
**Migrace opravy:** 025_cleanup_duplicate_policies.sql

## Executive Summary

Audit odhalil **duplicitní a nekonzistentní RLS policies** vznikl postupným přidáváním migrací bez správného cleanup. Hlavní problém: **migrace 012 vytvořila 5 policies bez dropnutí starých** z migrace 002.

## 1. Aktuální stav (před migrací 025)

### custom_itinerary_requests - KRITICKÁ TABULKA

| Policy | Zdroj | Problém |
|--------|-------|---------|
| `"Users and admins can insert requests"` | 016 | OK |
| `"Users and admins can select requests"` | 024 | OK |
| `"Users and admins can update requests"` | 024 | OK |
| `"Admins can delete requests"` | 024 | OK |
| `"Anon role blocked"` | **012** | **NIKDY NEDROPNUTO!** |

**Potenciální duplicity** (pokud migrace nebyly aplikovány správně):
- `custom_requests_*` z migrace 002
- `"Authenticated users can create requests"` z migrace 012
- `"Users can view their own requests"` z migrace 012
- `"Permanent users can update their requests"` z migrace 012
- `"Admins can manage all requests"` z migrace 012

### orders

| Policy | Zdroj | Status |
|--------|-------|--------|
| `"Users and admins can insert orders"` | 019 | OK |
| `"Users and admins can select orders"` | 024 | OK |
| `"Admins can update orders"` | 024 | OK |
| `"Admins can delete orders"` | 024 | OK |

### order_items

| Policy | Zdroj | Status |
|--------|-------|--------|
| `"Users and admins can insert order_items"` | 019 | OK |
| `"Users and admins can select order_items"` | 024 | OK |
| `"Admins can update order_items"` | 024 | OK |
| `"Admins can delete order_items"` | 024 | OK |

### user_roles

| Policy | Zdroj | Status |
|--------|-------|--------|
| `auth_admin_read_user_roles` | 002 | OK (pro JWT hook) |
| `user_roles_select` | 024 | OK |
| `user_roles_admin_insert` | 002 | OK |
| `user_roles_admin_update` | 024 | OK |
| `user_roles_admin_delete` | 024 | OK |

## 2. Identifikované problémy

### 2.1. Migrace 012 - Chybějící DROP

```sql
-- Migrace 012 POUZE VYTVÁŘÍ, NEDROPUJE!
CREATE POLICY "Authenticated users can create requests" ...
CREATE POLICY "Users can view their own requests" ...
CREATE POLICY "Permanent users can update their requests" ...
CREATE POLICY "Admins can manage all requests" ...
CREATE POLICY "Anon role blocked" ...
```

**Důsledek:** Po aplikaci migrace 012 existovalo **9 policies** na tabulce `custom_itinerary_requests`:
- 4 z migrace 002
- 5 z migrace 012

### 2.2. Nekonzistentní admin logika

| Migrace | Způsob kontroly admin | Status |
|---------|----------------------|--------|
| 002 | `(SELECT is_admin())` | OK |
| 012 | `(auth.jwt() -> 'app_metadata' ->> 'role')::text = 'admin'` | **ŠPATNĚ** |
| 015 | `((select auth.jwt()) -> 'app_metadata' ->> 'role')::text = 'admin'` | **ŠPATNĚ** |
| 016+ | `(SELECT is_admin())` | OK |

**Problém:** Migrace 012 a 015 používají `app_metadata.role`, ale náš JWT hook nastavuje `is_admin` claim, ne `app_metadata.role`.

### 2.3. "Anon role blocked" - Redundantní policy

Policy z migrace 012:
```sql
CREATE POLICY "Anon role blocked"
  ON custom_itinerary_requests
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false);
```

**Analýza:**
- Všechny ostatní policies používají `TO authenticated`
- Anon role nemá přístup, protože žádná policy jí přístup nedává
- Tato RESTRICTIVE policy je **redundantní** (ale neškodná)

### 2.4. Naming conventions chaos

| Pattern | Příklad | Migrace |
|---------|---------|---------|
| `{table}_{role}_{action}` | `orders_admin_select` | 002 |
| `{table}_public_{action}` | `products_public_select` | 002 |
| `"{Sentence}"` | `"Authenticated users can create requests"` | 012 |
| `"{Role} can {action} {table}"` | `"Users and admins can select orders"` | 016+ |

## 3. Provedené opravy (migrace 025)

### ČÁST A: Kompletní DROP všech možných policy names

```sql
-- custom_itinerary_requests: Migrace 002
DROP POLICY IF EXISTS "custom_requests_public_insert" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "custom_requests_admin_select" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "custom_requests_admin_update" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "custom_requests_admin_delete" ON custom_itinerary_requests;

-- custom_itinerary_requests: Migrace 012 (KRITICKÉ!)
DROP POLICY IF EXISTS "Authenticated users can create requests" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "Users can view their own requests" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "Permanent users can update their requests" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "Admins can manage all requests" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "Anon role blocked" ON custom_itinerary_requests;

-- custom_itinerary_requests: Migrace 016+
DROP POLICY IF EXISTS "Users and admins can insert requests" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "Users and admins can select requests" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "Users and admins can update requests" ON custom_itinerary_requests;
DROP POLICY IF EXISTS "Admins can delete requests" ON custom_itinerary_requests;
```

### ČÁST B: Vytvoření čistých policies

Všechny policies používají:
- `(SELECT is_admin())` pro admin check
- `(SELECT auth.uid())` pro user ID check
- Žádné redundantní `is_anonymous` checky (is_admin() to již kontroluje)

### ČÁST C: Verifikační query

Migrace obsahuje verification query, který vypíše všechny policies po aplikaci.

## 4. Finální stav (po migraci 025)

### custom_itinerary_requests

| Policy | Action | Logic |
|--------|--------|-------|
| `"Users and admins can insert requests"` | INSERT | `auth_user_id = uid() OR is_admin()` |
| `"Users and admins can select requests"` | SELECT | `auth_user_id = uid() OR is_admin()` |
| `"Users and admins can update requests"` | UPDATE | `(auth_user_id = uid() AND is_permanent_user()) OR is_admin()` |
| `"Admins can delete requests"` | DELETE | `is_admin()` |

### orders

| Policy | Action | Logic |
|--------|--------|-------|
| `"Users and admins can insert orders"` | INSERT | `(auth_user_id = uid() AND validations) OR is_admin()` |
| `"Users and admins can select orders"` | SELECT | `auth_user_id = uid() OR is_admin()` |
| `"Admins can update orders"` | UPDATE | `is_admin()` |
| `"Admins can delete orders"` | DELETE | `is_admin()` |

### order_items

| Policy | Action | Logic |
|--------|--------|-------|
| `"Users and admins can insert order_items"` | INSERT | `EXISTS(own_order) OR is_admin()` |
| `"Users and admins can select order_items"` | SELECT | `EXISTS(own_order) OR is_admin()` |
| `"Admins can update order_items"` | UPDATE | `is_admin()` |
| `"Admins can delete order_items"` | DELETE | `is_admin()` |

### user_roles

| Policy | Action | Logic |
|--------|--------|-------|
| `auth_admin_read_user_roles` | SELECT | `true` (pro JWT hook) |
| `user_roles_select` | SELECT | `user_id = uid() OR is_admin()` |
| `user_roles_admin_insert` | INSERT | `is_admin()` |
| `user_roles_admin_update` | UPDATE | `is_admin()` |
| `user_roles_admin_delete` | DELETE | `is_admin()` |

## 5. Kompletní mapa CREATE/DROP POLICY

### Legenda
- **C** = CREATE
- **D** = DROP

### custom_itinerary_requests

| Policy | 002 | 012 | 014 | 015 | 016 | 022 | 024 | 025 |
|--------|-----|-----|-----|-----|-----|-----|-----|-----|
| `custom_requests_public_insert` | C | - | D | - | - | - | - | D |
| `custom_requests_admin_select` | C | - | D | - | - | - | - | D |
| `custom_requests_admin_update` | C | - | D | - | - | - | - | D |
| `custom_requests_admin_delete` | C | - | D | - | - | - | - | D |
| `"Authenticated users can create requests"` | - | C | - | D | - | - | - | D |
| `"Users can view their own requests"` | - | C | - | D | - | - | - | D |
| `"Permanent users can update their requests"` | - | C | - | D | - | - | - | D |
| `"Admins can manage all requests"` | - | C | - | D | - | - | - | D |
| `"Anon role blocked"` | - | C | - | - | - | - | - | **D** |
| `"Users and admins can insert requests"` | - | - | - | C | D,C | - | - | D,C |
| `"Users and admins can select requests"` | - | - | - | C | D,C | D,C | D,C | D,C |
| `"Users and admins can update requests"` | - | - | - | C | D,C | D,C | D,C | D,C |
| `"Admins can delete requests"` | - | - | - | C | D,C | D,C | D,C | D,C |

### orders

| Policy | 002 | 019 | 022 | 023 | 024 | 025 |
|--------|-----|-----|-----|-----|-----|-----|
| `orders_admin_select` | C | D | - | D | - | D |
| `orders_admin_insert` | C | D | - | D | - | D |
| `orders_admin_update` | C | D | - | D | - | D |
| `orders_admin_delete` | C | D | - | D | - | D |
| `"Users and admins can insert orders"` | - | C | - | - | - | D,C |
| `"Users and admins can select orders"` | - | C | D,C | - | D,C | D,C |
| `"Admins can update orders"` | - | C | D,C | - | D,C | D,C |
| `"Admins can delete orders"` | - | C | D,C | - | D,C | D,C |

### order_items

| Policy | 002 | 019 | 022 | 023 | 024 | 025 |
|--------|-----|-----|-----|-----|-----|-----|
| `order_items_admin_*` | C | D | - | D | - | D |
| `"Users and admins can insert order_items"` | - | C | - | - | - | D,C |
| `"Users and admins can select order_items"` | - | C | D,C | - | D,C | D,C |
| `"Admins can update order_items"` | - | C | D,C | - | D,C | D,C |
| `"Admins can delete order_items"` | - | C | D,C | - | D,C | D,C |

### user_roles

| Policy | 002 | 017 | 022 | 024 | 025 |
|--------|-----|-----|-----|-----|-----|
| `auth_admin_read_user_roles` | C | - | - | - | - |
| `user_roles_admin_select` | C | D | - | - | D |
| `user_roles_admin_insert` | C | - | - | - | D,C |
| `user_roles_admin_update` | C | - | D,C | D,C | D,C |
| `user_roles_admin_delete` | C | - | D,C | D,C | D,C |
| `user_roles_select` | - | C | D,C | D,C | D,C |

## 6. Helper funkce

### is_admin() (z migrace 024)

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
- Cachuje JWT do proměnné (pouze 1 volání auth.jwt() per query)
- Kontroluje `is_admin` claim z JWT
- Kontroluje `is_anonymous` claim (blokuje anonymous users)
- Používá "fail closed" pattern (neznámé/null hodnoty = denied)

### is_permanent_user() (z migrace 024)

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

**Použití:** Pro policies kde běžní uživatelé (ne admin) potřebují kontrolu anonymous statusu.

## 7. Doporučení

1. **Vždy používat DROP POLICY IF EXISTS před CREATE POLICY**
2. **Používat konzistentní naming convention** - doporučeno: `"{Role} can {action} {table}"`
3. **Všechny admin policies používat `(SELECT is_admin())`** - funkce již obsahuje is_anonymous check
4. **Testovat policies v development prostředí** před aplikací v produkci
5. **Dokumentovat změny** v každé migraci

## 8. Verifikace

Po aplikaci migrace 025 spustit:

```sql
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('custom_itinerary_requests', 'orders', 'order_items', 'user_roles')
ORDER BY tablename, policyname;
```

Očekávaný výstup by měl obsahovat pouze policies definované v sekci 4.
