# Audit Část 1a: Schema SQL verifikace

**Datum:** 2026-02-16
**Metoda:** Přímé SQL dotazy přes pg modul (run-sql.mjs) na živou DB

---

## Checklist

| # | Kontrola | Stav | Poznámka |
|---|----------|------|----------|
| 1 | 11 tabulek existuje | ✅ | blog_posts, categories, custom_itinerary_requests, customers, download_tokens, integration_logs, newsletter_consent_log, order_items, orders, products, user_roles |
| 2 | product_categories neexistuje | ✅ | Dropnuta v 009 |
| 3 | CHECK constrainty orders | ✅ | pending\|completed\|failed\|refunded + total_amount >= 0 |
| 4 | CHECK constrainty custom_requests | ✅ | new\|paid\|in_progress\|completed\|cancelled |
| 5 | FK customers.id → auth.users.id | ❌ | **CHYBÍ** - migrace 026 nebyla aplikována na live DB |
| 6 | orders.stripe_payment_id nullable | ❌ | **NOT NULL** - migrace 026 nebyla aplikována |
| 7 | orders.customer_name nullable | ❌ | **NOT NULL** - migrace 026 nebyla aplikována |
| 8 | customers.id nemá DEFAULT gen_random_uuid() | ✅ | column_default = null |
| 9 | handle_new_user() neexistuje | ❌ | **STÁLE EXISTUJE** - měla být smazána v 026 |
| 10 | ~35 indexů | ✅ | 58 indexů nalezeno (víc než očekáváno) |
| 11 | pg_cron | ✅ N/A | Není nainstalován (Free plan) |
| 12 | 3 storage buckety | ✅ | products-pdfs (private, 50MB), products-images (public, 10MB), blog-images (public, 10MB) |
| 13 | Všechny tabulky mají RLS | ✅ | Všech 11 tabulek má rowsecurity=true |
| 14 | Extensions | ✅ | moddatetime, pgcrypto v extensions schema (ne public) |

---

## CRITICAL: Migrace 026-028 nebyly aplikovány na produkční DB

Na základě SQL dotazů je jasné, že migrace 026, 027 a 028 **existují jako soubory**, ale **nebyly aplikovány** na živou databázi:

### Důkazy:
1. `handle_new_user()` stále existuje (026 ji měla smazat)
2. FK `customers.id → auth.users.id` neexistuje (026 ji měla vytvořit)
3. `orders.stripe_payment_id` je NOT NULL (026 měla změnit na nullable)
4. `orders.customer_name` je NOT NULL (026 měla změnit na nullable)
5. `migration list --linked` ukazuje migrace jen jako "Local" čísla, ne s remote timestampy

### Dopad:
- **CRITICAL** - DB schema neodpovídá kódu. Edge functions a frontend mohou spoléhat na sloupce/constrainty, které neexistují
- Guest checkout pravděpodobně nefunguje (stripe_payment_id je NOT NULL ale webhook ho nemusí mít hned)
- Anonymní→permanentní konverze nefunguje (chybí trigger chain z 026)

### Severity: CRITICAL

---

## Tabulky - přehled

| Tabulka | Sloupců | PK | FK | UNIQUE | CHECK |
|---------|---------|----|----|--------|-------|
| blog_posts | 11 | id | - | slug | - |
| categories | 5 | id | - | slug | - |
| custom_itinerary_requests | 10 | id | customer_id→customers, auth_user_id→auth.users | - | status |
| customers | 9 | id | - | email | - |
| download_tokens | 5 | id | order_id→orders | token | - |
| integration_logs | 7 | id | - | - | - |
| newsletter_consent_log | 8 | id | - | - | - |
| order_items | 8 | id | order_id→orders, product_id→products, custom_itinerary_request_id→custom_requests | - | - |
| orders | 14 | id | customer_id→customers, auth_user_id→auth.users | stripe_payment_id | status, total_amount≥0 |
| products | 31 | id | - | slug (conditional) | - |
| user_roles | 4 | id | user_id→auth.users | (user_id, role) | - |

## Funkce v public schema

| Funkce | Typ | Poznámka |
|--------|-----|----------|
| cleanup_expired_tokens() | f | OK |
| custom_access_token_hook(jsonb) | f | OK |
| handle_new_permanent_user() | f | OK |
| **handle_new_user()** | f | ❌ Měla být smazána v 026 |
| handle_user_email_update() | f | OK |
| is_admin() | f | OK |
| is_permanent_user() | f | OK |
| link_orders_to_customer() | f | OK |
| link_requests_to_customer() | f | OK |
| update_all_products_in_order() | f | OK |
| update_product_total_sales() | f | OK |

## Indexy

Celkem **58 indexů** (očekáváno ~35). Výrazně více, ale většina je oprávněná:
- products: 15 indexů (31 sloupců, hodně filtrovacích atributů)
- orders: 8 indexů
- custom_itinerary_requests: 7 indexů
- Parciální a GIN indexy jsou správně použité

## Storage buckety

| Bucket | Veřejný | Limit | MIME typy |
|--------|---------|-------|-----------|
| blog-images | ✅ public | 10 MB | jpeg, png, webp |
| products-images | ✅ public | 10 MB | jpeg, png, webp |
| products-pdfs | ❌ private | **50 MB** (plán říká 200MB) | pdf |

⚠️ products-pdfs limit je 50MB, ne 200MB jak uvádí dokumentace.

## Schema drift

Nelze ověřit (`supabase db diff --linked` vyžaduje Docker). Ale na základě zjištění o neaplikovaných migracích je drift **jistý**.

## CLI lint

Nelze spustit (`supabase db lint --linked` vyžaduje Docker). TODO pro manuální kontrolu.

---

## Shrnutí problémů

| Severity | Problém |
|----------|---------|
| **CRITICAL** | Migrace 026-028 nebyly aplikovány na produkční DB - schema drift |
| **HIGH** | handle_new_user() stále existuje (obsoletní funkce) |
| **MEDIUM** | products-pdfs limit 50MB vs dokumentovaných 200MB |
| **LOW** | 58 indexů místo ~35 (většina oprávněných, zkontrolovat nepoužívané) |
