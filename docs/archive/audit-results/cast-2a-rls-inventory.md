# Audit Část 2a: RLS policies - inventory a analýza

**Datum:** 2026-02-17
**Metoda:** SQL dotazy přes pg modul (run-sql.mjs) na živou DB

---

## Celkový přehled

- **43 RLS policies celkem** (31 public + 12 storage)
- **11 tabulek**, všechny mají RLS zapnuto
- **0 RESTRICTIVE policies** (cleanup v 025 proběhl správně)
- **0 policies referencují user_metadata** (lint rule 0015: PASS)

---

## CRITICAL: products_public_select nemá filtr is_deleted

```
Policy: products_public_select
Roles: {anon, authenticated}
CMD: SELECT
Qual: true
```

**Problém:** Policy povoluje SELECT na VŠECHNY produkty včetně smazaných (`is_deleted = true`). Očekávaný filtr `(is_deleted = false)` **CHYBÍ**.

**Dopad:** Anonymní i přihlášení uživatelé vidí smazané produkty přes Supabase REST API. Frontend sice filtruje `is_deleted = false` v dotazu, ale útočník může přes přímý API call vidět smazané produkty.

**Severity: CRITICAL**

---

## HIGH: Anonymní uživatelé nemohou vytvářet custom requests

```
Policy: Users and admins can insert requests
Roles: {authenticated}
CMD: INSERT
with_check: (auth_user_id = (SELECT auth.uid()) OR (SELECT is_admin()))
```

**Problém:** Role je `authenticated` - anonymní uživatelé (role `anon`) nemají INSERT právo. Audit plán očekává `public (anon)` INSERT.

**Poznámka:** Supabase anonymous auth vytvoří `authenticated` session, takže anonymní uživatelé MAJÍ authenticated role. Toto NENÍ problém pokud se používá anonymous auth. Pokud by někdo přistupoval bez jakéhokoliv tokenu (čistý anon), INSERT by selhal.

**Severity: MEDIUM** (závisí na tom, zda frontend vždy používá anonymous auth)

---

## MEDIUM: Nekonzistentní pojmenování policies

| Styl | Tabulky | Počet policies |
|------|---------|----------------|
| snake_case | blog_posts, categories, customers, download_tokens, integration_logs, newsletter_consent_log, products, user_roles | 27 |
| human_readable | orders, order_items, custom_itinerary_requests | 12 |

**4 tabulky** (orders, order_items, custom_itinerary_requests + user_roles partial) používají human_readable názvy typu "Users and admins can select orders", zatímco zbytek používá snake_case jako `blog_posts_admin_select`.

**Doporučení:** Unifikovat na snake_case (migrace 029 podle RLS_UNIFICATION_PROPOSAL.md)

**Severity: LOW** (kosmetické, žádný bezpečnostní dopad)

---

## Performance: SELECT wrapper analýza (lint rule 0003)

Dotaz 2D nalezl 37 "problémových" policies, ale jde o **false positive** v dotazu. Všechny policies ve skutečnosti POUŽÍVAJÍ SELECT wrapper:

```sql
-- Reálný formát v DB (správný):
( SELECT is_admin() AS is_admin)
( SELECT auth.uid() AS uid)

-- Vzor v 2D dotazu (nepřesný):
'%(SELECT is_admin())%'  -- neodpovídá kvůli mezeře a aliasu
```

**Závěr:** Všechny policies korektně používají `(SELECT ...)` wrapper. Lint rule 0003: **PASS**.

---

## Helper funkce

### is_admin()
- **SECURITY DEFINER:** NE (správně)
- **Volatilita:** STABLE (správně)
- **search_path:** `''` (správně)
- **Logika:** Kontroluje `is_admin` claim v JWT + ověřuje `is_anonymous IS FALSE`
- **Hodnocení:** ✅ Správně implementovaná, fail-closed (COALESCE na false)

### is_permanent_user()
- **SECURITY DEFINER:** NE (správně)
- **Volatilita:** STABLE (správně)
- **search_path:** `''` (správně)
- **Logika:** `is_anonymous IS NOT TRUE` z JWT
- **Hodnocení:** ✅ Správně implementovaná

### custom_access_token_hook()
- **SECURITY DEFINER:** NE (správně - nepotřebuje)
- **Volatilita:** STABLE (správně)
- **search_path:** `''` (správně)
- **GRANT:** postgres, service_role, supabase_auth_admin (správně omezeno)
- **Hodnocení:** ✅ Správně implementovaná, správně omezená

---

## RLS matice - skutečný stav vs. očekávaný

| Tabulka | SELECT | INSERT | UPDATE | DELETE | Shoda? |
|---------|--------|--------|--------|--------|--------|
| products | ❌ `true` (mělo: `is_deleted=false`) | admin ✅ | admin ✅ | admin ✅ | **CRITICAL** |
| categories | public ✅ | admin ✅ | admin ✅ | admin ✅ | ✅ |
| blog_posts | published+admin / anon:published ✅ | admin ✅ | admin ✅ | admin ✅ | ✅ |
| download_tokens | non-expired+admin / anon:non-expired ✅ | admin ✅ | N/A | admin ✅ | ✅ |
| customers | admin ✅ | admin ✅ | admin ✅ | admin ✅ | ✅ |
| integration_logs | admin ✅ | admin ✅ | N/A | admin ✅ | ✅ |
| orders | own+admin ✅ | own+admin (validace) ✅ | admin ✅ | admin ✅ | ✅ |
| order_items | own(via order)+admin ✅ | own(via order)+admin ✅ | admin ✅ | admin ✅ | ✅ |
| custom_itinerary_requests | own+admin ✅ | own+admin ✅ | own(perm)+admin ✅ | admin ✅ | ✅ |
| user_roles | own+admin+auth_admin ✅ | admin ✅ | admin ✅ | admin ✅ | ✅ |
| newsletter_consent_log | admin ✅ | public(validated) ✅ | žádný ✅ | žádný ✅ | ✅ |

---

## Storage policies (12 policies)

| Bucket | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| products-pdfs | admin ✅ | admin ✅ | admin ✅ | admin ✅ |
| products-images | ❌ žádný public SELECT | admin ✅ | admin ✅ | admin ✅ |
| blog-images | ❌ žádný public SELECT | admin ✅ | admin ✅ | admin ✅ |

**Poznámka:** Public buckety (products-images, blog-images) nemají explicitní public SELECT policy. Supabase ale pro public buckety povoluje čtení automaticky bez RLS policy - soubory jsou dostupné přes public URL. Toto je OK.

---

## Duplikáty (více policies pro stejný tabulku+cmd)

| Tabulka | CMD | Počet | Policies |
|---------|-----|-------|----------|
| blog_posts | SELECT | 2 | blog_posts_authenticated_select, blog_posts_public_select |
| download_tokens | SELECT | 2 | download_tokens_authenticated_select, download_tokens_public_select |
| user_roles | SELECT | 2 | auth_admin_read_user_roles, user_roles_select |

Všechny duplikáty jsou **záměrné** - oddělují anon vs. authenticated nebo speciální role (supabase_auth_admin). **PASS**.

---

## Detailní analýza orders INSERT policy

```sql
with_check: (
  (auth_user_id = (SELECT auth.uid()))
  AND (customer_email IS NOT NULL)
  AND (customer_name IS NOT NULL)
  AND (total_amount >= 0)
) OR (SELECT is_admin())
```

**Validace:** ✅ Správná - ověřuje vlastnictví, povinné údaje, nezáporný amount.

**Poznámka:** V kombinaci s neaplikovanou migrací 026 (orders.customer_name je NOT NULL na DB úrovni), je tato RLS validace redundantní ale neškodná.

---

## Newsletter INSERT policy

```sql
with_check: (
  (email IS NOT NULL)
  AND (consent_given IS NOT NULL)
  AND (source IS NOT NULL)
)
```

**Validace:** ✅ Správná - validuje povinné pole na RLS úrovni. Žádný UPDATE/DELETE = append-only log.

---

## Shrnutí problémů

| Severity | Problém | Doporučení |
|----------|---------|------------|
| **CRITICAL** | products_public_select má `qual: true` - chybí filtr is_deleted=false | Přidat do migrace 029 |
| **MEDIUM** | custom_itinerary_requests INSERT jen pro authenticated | Ověřit, zda frontend vždy používá anonymous auth |
| **LOW** | 13 policies s human_readable názvy (orders, order_items, custom_requests) | Unifikovat v migraci 029 |
| ✅ PASS | Všechny tabulky mají RLS zapnuto | - |
| ✅ PASS | Žádné RESTRICTIVE policies | - |
| ✅ PASS | Žádné reference na user_metadata | - |
| ✅ PASS | Všechny policies používají (SELECT ...) wrapper | - |
| ✅ PASS | custom_access_token_hook správně omezena | - |
| ✅ PASS | Helper funkce správně implementované (STABLE, search_path='') | - |
| ✅ PASS | Newsletter append-only design | - |
| ✅ PASS | Duplikáty jsou záměrné (role-based separation) | - |
