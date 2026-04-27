# RLS Policies Audit Prompt

> **Účel:** Systematická kontrola a sjednocení Row Level Security policies v Supabase projektu.
> **Verze:** 1.0
> **Datum:** 2026-01-24

---

## 1. Příprava auditu

### 1.1 Získání aktuálního stavu

Spusť tyto dotazy v Supabase SQL Editoru a ulož výstupy:

```sql
-- ===========================================
-- QUERY 1: Seznam všech tabulek s RLS statusem
-- ===========================================
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ===========================================
-- QUERY 2: Kompletní seznam všech policies
-- ===========================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,  -- PERMISSIVE vs RESTRICTIVE
  roles,
  cmd,         -- SELECT, INSERT, UPDATE, DELETE, ALL
  qual,        -- USING clause
  with_check   -- WITH CHECK clause
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- ===========================================
-- QUERY 3: Storage policies
-- ===========================================
SELECT
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

-- ===========================================
-- QUERY 4: Helper funkce
-- ===========================================
SELECT
  routine_name,
  routine_type,
  data_type as return_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('is_admin', 'is_permanent_user', 'custom_access_token_hook')
ORDER BY routine_name;

-- ===========================================
-- QUERY 5: Detekce duplicitních policies
-- ===========================================
SELECT
  tablename,
  cmd,
  COUNT(*) as policy_count,
  STRING_AGG(policyname, ', ') as policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename, cmd
HAVING COUNT(*) > 1
ORDER BY tablename, cmd;

-- ===========================================
-- QUERY 6: Policies bez (SELECT ...) wrapperu (performance issue)
-- ===========================================
SELECT
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    (qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(SELECT auth.uid())%')
    OR (qual LIKE '%is_admin()%' AND qual NOT LIKE '%(SELECT is_admin())%')
    OR (with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(SELECT auth.uid())%')
    OR (with_check LIKE '%is_admin()%' AND with_check NOT LIKE '%(SELECT is_admin())%')
  )
ORDER BY tablename;
```

---

## 2. Audit checklist

### 2.1 Pro každou tabulku zkontroluj:

```
□ RLS ENABLED?
  - Příkaz: ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
  - Pokud ne, tabulka je OTEVŘENÁ všem!

□ Pokrytí operací:
  - SELECT: Kdo může číst?
  - INSERT: Kdo může vytvářet?
  - UPDATE: Kdo může měnit? (USING + WITH CHECK)
  - DELETE: Kdo může mazat?

□ Konzistence pojmenování:
  - Formát: {tabulka}_{role}_{operace} nebo "Human readable"
  - Příklad: products_admin_update nebo "Admins can update products"

□ Správné role:
  - TO anon = nepřihlášení
  - TO authenticated = přihlášení
  - TO anon, authenticated = všichni

□ Performance pattern:
  - (SELECT auth.uid()) místo auth.uid()
  - (SELECT is_admin()) místo is_admin()

□ Fail-closed princip:
  - COALESCE(..., false) pro boolean checks
  - IS FALSE místo = false pro nullable hodnoty
```

### 2.2 Bezpečnostní kontroly

```
□ Admin funkce:
  - is_admin() kontroluje is_anonymous?
  - Používá COALESCE pro null handling?

□ Anonymous users:
  - Mohou INSERT tam kde mají? (orders, custom_requests)
  - NEMOHOU UPDATE/DELETE vlastní záznamy?
  - NEMOHOU provádět admin operace?

□ Service role bypass:
  - Je zdokumentováno které operace vyžadují service_role?
  - Webhooky používají service_role pro INSERT?

□ JWT Hook:
  - auth_admin_read_user_roles policy existuje?
  - supabase_auth_admin má GRANT na user_roles?
```

### 2.3 Kategorizace tabulek

Každá tabulka spadá do jedné z těchto kategorií:

| Kategorie | SELECT | INSERT | UPDATE | DELETE | Příklad |
|-----------|--------|--------|--------|--------|---------|
| **A) Public Read, Admin Write** | public | admin | admin | admin | products, categories |
| **B) Conditional Read, Admin Write** | podmínka | admin | admin | admin | blog_posts (published_at) |
| **C) Admin Only** | admin | admin | admin | admin | customers, integration_logs |
| **D) User + Admin** | own+admin | own+admin | own+admin / admin | admin | orders, custom_requests |
| **E) Public Insert, Admin Read** | admin | public | ❌ | ❌ | newsletter_consent_log |
| **F) Token Validation** | valid+admin | admin | ❌ | admin | download_tokens |

---

## 3. Standardní pojmenování policies

### 3.1 Konvence

**Formát A - Snake case (preferovaný pro jednoduché policies):**
```
{tabulka}_{role}_{operace}
```
Příklady:
- `products_public_select`
- `products_admin_insert`
- `customers_admin_delete`

**Formát B - Human readable (pro komplexní policies):**
```
"{Subjekt} can {operace} {objekt}"
```
Příklady:
- `"Users and admins can select orders"`
- `"Admins can delete requests"`

### 3.2 Pravidla

1. **Jeden formát per tabulka** - nekombinat snake_case a human readable
2. **Popisné názvy** - z názvu musí být jasné co policy dělá
3. **Konzistentní slovesa:**
   - `select` / `can select`
   - `insert` / `can insert` / `can create`
   - `update` / `can update`
   - `delete` / `can delete`

---

## 4. Standardní SQL patterny

### 4.1 Admin-only policy

```sql
-- SELECT
CREATE POLICY "{table}_admin_select"
  ON {table}
  FOR SELECT
  TO authenticated
  USING ((SELECT is_admin()));

-- INSERT
CREATE POLICY "{table}_admin_insert"
  ON {table}
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT is_admin()));

-- UPDATE
CREATE POLICY "{table}_admin_update"
  ON {table}
  FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- DELETE
CREATE POLICY "{table}_admin_delete"
  ON {table}
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));
```

### 4.2 Public read, Admin write

```sql
-- SELECT (public)
CREATE POLICY "{table}_public_select"
  ON {table}
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- INSERT, UPDATE, DELETE = admin-only (viz 4.1)
```

### 4.3 User + Admin (vlastní záznamy)

```sql
-- SELECT
CREATE POLICY "Users and admins can select {table}"
  ON {table}
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = (SELECT auth.uid())
    OR (SELECT is_admin())
  );

-- INSERT
CREATE POLICY "Users and admins can insert {table}"
  ON {table}
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth_user_id = (SELECT auth.uid())
    OR (SELECT is_admin())
  );

-- UPDATE (jen permanent users vlastní, nebo admin)
CREATE POLICY "Users and admins can update {table}"
  ON {table}
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

-- DELETE (pouze admin)
CREATE POLICY "Admins can delete {table}"
  ON {table}
  FOR DELETE
  TO authenticated
  USING ((SELECT is_admin()));
```

### 4.4 Conditional public read

```sql
-- Anon vidí jen published
CREATE POLICY "{table}_public_select"
  ON {table}
  FOR SELECT
  TO anon
  USING ({condition});  -- např. published_at IS NOT NULL

-- Authenticated vidí published NEBO je admin (vidí vše)
CREATE POLICY "{table}_authenticated_select"
  ON {table}
  FOR SELECT
  TO authenticated
  USING (
    {condition}
    OR (SELECT is_admin())
  );
```

### 4.5 Storage policies

```sql
CREATE POLICY "{bucket}_admin_{operation}"
  ON storage.objects
  FOR {OPERATION}
  TO authenticated
  USING (  -- nebo WITH CHECK pro INSERT
    bucket_id = '{bucket-name}'
    AND (SELECT public.is_admin())  -- POZOR: public. prefix!
  );
```

---

## 5. Audit report šablona

Pro každou tabulku vyplň:

```markdown
### {table_name}

**Kategorie:** {A/B/C/D/E/F}

**RLS Status:** ✅ ENABLED / ❌ DISABLED

**Policies:**

| Policy | Operace | Role | Logika | Status |
|--------|---------|------|--------|--------|
| {name} | SELECT | {role} | {condition} | ✅/⚠️/❌ |
| {name} | INSERT | {role} | {condition} | ✅/⚠️/❌ |
| {name} | UPDATE | {role} | {condition} | ✅/⚠️/❌ |
| {name} | DELETE | {role} | {condition} | ✅/⚠️/❌ |

**Poznámky:**
- {Jakékoliv problémy nebo specifika}

**Akce:**
- [ ] {Co je třeba opravit}
```

---

## 6. Příklad kompletního auditu

### products

**Kategorie:** A (Public Read, Admin Write)

**RLS Status:** ✅ ENABLED

**Policies:**

| Policy | Operace | Role | Logika | Status |
|--------|---------|------|--------|--------|
| products_public_select | SELECT | anon, authenticated | true | ✅ |
| products_admin_insert | INSERT | authenticated | is_admin() | ✅ |
| products_admin_update | UPDATE | authenticated | is_admin() | ✅ |
| products_admin_delete | DELETE | authenticated | is_admin() | ✅ |

**Poznámky:**
- Veřejně čitelné produkty (e-shop)
- Soft delete pomocí is_deleted flag

**Akce:**
- [x] Žádné akce potřeba

---

## 7. Finální checklist před schválením

```
□ Všechny tabulky mají RLS ENABLED
□ Všechny tabulky mají policies pro všechny potřebné operace
□ Žádné duplicitní policies pro stejnou operaci
□ Všechny policies používají (SELECT ...) pattern
□ is_admin() kontroluje is_anonymous
□ Pojmenování je konzistentní v rámci projektu
□ Storage policies pokrývají všechny buckety
□ auth_admin_read_user_roles existuje pro JWT hook
□ Service role operace jsou zdokumentovány
□ Verification query z migrace 025 prošel
```

---

## 8. Verification queries

### Po aplikaci změn spusť:

```sql
-- Ověření že všechny tabulky mají RLS
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false;
-- Očekávaný výsledek: 0 řádků

-- Ověření počtu policies per tabulka
SELECT
  tablename,
  COUNT(*) as total_policies,
  COUNT(CASE WHEN cmd = 'SELECT' THEN 1 END) as select_count,
  COUNT(CASE WHEN cmd = 'INSERT' THEN 1 END) as insert_count,
  COUNT(CASE WHEN cmd = 'UPDATE' THEN 1 END) as update_count,
  COUNT(CASE WHEN cmd = 'DELETE' THEN 1 END) as delete_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Test is_admin() jako anon (mělo by vrátit false)
SET ROLE anon;
SELECT is_admin();  -- Očekáváno: false
RESET ROLE;
```

---

*Prompt vytvořen: 2026-01-24*
