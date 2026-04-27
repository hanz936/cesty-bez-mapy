# Audit Část 3a+3b: Funkce bezpečnost, triggery, data integrita, performance

**Datum:** 2026-02-17 (SQL doplněk), 2026-02-15 (kódová analýza)
**Scope:** Bezpečnostní audit DB funkcí + triggery + data integrita + anonymous->permanent konverze + performance
**Metoda:** Analýza migračních souborů + SQL dotazy přes pg modul (run-sql.mjs) na živou DB

---

## 1. Bezpečnostní tabulka funkcí

### 1.1 Inventory funkcí v public schema (LIVE DATA - dotaz 3A)

| Funkce | Args | Return | SECURITY DEFINER | search_path | Volatilita |
|--------|------|--------|:---:|:---:|:---:|
| `is_admin()` | - | boolean | NE | `''` | STABLE ✅ |
| `is_permanent_user()` | - | boolean | NE | `''` | STABLE ✅ |
| `custom_access_token_hook(jsonb)` | event jsonb | jsonb | NE | `''` | STABLE ✅ |
| `handle_new_permanent_user()` | - | trigger | **ANO** | ⚠️ `public` | VOLATILE |
| `handle_new_user()` | - | trigger | **ANO** | `''` | VOLATILE |
| `handle_user_email_update()` | - | trigger | **ANO** | `''` | VOLATILE |
| `link_orders_to_customer()` | - | trigger | **ANO** | `''` | VOLATILE |
| `link_requests_to_customer()` | - | trigger | **ANO** | `''` | VOLATILE |
| `update_product_total_sales()` | - | trigger | NE | `''` | VOLATILE |
| `update_all_products_in_order()` | - | trigger | NE | `''` | VOLATILE |
| `cleanup_expired_tokens()` | - | void | **ANO** | `''` | VOLATILE |

**Celkem 11 funkcí** (10 očekávaných + 1 obsoletní `handle_new_user`)

### 1.2 SECURITY DEFINER audit (LIVE - dotaz 3C)

6 funkcí používá SECURITY DEFINER (5 očekávaných + handle_new_user):

1. `cleanup_expired_tokens()` - **NUTNÉ** (maže z download_tokens)
2. `handle_new_permanent_user()` - **NUTNÉ** (auth trigger → public.customers)
3. `handle_new_user()` - **OBSOLETNÍ** (měla být smazána v 026)
4. `handle_user_email_update()` - **NUTNÉ** (auth trigger → public.customers)
5. `link_orders_to_customer()` - **NUTNÉ** (trigger → public.orders)
6. `link_requests_to_customer()` - **NUTNÉ** (trigger → public.custom_itinerary_requests)

### 1.3 SECURITY DEFINER bez search_path (LIVE - dotaz 3D)

Dotaz 3D vrátil **(no rows)** - všechny SECURITY DEFINER funkce mají search_path nastavený.

**ALE:** `handle_new_permanent_user()` má `search_path=public` místo `search_path=''`. To je méně bezpečné:
- S `search_path=public` může útočník vytvořit škodlivou funkci/tabulku v public schema
- Riziko je nízké (funkce se volá pouze z auth triggeru), ale nekonzistentní se zbytkem

**Severity: LOW** (nekonzistence, ne přímá zranitelnost)

### 1.4 Volatilita (LIVE - dotaz 3E)

| Funkce | Aktuální | Správná | OK? |
|--------|:---:|:---:|:---:|
| `is_admin()` | STABLE | STABLE | ✅ |
| `is_permanent_user()` | STABLE | STABLE | ✅ |

### 1.5 GRANT EXECUTE (LIVE - dotaz 3F)

| Funkce | Grantees | Bezpečné? |
|--------|----------|:---:|
| `cleanup_expired_tokens()` | service_role, authenticated, anon, postgres, **PUBLIC** | ❌ |
| `custom_access_token_hook()` | postgres, supabase_auth_admin, service_role | ✅ |
| `handle_new_permanent_user()` | authenticated, service_role, **PUBLIC**, postgres, anon | ❌ |
| `handle_new_user()` | postgres, **PUBLIC**, service_role, authenticated, anon | ❌ |
| `handle_user_email_update()` | service_role, authenticated, **PUBLIC**, postgres, anon | ❌ |
| `is_admin()` | service_role, authenticated, anon, postgres, **PUBLIC** | ⚠️ |
| `is_permanent_user()` | **PUBLIC**, postgres, anon, authenticated, service_role | ⚠️ |
| `link_orders_to_customer()` | service_role, **PUBLIC**, postgres, anon, authenticated | ❌ |
| `link_requests_to_customer()` | **PUBLIC**, service_role, authenticated, anon, postgres | ❌ |
| `update_all_products_in_order()` | service_role, **PUBLIC**, postgres, anon, authenticated | ⚠️ |
| `update_product_total_sales()` | **PUBLIC**, authenticated, anon, postgres, service_role | ⚠️ |

**POTVRZENO:** 5 SECURITY DEFINER funkcí (cleanup, handle_new_permanent, handle_user_email, link_orders, link_requests) mají PUBLIC execute. Přímé zavolání by selhalo (chybí NEW record context pro trigger funkce), ale je to zbytečné riziko.

**custom_access_token_hook** je správně omezena na postgres, service_role, supabase_auth_admin.

**Severity: HIGH** - SECURITY DEFINER funkce by neměly být volatelné kýmkoliv.

### 1.6 pgTAP (LIVE - dotaz 3H)

**pgTAP není nainstalován.** `pgtap_installed = false`

---

## 2. Inventory triggerů + trigger chain analýza

### 2.1 Auth triggery na auth.users (LIVE - dotaz 3J)

| Trigger | Událost | Funkce |
|---------|---------|--------|
| `on_auth_user_created` | AFTER INSERT | `handle_new_permanent_user()` |
| `on_auth_user_email_set` | AFTER UPDATE OF email (WHEN old.email IS DISTINCT FROM new.email) | `handle_user_email_update()` |

**Poznámka:** Trigger `on_auth_user_created` volá `handle_new_permanent_user()`, NE `handle_new_user()`. Obsoletní `handle_new_user()` **není napojena na žádný trigger**, ale stále existuje v DB.

### 2.2 Public triggery (LIVE - dotaz 3I)

| Trigger | Tabulka | Událost | Funkce |
|---------|---------|---------|--------|
| `handle_blog_posts_updated_at` | blog_posts | BEFORE UPDATE | moddatetime('updated_at') |
| `handle_categories_updated_at` | categories | BEFORE UPDATE | moddatetime('updated_at') |
| `handle_custom_requests_updated_at` | custom_itinerary_requests | BEFORE UPDATE | moddatetime('updated_at') |
| `handle_customers_updated_at` | customers | BEFORE UPDATE | moddatetime('updated_at') |
| `on_customer_created` | customers | AFTER INSERT | link_requests_to_customer() |
| `on_customer_created_link_orders` | customers | AFTER INSERT | link_orders_to_customer() |
| `update_total_sales_on_order_item_change` | order_items | AFTER INSERT/UPDATE/DELETE | update_product_total_sales() |
| `handle_orders_updated_at` | orders | BEFORE UPDATE | moddatetime('updated_at') |
| `update_total_sales_on_order_status_change` | orders | AFTER UPDATE | update_all_products_in_order() |
| `handle_products_updated_at` | products | BEFORE UPDATE | moddatetime('updated_at') |

**moddatetime triggery:** 6 tabulek (blog_posts, categories, custom_itinerary_requests, customers, orders, products) - **kompletní**.

### 2.3 Trigger chain analýza

#### Chain 1: Registrace permanentního uživatele
```
auth.users INSERT
  → on_auth_user_created
    → handle_new_permanent_user()
      IF anonymous: SKIP (RAISE NOTICE)
      IF non-anonymous + email:
        INSERT customers (id=NEW.id, email, name) ON CONFLICT DO NOTHING
          → on_customer_created → link_requests_to_customer()
          → on_customer_created_link_orders → link_orders_to_customer()
```

#### Chain 2: Upgrade anonymous → permanent (email set)
```
auth.users UPDATE OF email
  → on_auth_user_email_set (WHEN old.email IS DISTINCT FROM new.email)
    → handle_user_email_update()
      IF OLD.email IS NULL AND NEW.email IS NOT NULL:
        INSERT customers ON CONFLICT DO UPDATE (email, name, updated_at)
          → customer triggers (pokud INSERT)
```

#### Chain 3: Order status change → total_sales
```
orders UPDATE
  → update_total_sales_on_order_status_change
    → update_all_products_in_order() - recalculate all products in order
```

#### Chain 4: Order item change → total_sales
```
order_items INSERT/UPDATE/DELETE
  → update_total_sales_on_order_item_change
    → update_product_total_sales() - recalculate single product
```

**POZNÁMKA K CHYBĚJÍCÍMU user_roles INSERT:** Kódová analýza z migrace 013 uvádí, že `handle_new_permanent_user()` by měla insertovat do user_roles. **LIVE DATA ukazuje, že funkce to NEDĚLÁ** - aktuální verze funkce pouze insertuje do customers. `handle_new_user()` (obsoletní) dělá INSERT do user_roles, ale **není napojena na žádný trigger**. To znamená:
- Noví uživatelé **nedostávají** záznam v user_roles
- `is_admin()` funguje přes JWT claims z custom_access_token_hook, který čte user_roles
- Admin musí být přidán manuálně do user_roles

---

## 3. Data integrita (LIVE DATA)

### 3.1 total_sales integrita (dotaz 3L) ✅

**Výsledek: Žádné nesrovnalosti.** Všechny products mají správný total_sales.

### 3.2 Permanentní uživatelé bez customers záznamu (dotaz 3M) ✅

**Výsledek: Žádní.** Všichni permanentní uživatelé mají customer záznam.

### 3.3 Osiřelí customers bez auth.users (dotaz 3N) ❌

**Výsledek: 1 osiřelý customer nalezen:**

| ID | Email |
|----|-------|
| `6f2a0989-dbe7-4915-8cff-c13dfa0ccaf1` | novakova.jana22@seznam.cz |

**Analýza:** Tento customer byl vytvořen stripe-webhookem s `crypto.randomUUID()` místo skutečného auth.users ID. Potvrzuje CRITICAL nález z Části 4 (customer ID collision). FK constraint customers→auth.users chybí (migrace 026 neaplikována), proto záznam existuje.

**Severity: CRITICAL** (datová nekonzistence, potvrzuje 026 migration drift)

### 3.4 Expirované download tokeny (dotaz 3O) ✅

**Výsledek: 0 expirovaných tokenů.** Buď nebyly vytvořeny, nebo byly vyčištěny.

### 3.5 FK indexy (dotaz 3R) ✅

**Výsledek: Všechny FK sloupce jsou indexovány.** Žádné chybějící indexy.

### 3.6 Nepoužívané indexy (dotaz 3Q)

**Výsledek: 30 indexů s 0 scany:**

| Tabulka | Index | Scany | Velikost |
|---------|-------|:---:|---------|
| blog_posts | blog_posts_slug_key | 0 | 8 kB |
| blog_posts | idx_blog_posts_published_at | 0 | 8 kB |
| categories | categories_slug_key | 0 | 16 kB |
| custom_itinerary_requests | idx_custom_requests_customer_email | 0 | 16 kB |
| custom_itinerary_requests | idx_custom_requests_status | 0 | 16 kB |
| custom_itinerary_requests | idx_custom_requests_form_data (GIN) | 0 | 24 kB |
| customers | idx_customers_last_purchase_at | 0 | 16 kB |
| download_tokens | idx_download_tokens_token + download_tokens_token_key | 0+0 | 16 kB |
| integration_logs | 4 indexy (status, created_at, metadata GIN, service) | 0 | 40 kB |
| newsletter_consent_log | 3 indexy (created_at, email, active) | 0 | 24 kB |
| order_items | idx_order_items_custom_request_id | 0 | 8 kB |
| orders | idx_orders_auth_user_id, idx_orders_pending, stripe_payment_id_key | 0 | 40 kB |
| products | 9 indexů (quiz_data, is_active, is_deleted, deleted_at, stripe IDs, gallery, rating, category, total_sales) | 0 | ~160 kB |

**Celkem ~400 kB nevyužitých indexů.**

**Analýza:** Aplikace je ve velmi rané fázi (6 objednávek, 6 produktů, 0 blog postů). Nulové scany jsou důsledkem malého provozu, ne špatného návrhu. **NEMAZAT** - indexy budou potřeba při produkčním provozu.

**Duplicitní index:** `download_tokens_token_key` (UNIQUE constraint) a `idx_download_tokens_token` - tyto jsou duplicitní. `idx_download_tokens_token` může být smazán.

**GIN indexy k přehodnocení** až při větším provozu: quiz_data, gallery_images, form_data, metadata.

### 3.7 Velikosti tabulek (dotaz 3P)

| Tabulka | Řádky | Celk. velikost |
|---------|:---:|---------|
| order_items | 9 | 64 kB |
| orders | 6 | 152 kB |
| products | 6 | 280 kB |
| customers | 3 | 64 kB |
| categories | 3 | 48 kB |
| custom_itinerary_requests | 3 | 136 kB |
| user_roles | 0* | 64 kB |
| download_tokens | 0 | 48 kB |
| integration_logs | 0 | 56 kB |
| newsletter_consent_log | 0 | 40 kB |
| blog_posts | 0 | 40 kB |

*`user_roles` ukazuje 0 live_tup (pg_stat může být stale po VACUUM). Admin panel funguje, takže minimálně 1 řádek existuje.

---

## 4. Anonymous uživatelé (LIVE DATA)

### 4.1 Anonymous users v systému (dotaz 3S)

**2 anonymní uživatelé:**

| ID | Vytvořen | Email |
|----|----------|-------|
| `4d3f8f2f...` | 2026-01-19 | null |
| `cdd503bb...` | 2026-01-18 | null |

### 4.2 Objednávky anonymních uživatelů (dotaz 3T)

**6 completed objednávek od anonymních uživatelů:**

| Order ID | User | Status |
|----------|------|--------|
| `2644c5ef...` | `4d3f8f2f` (anon) | completed |
| `5f6be809...` | `cdd503bb` (anon) | completed |
| `4a157bc0...` | `cdd503bb` (anon) | completed |
| `dc42690d...` | `cdd503bb` (anon) | completed |
| `7c966396...` | `cdd503bb` (anon) | completed |
| `5cf0b301...` | `cdd503bb` (anon) | completed |

**Dopad:** Tyto objednávky patří anonymním uživatelům, kteří nikdy neupgradovali na permanentní účet. Nemají email v auth.users, takže `link_orders_to_customer()` je nemůže přilinkovat.

### 4.3 Custom requests anonymních uživatelů (dotaz 3U)

**2 custom requests od anonymních uživatelů:**

| Request ID | User | Status |
|------------|------|--------|
| `b490e719...` | `4d3f8f2f` (anon) | new |
| `f6f1d85a...` | `4d3f8f2f` (anon) | new |

### 4.4 Všichni uživatelé (celkový přehled)

| ID | Typ | Email | Vytvořen |
|----|-----|-------|----------|
| `4d3f8f2f...` | anonymous | - | 2026-01-19 |
| `cdd503bb...` | anonymous | - | 2026-01-18 |
| `a2ca0374...` | permanent | cestybezmapy@gmail.com | 2025-11-11 |
| `1ee9325e...` | permanent | parma29@seznam.cz | 2025-11-09 |

---

## 5. Performance (LIVE DATA - dotazy 3W-3Z)

### 5.1 Products listing (3W)

```
Seq Scan on products (0.016ms, 6 rows, 3 buffer hits)
Sort: quicksort, 29kB memory
Total: 0.141ms execution
```

**Seq Scan je OK** - pouze 6 řádků, index by byl pomalejší.

### 5.2 Blog posts published (3Z)

```
Seq Scan on blog_posts (0.010ms, 0 rows, 3 buffer hits)
Total: 0.130ms execution
```

**OK** - 0 řádků, tabulka prázdná.

### 5.3 Custom itinerary requests (3Y)

```
Index Scan using idx_custom_requests_created_at (0.635ms, 3 rows, 2 buffer hits)
Total: 0.683ms execution
```

**OK** - Index Scan použit správně.

### Performance shrnutí

Všechny dotazy pod 1ms. Tabulky jsou malé (max 9 řádků), takže Seq Scan vs Index Scan nemá vliv. **Performance je bezproblémová** na současném objemu dat. Benchmarking bude relevantní až při stovkách/tisících řádků.

**Poznámka:** Tyto dotazy běží jako superuser (service_role), RLS overhead není započítán.

---

## 6. Anonymous → permanent konverzní flow

### 6.1 Frontend flow

1. **Checkout.jsx:** Při checkoutu `supabase.auth.signInAnonymously()` (pokud nepřihlášen)
2. `userId` se posílá do `create-checkout-session` edge function
3. **Žádná explicitní konverze** anonymous → permanent v checkout flow
4. Cart v localStorage, ne v DB

### 6.2 Konverzní trigger chain

Trigger `on_auth_user_email_set` (po email update) → `handle_user_email_update()`:
- Detekuje `OLD.email IS NULL AND NEW.email IS NOT NULL`
- INSERT/UPDATE customer, spustí linking chain

**Trigger ale funguje pouze pokud** se zavolá `supabase.auth.updateUser({ email })`. **Frontend toto nedělá.**

### 6.3 Checklist

| Kontrola | Stav | Poznámka |
|----------|:---:|---------|
| handle_new_permanent_user() detekuje konverzi | ✅ | Skipuje anonymous usery |
| handle_user_email_update() detekuje konverzi | ✅ | OLD.email IS NULL → NEW.email |
| link_orders_to_customer() přelinkuje objednávky | ✅ | Email matching, customer_id IS NULL |
| link_requests_to_customer() přelinkuje requests | ✅ | auth_user_id matching |
| Customer se vytvoří při konverzi | ✅ | INSERT ON CONFLICT DO UPDATE |
| Race condition | ✅ | Každý anonymous user má jiný UUID |
| Download tokens po konverzi | ✅ | Vázané na order_id |
| **Osiřelí anonymous uživatelé** | **❌** | 2 anonymní, 6 objednávek, žádný cleanup |
| **Frontend konverze** | **❌** | Checkout nevyžaduje registraci |

---

## 7. Nalezené problémy

### CRITICAL

| # | Problém | Detail |
|---|---------|--------|
| C1 | Osiřelý customer bez auth.users | ID `6f2a0989` (stripe-webhook crypto.randomUUID collision) - potvrzuje Část 4 nález |

### HIGH

| # | Problém | Detail | Doporučení |
|---|---------|--------|------------|
| H1 | SECURITY DEFINER funkce mají PUBLIC execute | 5 trigger funkcí (handle_new_permanent, handle_user_email, link_orders, link_requests, cleanup_tokens) + obsoletní handle_new_user | `REVOKE EXECUTE FROM PUBLIC, anon, authenticated;` |
| H2 | handle_new_user() stále existuje | Obsoletní, SECURITY DEFINER, volatelná kýmkoliv, není napojena na trigger | `DROP FUNCTION handle_new_user();` |
| H3 | Žádný cleanup anonymních uživatelů | 2 anonymní s 6 completed objednávkami, nemají email | Implementovat cleanup nebo konverzní flow |

### MEDIUM

| # | Problém | Detail | Doporučení |
|---|---------|--------|------------|
| M1 | handle_new_permanent_user search_path=public | Nekonzistentní se zbytkem (search_path='') | Změnit na `SET search_path = ''` |
| M2 | cleanup_expired_tokens: bare table name | `DELETE FROM download_tokens` se search_path='' - může selhat | Změnit na `DELETE FROM public.download_tokens` |
| M3 | pg_cron nefunguje na Free tieru | cleanup_expired_tokens není automaticky volaná | Po upgrade na Pro aktivovat, do té doby manuálně |
| M4 | Chybějící frontend konverze anonymous→permanent | Checkout nevyžaduje registraci | Přidat registrační krok po zaplacení |
| M5 | link_orders_to_customer používá email matching | Pokud uživatel změní email, staré objednávky zůstanou nelinkované | Zvážit auth_user_id matching |
| M6 | Duplicitní index na download_tokens.token | download_tokens_token_key + idx_download_tokens_token | Smazat idx_download_tokens_token |

### LOW

| # | Problém | Detail |
|---|---------|--------|
| L1 | 30 nepoužívaných indexů | Malý provoz, budou potřeba později |
| L2 | GIN indexy na quiz_data, gallery_images, form_data, metadata | Přehodnotit při větším provozu |

---

## 8. Celkové hodnocení

**Bezpečnost funkcí:** DOBRÁ s výhradami - search_path nastaveno (až na handle_new_permanent_user), SECURITY DEFINER oprávněné, ale **chybí REVOKE EXECUTE** na trigger funkcích.

**Triggery:** DOBRÉ - chain je logicky správný, deterministický, pokrývá všechny životní cykly.

**Data integrita:** ✅ total_sales OK, ❌ 1 osiřelý customer (stripe-webhook bug)

**Performance:** ✅ Vše pod 1ms, indexy správně navrženy pro budoucí růst.

**Anonymous→permanent:** Backend triggery fungují, ale **frontend konverzi nespouští**. 2 anonymní uživatelé s 6+2 záznamy bez možnosti propojení.
