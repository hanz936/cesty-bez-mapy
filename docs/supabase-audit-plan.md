# Kompletní audit Supabase databáze a infrastruktury

## Přehled

Systematický audit celé Supabase infrastruktury rozdělený do 15 částí. Každá část je spustitelná v samostatném okně Claude Code s omezeným kontextem.

**Části:** 0, 1a, 1b, 2a, 2b, 3a, 3b, 4, 5a-i, 5a-ii, 5b, 6, 7, 8, 9

**Aktuální stav:** Free plan, jedno prostředí (production), bez Realtime, 28 migrací, 11 tabulek, ~50 RLS policies, 5 edge functions, 3 storage buckety.

**Data v DB:** Mix reálných a testovacích dat (reální admini, Roadtrip po Itálii, itineráře na míru; ostatní produkty a zakázky testovací). Všechny změny v DB MUSÍ být bezpečné (ROLLBACK u testů).

**Audit reporty:** Ukládat do `cesty-bez-mapy/docs/audit-results/cast-X-nazev.md`.

**pgTAP:** Stav neznámý - ověřit dostupnost v Části 3a, pokud není k dispozici, použít alternativní testovací přístup.

## Projekty

- **Main app:** `/Users/janparma/Desktop/Projekty/cesty-bez-mapy`
- **Admin panel:** `/Users/janparma/Desktop/Projekty/cesty-bez-mapy-admin`
- **Supabase ref:** `dkblgznhnixubyoghrqe`

### Supabase CLI - DŮLEŽITÉ

**Stav:** V projektu NEEXISTUJE `supabase/config.toml` ani `.supabase/` adresář. Před spuštěním jakýchkoliv CLI příkazů je nutné:

```bash
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy
supabase init  # vytvoří config.toml (pokud ještě neexistuje)
supabase link --project-ref dkblgznhnixubyoghrqe
```

Teprve poté lze spouštět `supabase db query --linked`, `supabase db lint --linked` atd.

## Pořadí spuštění

```
Část 0 (Verify + Hotfix + CLI setup)
  │
  ├──→ Část 1a (Schema SQL verifikace) ──→ Část 1b (Migrační review + storage lifecycle)
  │
  ├──→ Část 2a (RLS inventory) ──→ Část 2b (RLS fixy + 029)
  ├──→ Část 3a (Funkce bezpečnost)
  ├──→ Část 3b (Triggery + data integrita + user konverze)
  ├──→ Část 4 (Edge Functions + rate limiting audit)
  │
  ├──→ Část 5a-i (Admin: auth + data provider + audit trail) [ideálně po 2a+4]
  ├──→ Část 5a-ii (Admin: resource soubory) [ideálně po 2a+4]
  ├──→ Část 5b (E-shop frontend) [ideálně po 2a+4]
  │
  ├──→ Část 6 (Infra + dependencies + backup + monitoring)
  ├──→ Část 8 (Stripe integrace + E2E test)
  ├──→ Část 9 (GDPR)
  │
  └──→ Část 7 (Dokumentace) [POSLEDNÍ]
```

**Paralelizace:** Po Části 0 mohou Části 1a, 2a, 3a, 3b, 4 běžet paralelně. Část 1b až po 1a (závisí na jejím reportu). Části 5a-i + 5a-ii + 5b ideálně po Části 2a a 4. Část 7 až nakonec.

---

## Exekuční strategie: Subagenti

### Princip
Každá Část běží v **samostatné Claude Code konverzaci** (čistý kontext). Hlavní agent funguje jako **orchestrátor** - deleguje těžkou práci (čtení souborů, SQL dotazy) na subagenty a sám se soustředí na:
1. Spouštění subagentů (paralelně kde je to možné)
2. Syntézu výsledků
3. Identifikaci problémů
4. Psaní reportu

Tím se kontext hlavního agenta nezaplní raw daty a zůstane prostor pro analýzu.

### Subagent plán po Částech

| Část | Subagenti | Strategie |
|------|-----------|-----------|
| **0** | 1× Explore | Explore přečte 3 edge functions a identifikuje kód k opravě. Hlavní agent VERIFIKUJE problémy, pak aplikuje fixy + CLI setup. |
| **1a** | 3× Bash | **Bash 1:** SQL batch A (tabulky, sloupce, constrainty, indexy = dotazy 1A-1E). **Bash 2:** SQL batch B (funkce, extensions, storage, RLS status = dotazy 1F-1Q). **Bash 3:** CLI příkazy (db diff, migration list, db lint). Všechny 3 paralelně. Hlavní agent kompiluje checklist + report. |
| **1b** | 2× Explore + 1× Bash | **Explore 1:** MIGRATIONS.md + klíčové migrace (013, 024-028). **Explore 2:** ARCHITECTURE_DECISIONS.md + get-download-url/index.ts. **Bash:** Storage SQL dotazy (1R, 1S). Hlavní agent porovnává s Cast 1a reportem. |
| **2a** | 1× Bash + 1× Explore + 1× Bash | **Bash 1:** Všechny RLS SQL dotazy (2A-2N). **Explore:** Čtení RLS dokumentů (audit-v2, unification proposal, audit prompt, MIGRATIONS.md s5). **Bash 2:** `supabase db lint`. Hlavní agent staví policy matici + gap analýzu. |
| **2b** | 1× Explore | Explore přečte 2a report + RLS_UNIFICATION_PROPOSAL.md. Hlavní agent píše migraci 029 + testy. |
| **3a** | 1× Bash | Bash spustí všechny function SQL dotazy (3A-3H). Hlavní agent analyzuje bezpečnostní atributy + píše report. |
| **3b** | 1× Bash + 2× Explore | **Bash:** Trigger + integrity + EXPLAIN ANALYZE SQL dotazy (3I-3Z). **Explore 1:** CartContext.jsx + Checkout.jsx (anonymous→permanent flow). **Explore 2:** MIGRATIONS.md sekce 6 (triggers). Hlavní agent analyzuje trigger chain + data integrity + performance. |
| **4** | 3× Explore + 1× Bash | **Explore 1:** create-checkout-session + create-stripe-product (POST-FIX, menší soubory). **Explore 2:** stripe-webhook (391 řádků, potřebuje vlastní kontext). **Explore 3:** get-download-url + get-order-by-session. **Bash:** Rate limiting SQL dotazy (4-RATE). Hlavní agent kompiluje bezpečnostní matici. |
| **5a-i** | 2× Explore + 1× Bash | **Explore 1:** Auth soubory (MFAWrapper, MFAEnroll, MFAVerify). **Explore 2:** Data provider + storage (withStorageUpload, withStripeSync, storageUtils, App.tsx). **Bash:** Audit trail SQL dotazy (5-AUDIT). |
| **5a-ii** | 3× Explore | **Explore 1:** products/ (4 soubory vč. ImageGalleryInput) + categories/ (3 soubory). **Explore 2:** orders/ + customers/ (4 soubory). **Explore 3:** blog-posts/ (3 soubory) + custom_requests/ (2 soubory). |
| **5b** | 4× Explore | **Explore 1:** Checkout.jsx + OrderConfirmation.jsx + CartContext.jsx. **Explore 2:** CustomItineraryForm.jsx (45KB) - POUZE tento soubor. **Explore 3:** CustomItineraryPreview.jsx + ProductDetail.jsx + TravelGuides.jsx. **Explore 4:** Contact.jsx + PlanYourDreamTrip.jsx + ItalyRoadtripDetail.jsx + SalzburgItinerary.jsx. |
| **6** | 2× Bash + 1× Explore | **Bash 1:** npm audit obou projektů + verze + git history secrets scan. **Bash 2:** SQL dotazy (extensions, realtime, db size, connections) + backup test. **Explore:** Deno importy ve všech edge functions + deno.json + error tracking search. |
| **7** | 3× Explore | **Explore 1:** MIGRATIONS.md + rls-policies-audit-v2.md + RLS_UNIFICATION_PROPOSAL.md. **Explore 2:** ARCHITECTURE_DECISIONS.md + CUSTOM_ITINERARY_IMPLEMENTATION.md + RLS_AUDIT_PROMPT.md. **Explore 3:** Oba CLAUDE.md + docs/rls-policies-audit.md (v1). |
| **8** | 1× Bash + 1× Explore + 1× Bash | **Bash 1:** Stripe SQL dotazy (8A-8H). **Explore:** withStripeSync.ts + relevantní části edge functions. **Bash 2:** Stripe CLI příkazy + webhook verifikace. |
| **9** | 1× Bash + 2× Explore | **Bash:** GDPR SQL dotazy (9A-9F). **Explore 1:** CustomItineraryForm.jsx + Contact.jsx + customers resource. **Explore 2:** Search analytics/tracking/cookies across oba projekty. |

### Celkem: ~41 subagentů napříč 14 Částmi

### Pravidla pro subagenty
1. **Paralelní spouštění:** V každé Části spustit všechny subagenty NAJEDNOU v jedné zprávě (ne sekvenčně)
2. **Specifické prompty:** Každý subagent dostane přesný seznam souborů/dotazů + co má hledat
3. **Výstup subagenta:** Strukturovaný report s nálezy, ne raw data
4. **Hlavní agent neduplikuje:** Nikdy nečte soubory, které už přečetl subagent
5. **Report píše hlavní agent:** Na základě syntézy výstupů subagentů

### Prompt šablona pro subagenty

```
Jsi součástí auditu Supabase infrastruktury (Část X).
Tvůj úkol: [specifický úkol]

Soubory k přečtení: [seznam]
SQL dotazy k spuštění: [seznam]

Hledej tyto problémy:
- [specifické bezpečnostní/funkční problémy]

Výstup: Strukturovaný report s nálezy (CRITICAL/HIGH/MEDIUM/LOW severity).
Nepiš raw kód - piš shrnutí nálezů s řádkovými referencemi.
```

---

## ČÁST 0: Verifikace + Hotfix kritických bezpečnostních issues + CLI setup

**Cíl:** NEJDŘÍV OVĚŘIT 3 předpokládané kritické bezpečnostní díry v edge functions, pak opravit potvrzené. Nastavit Supabase CLI.

**DŮLEŽITÉ:** Předpokládané problémy pochází z předchozí analýzy a nemusí odpovídat realitě. Před jakýmkoliv fixem je NUTNÉ ověřit v kódu. Pokud problém neexistuje, dokumentovat jako false positive.

### Předpoklad: CLI setup

```bash
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy
supabase init  # pokud config.toml neexistuje
supabase link --project-ref dkblgznhnixubyoghrqe
supabase migration list --linked  # ověřit spojení
```

Vytvořit adresář pro reporty:
```bash
mkdir -p /Users/janparma/Desktop/Projekty/cesty-bez-mapy/docs/audit-results
```

### Admin projekt: supabase/ cleanup

V admin projektu existuje netrackovaný `supabase/` adresář obsahující pouze `.temp/` CLI cache (project-ref: `dkblgznhnixubyoghrqe`). Vznikl pravděpodobně při předchozím `supabase link` v admin projektu.

**Akce:**
1. Přidat `supabase/.temp/` do `.gitignore` admin projektu (pokud tam ještě není)
2. Ověřit že admin projekt NEMÁ vlastní `config.toml` nebo migrace (nemá - potvrzeno)
3. Všechny CLI příkazy (`supabase db query`, `supabase migration`, `supabase functions deploy`) spouštět VŽDY z main app adresáře, kde jsou migrace a edge functions

```bash
# Přidat do .gitignore admin projektu
echo "supabase/.temp/" >> /Users/janparma/Desktop/Projekty/cesty-bez-mapy-admin/.gitignore
```

### Předpokládané issues k verifikaci

**1. KRITICKÉ? - create-checkout-session: user_id spoofing**
- Soubor: `supabase/functions/create-checkout-session/index.ts`
- Předpoklad: user_id se posílá v request body z klienta - spoofovatelné
- Očekávaný fix: Extrahovat user_id z JWT auth headeru (Authorization: Bearer) na serveru
- Dopad pokud potvrzeno: Útočník může vytvořit objednávku pod cizím user_id

**2. KRITICKÉ? - stripe-webhook: customer ID kolize**
- Soubor: `supabase/functions/stripe-webhook/index.ts`
- Předpoklad: Vytváří customers s `crypto.randomUUID()` jako ID. Koliduje s architekturou `customers.id = auth.users.id` (migrace 013, 026 FK)
- Očekávaný fix: Použít `auth.users.id` pokud user existuje, nebo nechat bez customer záznamu pro guest checkout
- Dopad pokud potvrzeno: Orphaned customers, FK violations

**3. VYSOKÉ? - create-stripe-product: chybějící admin autorizace**
- Soubor: `supabase/functions/create-stripe-product/index.ts`
- Předpoklad: Neverifikuje admin roli volajícího
- Očekávaný fix: Přidat kontrolu `is_admin()` nebo JWT claims check na začátek funkce
- Dopad pokud potvrzeno: Jakýkoliv přihlášený uživatel může vytvořit/modifikovat Stripe produkty

### Postup
1. Ověřit CLI linkování (viz výše)
2. Přečíst všechny 3 edge function soubory
3. **VERIFY** - Pro každý předpokládaný problém: existuje? Jak přesně vypadá v kódu?
4. **Zachytit originální kód** v reportu PŘED jakýmkoliv fixem (Část 4 pak audituje opravenou verzi)
5. Implementovat fixy POUZE pro potvrzené problémy
6. Dokumentovat false positives (pokud nějaké jsou)
7. Otestovat (`supabase functions serve` lokálně, pokud možné)
8. **Deploy a verifikace (POUZE pokud existují potvrzené fixy):**

```bash
# 1. Deploy opravené funkce
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy
supabase functions deploy <název-funkce> --linked

# 2. Ověřit deployment - funkce je dostupná
curl -s -o /dev/null -w "%{http_code}" \
  https://dkblgznhnixubyoghrqe.supabase.co/functions/v1/<název-funkce>
# Očekávat: 401 (Unauthorized) nebo 400 (Bad Request) = funkce běží
# 5xx = deployment selhal

# 3. Ověřit v logách (posledních 5 minut)
supabase functions logs <název-funkce> --linked --limit 10

# 4. Smoke test (kde je to bezpečné):
# - create-stripe-product: nelze testovat bez admin JWT
# - create-checkout-session: lze testovat s invalid daty (očekávat 400)
# - stripe-webhook: nelze testovat bez Stripe signature
```

**Rollback pokud deployment selže:**
```bash
# Git revert na původní verzi souboru
git checkout HEAD -- supabase/functions/<název-funkce>/index.ts
supabase functions deploy <název-funkce> --linked
```

**Report MUSÍ dokumentovat pro každý issue:**
- POTVRZENO + popis fixu + deployment status + verifikace
- nebo FALSE POSITIVE + zdůvodnění

### Výstup
- Opravené edge functions (jen soubory s potvrzenými problémy)
- Report: `docs/audit-results/cast-0-hotfix.md` (vč. originálního kódu a zdůvodnění)

---

## ČÁST 1a: Schema verifikace (SQL dotazy na živou DB)

**Cíl:** Získat ground truth o aktuálním stavu schématu přímo z DB. Žádné čtení souborů - pouze SQL dotazy a CLI příkazy.

### SQL dotazy

```sql
-- 1A. Historie migrací
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version;

-- 1B. Všechny tabulky v public schema
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- 1C. Kompletní inventory sloupců
SELECT table_name, column_name, data_type, column_default, is_nullable,
  character_maximum_length
FROM information_schema.columns WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 1D. Všechny constrainty (FK, CHECK, UNIQUE, PK)
SELECT tc.table_name, tc.constraint_name, tc.constraint_type, kcu.column_name,
  ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_schema = 'public' ORDER BY tc.table_name, tc.constraint_type;

-- 1E. Všechny indexy (dokumentace říká ~35)
SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' ORDER BY tablename, indexname;

-- 1F. CHECK constrainty na klíčových tabulkách
SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid IN ('public.orders'::regclass, 'public.custom_itinerary_requests'::regclass)
AND contype = 'c';

-- 1G. FK customers -> auth.users (migrace 026)
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'public.customers'::regclass AND contype = 'f';

-- 1H. Nullable sloupce v orders (migrace 026/027)
SELECT column_name, is_nullable, column_default FROM information_schema.columns
WHERE table_name = 'orders' AND column_name IN ('stripe_payment_id', 'customer_name');

-- 1I. Customers.id nemá DEFAULT gen_random_uuid() (migrace 013)
SELECT column_name, column_default FROM information_schema.columns
WHERE table_name = 'customers' AND column_name = 'id';

-- 1J. Všechny funkce v public schema
SELECT proname, prokind, pg_get_function_identity_arguments(oid) AS args
FROM pg_proc WHERE pronamespace = 'public'::regnamespace ORDER BY proname;

-- 1K. Nainstalované extensions
SELECT extname, extversion, extnamespace::regnamespace AS schema FROM pg_extension ORDER BY extname;

-- 1L. pg_cron status
SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AS pg_cron_installed;

-- 1M. Storage buckety
SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY name;

-- 1N. Tabulky bez RLS
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;

-- 1O. Sekvence a typy
SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public';
SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace
AND typtype NOT IN ('b', 'p') ORDER BY typname;

-- 1P. product_categories NEMÁ existovat (dropnuta v 009)
SELECT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'product_categories' AND schemaname = 'public');

-- 1Q. Database roles a granty
SELECT grantee, table_name, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' ORDER BY table_name, grantee;
```

### CLI příkazy

```bash
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy
supabase db diff --linked
supabase migration list --linked
supabase db lint --linked --level warning
```

### Checklist
- [ ] 11 tabulek existuje: customers, products, categories, orders, order_items, custom_itinerary_requests, blog_posts, download_tokens, integration_logs, newsletter_consent_log, user_roles
- [ ] product_categories (dropnuta v 009) neexistuje
- [ ] CHECK constrainty: orders (pending|completed|failed|refunded), custom_requests (new|paid|in_progress|completed|cancelled)
- [ ] FK customers.id -> auth.users.id existuje (migrace 026)
- [ ] orders.stripe_payment_id a customer_name jsou nullable (migrace 026)
- [ ] customers.id nemá DEFAULT gen_random_uuid()
- [ ] handle_new_user() funkce neexistuje (smazána v 026)
- [ ] ~35 indexů existuje
- [ ] pg_cron status (pozn: vyžaduje Pro plan)
- [ ] 3 storage buckety: products-pdfs (private, 200MB), products-images (public, 10MB), blog-images (public, 10MB)
- [ ] Všechny tabulky mají RLS enabled
- [ ] Žádný schema drift (`supabase db diff --linked` čistý)
- [ ] Extensions: moddatetime, pgcrypto
- [ ] Žádné osiřelé funkce, sekvence, typy

### Web search
- Supabase migration best practices 2026
- PostgreSQL constraint best practices

### Výstup
Report: `docs/audit-results/cast-1a-schema-verifikace.md` - kompletní snapshot živého schématu, tabulka-po-tabulce verifikace, lint výsledky, schema drift.

---

## ČÁST 1b: Migrační review + storage lifecycle

**Cíl:** Porovnat migrační soubory s MIGRATIONS.md dokumentací a živým schématem (z Části 1a reportu). Audit storage lifecycle (orphaned soubory, signed URL expiry).

**Závislost:** Vyžaduje dokončený Část 1a (report jako reference).

### Soubory k revizi
- Klíčové migrace: `supabase/migrations/` - zaměřit se na 013 (customers), 024-028 (poslední změny)
- `supabase/MIGRATIONS.md` (1173 řádků) - sekce 4 (ERD), 7 (Indexes), 9 (Known Issues)
- `docs/ARCHITECTURE_DECISIONS.md`
- Edge function `get-download-url/index.ts` (signed URL expiry nastavení)

### SQL dotazy (doplňkové k Části 1a)

```sql
-- 1R. Storage: orphaned soubory (smazané produkty se soubory v bucketu)
SELECT id, title, image_url, pdf_url, is_deleted FROM products WHERE is_deleted = true;

-- 1S. Storage: počty souborů v bucketech
SELECT bucket_id, COUNT(*) as file_count,
  pg_size_pretty(SUM(COALESCE((metadata->>'size')::bigint, 0))) as total_size
FROM storage.objects GROUP BY bucket_id ORDER BY bucket_id;
```

### Checklist
- [ ] Všechny sloupce odpovídají MIGRATIONS.md sekce 4 (ERD)
- [ ] Indexy odpovídají dokumentaci (~35)
- [ ] 35 known issues z MIGRATIONS.md sekce 9 správně označeny resolved/open
- [ ] Migration states (OK, Superseded) správně v MIGRATIONS.md
- [ ] Dependency graph v MIGRATIONS.md aktuální
- [ ] ADRs v ARCHITECTURE_DECISIONS.md stále relevantní
- [ ] Storage: žádné orphaned soubory pro smazané produkty
- [ ] Storage: signed URL expiry čas v get-download-url je přiměřený
- [ ] Storage: cleanup strategie pro osiřelé soubory existuje nebo je doporučena

### Web search
- Supabase Storage orphaned files cleanup
- Supabase signed URL best practices

### Výstup
Report: `docs/audit-results/cast-1b-migrace-storage.md`

---

## ČÁST 2a: RLS policies - inventory a analýza

**Cíl:** Zmapovat všech ~50 RLS policies, porovnat s dokumentací, identifikovat bezpečnostní mezery a performance issues.

### Soubory k revizi
- `supabase/rls-policies-audit-v2.md` (post-025, možná zastaralá po 026-028)
- `supabase/RLS_UNIFICATION_PROPOSAL.md`
- `supabase/RLS_AUDIT_PROMPT.md`
- `supabase/MIGRATIONS.md` sekce 5
- Migrace 002, 012, 019, 024, 025, 027, 028

### SQL dotazy

```sql
-- 2A. Kompletní inventory policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, cmd, policyname;

-- 2B. RLS enabled status
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- 2C. Duplikáty (více policies pro stejnou tabulku+cmd+role)
SELECT tablename, cmd, COUNT(*), STRING_AGG(policyname, ', ')
FROM pg_policies WHERE schemaname = 'public'
GROUP BY tablename, cmd HAVING COUNT(*) > 1 ORDER BY tablename;

-- 2D. Performance: policies BEZ (SELECT ...) wrapperu (lint rule 0003)
SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies
WHERE schemaname = 'public' AND (
  (qual LIKE '%auth.uid()%' AND qual NOT LIKE '%(SELECT auth.uid())%')
  OR (qual LIKE '%auth.jwt()%' AND qual NOT LIKE '%(SELECT auth.jwt())%')
  OR (qual LIKE '%is_admin()%' AND qual NOT LIKE '%(SELECT is_admin())%')
  OR (with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%(SELECT auth.uid())%')
  OR (with_check LIKE '%is_admin()%' AND with_check NOT LIKE '%(SELECT is_admin())%')
);

-- 2E. Definice helper funkcí
SELECT proname, pg_get_functiondef(oid) FROM pg_proc
WHERE proname IN ('is_admin', 'is_permanent_user', 'custom_access_token_hook')
AND pronamespace = 'public'::regnamespace;

-- 2F. GRANT/REVOKE na custom_access_token_hook
SELECT grantee, privilege_type FROM information_schema.routine_privileges
WHERE routine_name = 'custom_access_token_hook' AND routine_schema = 'public';

-- 2G. user_roles SELECT policy pro supabase_auth_admin
SELECT policyname, roles, qual FROM pg_policies
WHERE tablename = 'user_roles' AND 'supabase_auth_admin' = ANY(roles);

-- 2H. RESTRICTIVE policies (nemají existovat po cleanup v 025)
SELECT tablename, policyname, permissive FROM pg_policies
WHERE schemaname = 'public' AND permissive = 'RESTRICTIVE';

-- 2I. Storage policies
SELECT policyname, roles, cmd, qual, with_check FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects' ORDER BY policyname;

-- 2J. Products public SELECT - filtruje is_deleted = false?
SELECT policyname, qual FROM pg_policies
WHERE tablename = 'products' AND cmd = 'SELECT' AND 'anon' = ANY(roles);

-- 2K. Newsletter INSERT validace
SELECT policyname, with_check FROM pg_policies
WHERE tablename = 'newsletter_consent_log' AND cmd = 'INSERT';

-- 2L. Orders INSERT
SELECT policyname, with_check FROM pg_policies WHERE tablename = 'orders' AND cmd = 'INSERT';

-- 2M. Naming konzistence
SELECT tablename,
  CASE WHEN policyname ~ '^[a-z_]+$' THEN 'snake_case' ELSE 'human_readable' END AS style,
  policyname
FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;

-- 2N. Policies referencující user_metadata (lint rule 0015)
SELECT tablename, policyname, qual, with_check FROM pg_policies
WHERE schemaname = 'public'
AND (qual LIKE '%user_metadata%' OR with_check LIKE '%user_metadata%'
  OR qual LIKE '%raw_user_meta_data%' OR with_check LIKE '%raw_user_meta_data%');
```

### CLI příkazy

```bash
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy
supabase db lint --linked --level warning
```

### Supabase Database Advisor lint rules (24) checklist
- [ ] 0001: Unindexed foreign keys
- [ ] 0002: Auth users exposed
- [ ] 0003: Auth RLS initplan (SELECT wrapper)
- [ ] 0004: No primary key
- [ ] 0005: Unused index
- [ ] 0006: Multiple permissive policies
- [ ] 0007: Policy exists RLS disabled
- [ ] 0008: RLS enabled no policy
- [ ] 0009: Duplicate index
- [ ] 0010: Security definer view
- [ ] 0011: Function search path mutable
- [ ] 0012: Auth allow anonymous sign-ins (OČEKÁVANÝ - záměrně)
- [ ] 0013: RLS disabled in public
- [ ] 0014: Extension in public schema
- [ ] 0015: RLS references user metadata
- [ ] 0016: Materialized view in API
- [ ] 0017: Foreign table in API
- [ ] 0018: Unsupported reg types
- [ ] 0019: Insecure queue exposed
- [ ] 0020: Table bloat
- [ ] 0021: Fkey to auth unique
- [ ] 0022: Extension versions outdated
- [ ] 0023: Sensitive columns exposed
- [ ] 0024: Permissive RLS policy (overly permissive)

### Očekávaná RLS matice

| Tabulka | Kategorie | SELECT | INSERT | UPDATE | DELETE |
|---------|-----------|--------|--------|--------|--------|
| products | Public Read, Admin Write | public (is_deleted=false) | admin | admin | admin |
| categories | Public Read, Admin Write | public | admin | admin | admin |
| blog_posts | Conditional Read, Admin Write | published / admin all | admin | admin | admin |
| download_tokens | Conditional Read | non-expired only | admin | admin | admin |
| customers | Admin Only | admin | admin | admin | admin |
| integration_logs | Admin Only | admin | admin | admin | admin |
| orders | User + Admin | own + admin | own + admin | admin | admin |
| order_items | User + Admin | own (via order) + admin | own + admin | admin | admin |
| custom_itinerary_requests | User + Admin | own + admin | public (anon) | own (permanent) + admin | admin |
| user_roles | User + Admin | own + admin + auth_admin | admin | admin | admin |
| newsletter_consent_log | Append-only | admin | public (validated) | ŽÁDNÝ | ŽÁDNÝ |

### Web search
- Supabase RLS best practices 2026
- Supabase Database Advisor lint rules

### Výstup
Report: `docs/audit-results/cast-2a-rls-inventory.md`

---

## ČÁST 2b: RLS fixy + migrace 029

**Cíl:** Implementovat RLS opravy nalezené v Části 2a a vytvořit migraci 029 pro unifikaci pojmenování policies.

**Závislost:** Vyžaduje dokončený Část 2a.

### Postup
1. Přečíst výstupy Části 2a (`docs/audit-results/cast-2a-rls-inventory.md`)
2. Přečíst `supabase/RLS_UNIFICATION_PROPOSAL.md` (Variant A: snake_case)
3. Vytvořit migraci `029_unify_rls_policy_names.sql`:
   - Přejmenovat ~13 policies na snake_case (orders 4, order_items 4, custom_itinerary_requests 4, user_roles 1)
   - Opravit jakékoliv bezpečnostní issues nalezené v 2a

### Rollback strategie

Vytvořit soubor `029_rollback.sql` (NEAPLIKOVAT, jen mít připravený):
```sql
-- ROLLBACK pro 029_unify_rls_policy_names.sql
-- Vrátí policies na původní názvy
-- Generovat automaticky: pro každý ALTER POLICY ... RENAME v 029 vytvořit inverzní RENAME
BEGIN;
-- ALTER POLICY "snake_case_name" ON table RENAME TO "Original Name";
-- ... (generovat z 029 migračního souboru)
COMMIT;
```

**Postup deploye:**
1. Před aplikací 029: `supabase db dump --linked -f /tmp/pre-029-backup.sql`
2. Aplikovat: `supabase db push --linked` nebo `supabase migration up --linked`
3. Ověřit: spustit verifikační SQL z konce plánu (snake_case check, policy count)
4. Pokud chyba: aplikovat `029_rollback.sql` manuálně

4. Ověřit pgTAP (pokud dostupný) nebo manuálně SQL testy
5. Aktualizovat `supabase/rls-policies-audit-v2.md`

### Výstup
- Migrace `029_unify_rls_policy_names.sql`
- Rollback soubor `029_rollback.sql`
- Aktualizovaný `supabase/rls-policies-audit-v2.md`
- Report: `docs/audit-results/cast-2b-rls-fixy.md`

---

## ČÁST 3a: Funkce - bezpečnostní audit

**Cíl:** Přečíst zdrojový kód všech DB funkcí v public schema a ověřit bezpečnostní atributy (SECURITY DEFINER, search_path, volatilita, GRANT/EXECUTE).

### SQL dotazy

```sql
-- 3A. Inventory funkcí s bezpečnostními atributy
SELECT proname, pg_get_function_identity_arguments(p.oid) AS args,
  p.prorettype::regtype AS return_type,
  p.provolatile AS volatility,
  p.prosecdef AS security_definer,
  p.proconfig AS config
FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace ORDER BY proname;

-- 3B. Plný zdrojový kód VŠECH funkcí
SELECT proname, pg_get_functiondef(oid) FROM pg_proc
WHERE pronamespace = 'public'::regnamespace ORDER BY proname;

-- 3C. SECURITY DEFINER audit
SELECT proname, prosecdef, proconfig, pg_get_functiondef(oid) FROM pg_proc
WHERE pronamespace = 'public'::regnamespace AND prosecdef = true ORDER BY proname;

-- 3D. SECURITY DEFINER bez search_path = '' (KRITICKÉ - lint rule 0011)
SELECT proname, proconfig FROM pg_proc
WHERE pronamespace = 'public'::regnamespace AND prosecdef = true
AND (proconfig IS NULL OR NOT EXISTS (
  SELECT 1 FROM unnest(proconfig) c WHERE c LIKE 'search_path=%'
));

-- 3E. Volatility check (is_admin, is_permanent_user by měly být STABLE)
SELECT proname, provolatile,
  CASE provolatile WHEN 'v' THEN 'VOLATILE' WHEN 's' THEN 'STABLE' WHEN 'i' THEN 'IMMUTABLE' END
FROM pg_proc WHERE proname IN ('is_admin', 'is_permanent_user')
AND pronamespace = 'public'::regnamespace;

-- 3F. GRANT EXECUTE permissions na funkce
SELECT proname, array_agg(grantee) AS grantees
FROM (
  SELECT p.proname, r.grantee FROM pg_proc p
  JOIN information_schema.routine_privileges r
    ON r.routine_name = p.proname AND r.routine_schema = 'public'
  WHERE p.pronamespace = 'public'::regnamespace
) sub GROUP BY proname ORDER BY proname;

-- 3G. GRANT/REVOKE na custom_access_token_hook
SELECT grantee, privilege_type FROM information_schema.routine_privileges
WHERE routine_name = 'custom_access_token_hook' AND routine_schema = 'public';

-- 3H. pgTAP dostupnost
SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgtap') AS pgtap_installed;
```

### Bezpečnostní checklist funkcí

| Funkce | SECURITY DEFINER? | search_path=''? | Volatilita | Plně kvalif. názvy? |
|--------|-------------------|-----------------|------------|---------------------|
| is_admin() | NE (očekávané) | ? | STABLE? | ? |
| is_permanent_user() | NE | ? | STABLE? | ? |
| custom_access_token_hook() | ANO (nutné) | ''? | ? | ? |
| handle_new_permanent_user() | ANO (nutné) | ''? | VOLATILE | ? |
| handle_user_email_update() | ANO (nutné) | ''? | VOLATILE | ? |
| link_requests_to_customer() | ANO (nutné) | ''? | VOLATILE | ? |
| link_orders_to_customer() | ANO (nutné) | ''? | VOLATILE | ? |
| update_product_total_sales() | ? | ? | VOLATILE | ? |
| update_all_products_in_order() | ? | ? | VOLATILE | ? |
| cleanup_expired_tokens() | ? | ? | VOLATILE | ? |

### Web search
- Supabase SECURITY DEFINER best practices 2026
- PostgreSQL function volatility STABLE vs VOLATILE

### Výstup
Report: `docs/audit-results/cast-3a-funkce-bezpecnost.md`

---

## ČÁST 3b: Triggery, data integrita, user konverze, performance

**Cíl:** Ověřit trigger chain, data integritu (total_sales, osiřelé záznamy), performance (indexy, EXPLAIN ANALYZE), a anonymous→permanent user konverzní flow.

### Soubory k revizi
- `supabase/MIGRATIONS.md` sekce 6 (Triggers and Functions)
- E-shop: `src/contexts/CartContext.jsx` (anonymous auth inicializace)
- E-shop: `src/pages/Checkout.jsx` (anonymous→permanent konverze)

### SQL dotazy

```sql
-- 3I. Inventory triggerů na public tabulkách
SELECT trigger_name, event_manipulation, event_object_table, action_timing,
  action_statement, action_orientation
FROM information_schema.triggers WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 3J. Auth triggery (na auth.users - kritické pro customer lifecycle)
SELECT t.tgname, pg_get_triggerdef(t.oid) FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'auth' AND c.relname = 'users' AND NOT t.tgisinternal;

-- 3K. moddatetime triggery na updated_at
SELECT extname, extversion FROM pg_extension WHERE extname = 'moddatetime';
-- Očekávané na: customers, products, categories, orders, blog_posts, custom_itinerary_requests

-- 3L. total_sales integrity
SELECT p.id, p.title, p.total_sales, COALESCE(calc.sales, 0) AS calculated_sales
FROM products p LEFT JOIN (
  SELECT oi.product_id, SUM(oi.quantity) AS sales FROM order_items oi
  JOIN orders o ON o.id = oi.order_id WHERE o.status = 'completed' GROUP BY oi.product_id
) calc ON calc.product_id = p.id
WHERE p.total_sales != COALESCE(calc.sales, 0);

-- 3M. Permanentní uživatelé bez customers záznamu
SELECT u.id, u.email, u.created_at FROM auth.users u
LEFT JOIN public.customers c ON c.id = u.id
WHERE u.is_anonymous IS NOT TRUE AND c.id IS NULL;

-- 3N. Osiřelí customers (bez auth.users)
SELECT c.id, c.email FROM public.customers c
LEFT JOIN auth.users u ON u.id = c.id WHERE u.id IS NULL;

-- 3O. Expirované download tokens
SELECT COUNT(*) AS expired_count,
  MIN(expires_at) AS oldest_expired, MAX(expires_at) AS newest_expired
FROM download_tokens WHERE expires_at < NOW();

-- 3P. Velikosti tabulek
SELECT relname, n_live_tup, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY n_live_tup DESC;

-- 3Q. Nepoužívané indexy
SELECT relname, indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid))
FROM pg_stat_user_indexes WHERE schemaname = 'public' AND idx_scan = 0 ORDER BY relname;

-- 3R. Unindexed foreign keys (lint rule 0001)
SELECT c.conrelid::regclass AS table_name, a.attname AS column_name, c.conname,
  NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.conrelid AND a.attnum = ANY(i.indkey)) AS missing_index
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f' AND c.conrelid::regnamespace::text = 'public';

-- 3S. Anonymous uživatelé
SELECT id, created_at, is_anonymous, email FROM auth.users
WHERE is_anonymous = true ORDER BY created_at DESC;

-- 3T. Objednávky anonymních uživatelů
SELECT o.id, o.user_id, o.status, u.is_anonymous, u.email
FROM orders o JOIN auth.users u ON o.user_id = u.id
WHERE u.is_anonymous = true;

-- 3U. Custom requests anonymních uživatelů
SELECT cr.id, cr.user_id, cr.status, u.is_anonymous
FROM custom_itinerary_requests cr JOIN auth.users u ON cr.user_id = u.id
WHERE u.is_anonymous = true;

-- 3V. Trigger chain verifikace: handle_new_permanent_user
SELECT t.tgname, pg_get_triggerdef(t.oid) FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'auth' AND c.relname = 'users' AND NOT t.tgisinternal
AND t.tgname LIKE '%permanent%';
```

### Performance: EXPLAIN ANALYZE kritických dotazů

Cíl: Ověřit že RLS policies a indexy nezpůsobují pomalé dotazy na klíčových endpointech.

```sql
-- 3W. Product listing (public, RLS-heavy) - hlavní stránka e-shopu
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM products WHERE is_deleted = false ORDER BY created_at DESC LIMIT 20;

-- 3X. Orders listing (user-scoped RLS) - simulace přihlášeného usera
-- Poznámka: spouštěno přes service_role, takže RLS se neaplikuje.
-- Pro skutečný RLS test je potřeba SET LOCAL role = 'authenticated'; SET LOCAL request.jwt.claims = '...';
-- Alternativa: změřit response time přes supabase-js z frontendu.
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT o.*, json_agg(oi.*) as items
FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id ORDER BY o.created_at DESC LIMIT 20;

-- 3Y. Custom itinerary requests (JSONB form_data)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM custom_itinerary_requests ORDER BY created_at DESC LIMIT 20;

-- 3Z. Blog posts (published only, public read)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM blog_posts WHERE published = true ORDER BY published_at DESC LIMIT 10;
```

**Performance checklist:**
- [ ] Žádný Seq Scan na tabulkách s >100 řádky (kromě malých lookup tabulek jako categories)
- [ ] RLS policies nezvyšují query time o víc než 2× oproti bez-RLS dotazu
- [ ] JOIN orders + order_items nepoužívá Nested Loop na velkých datech
- [ ] JSONB form_data v custom_itinerary_requests nepotřebuje GIN index (záleží na tom jestli se filtruje)

**Poznámka k RLS testování:** `supabase db query --linked` běží jako superuser (service_role), takže RLS se neaplikuje. Pro reálný RLS performance test je potřeba buď:
- a) Použít `SET LOCAL role = 'authenticated'` + nastavit JWT claims v transakci
- b) Měřit response time z frontendu/admin panelu na reálných endpointech
- Doporučení: otestovat obojí a porovnat

### Anonymous → permanent user konverzní flow checklist
- [ ] handle_new_permanent_user() trigger správně detekuje konverzi (is_anonymous: true → false)
- [ ] link_orders_to_customer() přelinkuje všechny objednávky z anonymous user_id
- [ ] link_requests_to_customer() přelinkuje všechny custom requests
- [ ] Customer záznam se vytvoří při konverzi (ne dřív)
- [ ] Race condition: co když 2 anonymní sessions se pokusí konvertovat současně?
- [ ] Co se stane s download tokens anonymního usera po konverzi?
- [ ] Existují osiřelí anonymní uživatelé, kteří by měli být smazáni? (cleanup strategie)

### Data integrity checklist
- [ ] total_sales odpovídá reálným completed objednávkám
- [ ] Žádní permanentní uživatelé bez customers záznamu
- [ ] Žádní osiřelí customers bez auth.users
- [ ] Expirované download tokens čištěny (pg_cron nebo manuálně)
- [ ] Všechny FK sloupce indexované
- [ ] Žádné nepoužívané indexy (kandidáti na smazání)
- [ ] moddatetime triggery na všech tabulkách s updated_at

### Web search
- Supabase anonymous to permanent user conversion
- PostgreSQL trigger chain best practices

### Výstup
Report: `docs/audit-results/cast-3b-triggery-integrita.md`

---

## ČÁST 4: Bezpečnostní audit Edge Functions + rate limiting (po hotfixech)

**Cíl:** Kompletní audit všech 5 edge functions PO aplikování hotfixů z Části 0. Ověřit že fixy jsou správné a najít další issues. Zahrnuje audit rate limitingu a abuse prevention.

### Soubory k revizi
- `supabase/functions/create-checkout-session/index.ts` (POST-FIX)
- `supabase/functions/stripe-webhook/index.ts` (391 řádků, POST-FIX)
- `supabase/functions/create-stripe-product/index.ts` (POST-FIX)
- `supabase/functions/get-download-url/index.ts`
- `supabase/functions/get-order-by-session/index.ts`

### Závislosti edge functions (ověřeno)

Všechny funkce importují přímo z esm.sh URL (žádný globální import_map):
- **stripe:** `https://esm.sh/stripe@20?target=denonext` (4 z 5 funkcí)
- **supabase-js:** `https://esm.sh/@supabase/supabase-js@2` (4 z 5 funkcí)
- Pouze `create-stripe-product` má lokální `deno.json` s import mappingem pro stripe

**Poznámka:** Verze `@2` u supabase-js je major range - ověřit zda je to záměrné vs přesná verze.

### [CRITICAL] CORS: Access-Control-Allow-Origin: `"*"` na všech edge functions

Všech 5 edge functions má wildcard CORS origin. To znamená:
- Jakýkoliv web může volat `create-checkout-session` a vytvořit checkout session
- Jakýkoliv web může volat `get-order-by-session` a potenciálně získat data o objednávce

**Doporučení:** Omezit na konkrétní domény:
```typescript
const allowedOrigins = [
  'https://vase-domena.cz',        // e-shop
  'https://admin.vase-domena.cz',  // admin panel
];

const origin = req.headers.get('Origin');
const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
```

**Checklist:**
- [ ] Identifikovat přesné produkční domény obou aplikací
- [ ] Implementovat whitelist CORS v edge functions
- [ ] Ověřit že `stripe-webhook` nepotřebuje CORS (Stripe posílá server-to-server)

### [HIGH] Nepinnované dependency verze v edge functions

Všechny edge functions používají major version ranges:
```
stripe@20           → může resolvovat na 20.0.0 nebo 20.99.0
@supabase/supabase-js@2  → může resolvovat na 2.0.0 nebo 2.99.0
```

**Riziko:** esm.sh servíruje latest verzi v rámci major range. Pokud se minor/patch update rozbije, edge functions se rozbijí BEZ jakékoliv změny v kódu.

**Doporučení:**
```typescript
// PŘED (nebezpečné):
import Stripe from "https://esm.sh/stripe@20?target=denonext";
// PO (pinnované):
import Stripe from "https://esm.sh/stripe@20.16.0?target=denonext";
```

**Akce:**
1. Zjistit aktuálně resolvované verze: `curl -s https://esm.sh/stripe@20 | head -5`
2. Pinnout na přesné verze ve všech 5 edge functions
3. Sjednotit: buď všechny funkce s deno.json import mapou, nebo všechny s přímými URL (ne mix)

### Bezpečnostní matice

| Kontrola | create-checkout | stripe-webhook | create-stripe-product | get-order-by-session | get-download-url |
|----------|----------------|----------------|----------------------|---------------------|-----------------|
| Auth | JWT/anon | Stripe sig ONLY | ADMIN JWT! | JWT/session | Token-based |
| Authz | Kdo smí? | N/A (Stripe) | Jen admin! | Vlastník session? | Vlastník tokenu |
| Input val | products, qty | webhook payload | product data | session_id format | token format |
| service_role | Ano (INSERT) | Ano (INSERT) | ? | Ano (SELECT) | Ano (signed URL) |
| CORS origin | **CRITICAL: `*`** | N/A | **CRITICAL: `*`** | **CRITICAL: `*`** | **CRITICAL: `*`** |
| Error leaks | ? | ? | ? | ? | ? |
| Idempotence | ? | existingOrder? | ? | ? | ? |
| Rate limit | ? | N/A (Stripe) | ? | ? | ? |

### Kontroly po hotfixech
- [ ] Hotfix 1 (user_id z JWT) - ověřit implementaci
- [ ] Hotfix 2 (customer ID) - ověřit implementaci
- [ ] Hotfix 3 (admin auth) - ověřit implementaci
- [ ] get-order-by-session: service_role bez owner verifikace (information disclosure)
- [ ] CORS: implementovat origin whitelist
- [ ] Token generace: modulo bias v randomValues
- [ ] Order number: Math.random() (ne kryptograficky bezpečné)
- [ ] Stripe webhook signature verification
- [ ] Environment variables v env, ne v kódu
- [ ] Edge Function Secrets v Supabase Dashboard: jaké secrets jsou nastaveny? Nejsou tam staré/nepoužívané?
- [ ] Deno permissions: žádné --allow-all
- [ ] Import verze: pinnout na přesné verze (ne major range)
- [ ] Nekonzistence: create-stripe-product má deno.json, ostatní ne - sjednotit
- [ ] Error responses: žádné stacktraces
- [ ] SQL injection (Supabase JS parametrizuje, ale ověřit)
- [ ] Logging: citlivá data se nelogují

### Rate limiting a abuse prevention

```sql
-- 4-RATE-A. Podezřelá aktivita - mnoho objednávek od jednoho usera
SELECT user_id, COUNT(*) as order_count, MIN(created_at), MAX(created_at)
FROM orders GROUP BY user_id HAVING COUNT(*) > 5 ORDER BY order_count DESC;

-- 4-RATE-B. Mnoho custom requests od jednoho usera
SELECT user_id, COUNT(*) as request_count
FROM custom_itinerary_requests GROUP BY user_id HAVING COUNT(*) > 3;

-- 4-RATE-C. Newsletter spam
SELECT email, COUNT(*) as signup_count
FROM newsletter_consent_log GROUP BY email HAVING COUNT(*) > 1;
```

**Rate limiting checklist:**
- [ ] Supabase built-in rate limiting na edge functions: je aktivní? Jaký limit?
- [ ] create-checkout-session: kolik checkout sessions může jeden user vytvořit za minutu?
- [ ] Newsletter signup: rate limit na INSERT do newsletter_consent_log (RLS nestačí)
- [ ] Custom itinerary form: bez CAPTCHA + bez rate limitu = spam vektor
- [ ] Download tokens: rate limit na generování signed URLs
- [ ] Doporučení: Implementovat Supabase Edge Function rate limiting nebo custom middleware

### Web search
- Supabase Edge Functions security best practices 2026
- Stripe webhook security best practices 2026
- esm.sh version pinning best practices
- Supabase Edge Functions rate limiting 2026

### Výstup
Report: `docs/audit-results/cast-4-edge-functions.md`

---

## ČÁST 5a-i: Admin panel - auth, data provider, storage, audit trail, security headers

**Cíl:** Audit autentizace (MFA flow), data provideru (Supabase + Stripe sync), storage upload logiky, admin audit trailu, a security headers.

### Soubory k revizi (cesty-bez-mapy-admin)
- `src/App.tsx` (React Admin konfigurace, providery)
- `src/supabaseClient.ts` (Supabase klient)
- `src/dataProvider/withStorageUpload.ts` (upload do Storage)
- `src/dataProvider/withStripeSync.ts` (Stripe sync při CRUD)
- `src/utils/storageUtils.ts` (storage helper funkce)
- `src/auth/MFAWrapper.tsx` (MFA gate)
- `src/auth/MFAEnrollPage.tsx` (TOTP enrollment)
- `src/auth/MFAVerifyPage.tsx` (TOTP verifikace)
- `vercel.json` (security headers)
- `.env.example`

### Kontrolní body
- [ ] MFA skutečně enforced před JAKÝMKOLIV přístupem k datům (MFAWrapper gates all routes)
- [ ] AAL level check: aal1 = základní, aal2 = MFA ověřeno
- [ ] Data provider používá anon key (závisí na RLS + JWT claims)
- [ ] Není použit service_role key na klientu
- [ ] Storage uploady validují typ a velikost souboru před odesláním
- [ ] withStripeSync posílá auth headers při volání create-stripe-product edge function
- [ ] withStorageUpload správně handluje public vs private buckety
- [ ] Žádné hardcoded secrets v kódu
- [ ] `.env.local` je v `.gitignore`
- [ ] Error handling: Supabase/Stripe chyby nezobrazují citlivé info

### Security headers (Vercel)

Existující headers v `vercel.json`:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=()

**Chybí:**
- [ ] Content-Security-Policy - MUSÍ se přidat (omezit script-src, connect-src na Supabase URL)
- [ ] Strict-Transport-Security - MUSÍ se přidat (min `max-age=31536000; includeSubDomains`)

### Environment variables
- [ ] Nekonzistentní pojmenování: admin používá `VITE_SUPABASE_API_KEY`, main app používá `VITE_SUPABASE_ANON_KEY` - sjednotit
- [ ] Ověřit že `.env.local` a `.env` NEJSOU commitnuté (v git historii)
- [ ] Žádná validace env vars při startu aplikace - doporučení: přidat runtime check

### Admin audit trail

```sql
-- 5-AUDIT-A. Auth audit log (Supabase built-in)
SELECT id, payload->>'action' as action, payload->>'actor_id' as actor_id,
  created_at
FROM auth.audit_log_entries
ORDER BY created_at DESC LIMIT 20;

-- 5-AUDIT-B. Integration logs - jaké služby jsou logovány?
SELECT service, status, COUNT(*) FROM integration_logs
GROUP BY service, status ORDER BY service, status;
```

**Audit trail checklist:**
- [ ] Admin operace logování: zaznamenává se kdo smazal/upravil produkt, objednávku, zákazníka?
- [ ] React Admin `useAuditLogger` nebo custom audit middleware?
- [ ] integration_logs: je používán pro admin operace, nebo jen pro Stripe?
- [ ] Supabase Auth audit log (`auth.audit_log_entries`) - je dostupný a dostatečný?
- [ ] GDPR relevance: kdo přistupoval k osobním údajům zákazníků?

### Výstup
Report: `docs/audit-results/cast-5a-i-admin-auth-provider.md`

---

## ČÁST 5a-ii: Admin panel - resource soubory

**Cíl:** Audit všech CRUD resource souborů v admin panelu - jaké data fetchují, overfetching, citlivé sloupce, validace, XSS.

### Soubory k revizi (cesty-bez-mapy-admin)
- `src/resources/products/` (ProductList, ProductEdit, ProductCreate, **ImageGalleryInput**)
- `src/resources/orders/` (OrderList, OrderEdit)
- `src/resources/customers/` (CustomerList, CustomerEdit)
- `src/resources/blog-posts/` (BlogPostList, BlogPostEdit, BlogPostCreate)
- `src/resources/categories/` (CategoryList, CategoryEdit, CategoryCreate)
- `src/resources/custom_requests/` (CustomRequestList, CustomRequestEdit)
- Každý `index.ts` pro exporty

### Kontrolní body
- [ ] `select('*')` - overfetching citlivých sloupců?
- [ ] Custom requests: nevystavuje citlivá data z form_data JSONB
- [ ] Customers: jaké osobní údaje jsou zobrazeny v Listu vs Editu?
- [ ] Orders: zobrazuje se stripe_payment_id, stripe_session_id? (citlivé?)
- [ ] Products: is_deleted filtrování v admin Listu?
- [ ] Products: **ImageGalleryInput.tsx** - bezpečný upload, validace MIME typů, velikosti?
- [ ] Blog posts: draft vs published rozlišení v admin?
- [ ] Validace vstupu: `required()`, custom validátory na všech formulářích
- [ ] `dangerouslySetInnerHTML` použití (XSS riziko s blog content)
- [ ] `FunctionField`: renderuje uživatelská data bezpečně?
- [ ] Konzistence: všechny resources používají stejné patterny?

### Web search
- React Admin data fetching security
- React Admin XSS prevention

### Výstup
Report: `docs/audit-results/cast-5a-ii-admin-resources.md`

---

## ČÁST 5b: Audit frontendu - E-shop (hlavní aplikace)

**Cíl:** Audit jak e-shop interaguje se Supabase - anonymous auth, checkout flow, data leakage, XSS/CSRF, security headers.

**Poznámka k subagentům:** CustomItineraryForm.jsx (45KB) dostává vlastního dedikovaného subagenta kvůli velikosti.

### Soubory k revizi (cesty-bez-mapy)

**Prioritní soubory:**
- `src/lib/supabase.js`
- `src/pages/Checkout.jsx`
- `src/pages/CustomItineraryForm.jsx` (45KB - velký formulář)
- `src/pages/OrderConfirmation.jsx`
- `src/pages/CustomItineraryPreview.jsx`
- `src/pages/ProductDetail.jsx`
- `src/pages/TravelGuides.jsx`
- `src/contexts/CartContext.jsx`

**Doplňkové soubory (ověřeno jako relevantní):**
- `src/pages/Contact.jsx` - **sbírá jméno a email** (formulář, aktuálně simulovaný submit - GDPR relevance)
- `src/pages/PlanYourDreamTrip.jsx` - může obsahovat formuláře
- `src/pages/ItalyRoadtripDetail.jsx` - produktová stránka, může fetchovat data
- `src/pages/SalzburgItinerary.jsx` - produktová stránka, může fetchovat data

**Poznámka:** `src/pages/CustomItineraryDetail.jsx` je čistě statická stránka bez API volání - lze přeskočit.

### Grep přes VŠECHNY stránky (komplexní audit)

```bash
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy
# Supabase dotazy ve všech stránkách
rg "supabase\.from|supabase\.functions|supabase\.auth" --type js src/pages/ src/contexts/
# Formuláře sbírající data
rg "useState.*\{.*name|email|phone|telefon" --type js src/pages/
# Nebezpečné renderování
rg "dangerouslySetInnerHTML|innerHTML" --type js src/
# Console.log (citlivé info v produkci?)
rg "console\.(log|warn|error)" --type js src/pages/
# Hardcoded secrets
rg "sk_live|sk_test|service_role" --type js src/
```

### Security headers (Vercel)

**E-shop `vercel.json` NEMÁ sekci `headers`** - žádné security headers v produkci.

**Fix:** Přidat `headers` sekci do `vercel.json` (stejný pattern jako admin):
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; connect-src 'self' https://*.supabase.co; ..." }
      ]
    }
  ]
}
```

**Checklist:**
- [ ] Přidat security headers do e-shop `vercel.json`
- [ ] Definovat CSP policy (connect-src pro Supabase, script-src, img-src pro storage buckety)
- [ ] Ověřit deployment po změně (Vercel redeploy)

### Kontrolní body
- [ ] CAPTCHA CHYBÍ - CustomItineraryForm má TODO o Cloudflare Turnstile
- [ ] Anonymous auth race conditions
- [ ] user_id posílaný v request body (cross-ref Část 0 hotfix)
- [ ] Edge function calls používají `supabase.functions.invoke()` s auto auth
- [ ] Cart ceny v localStorage (`cbm_cart` klíč) - revalidovány server-side přes Stripe?
- [ ] Žádná stránka nefetchuje admin-only pole
- [ ] Error handling - Supabase chyby nezobrazí citlivé info
- [ ] XSS: form_data JSONB sanitizován před renderováním?
- [ ] CSRF: JWT v localStorage (XSS riziko, ne CSRF)
- [ ] CSP headers nastaveny?
- [ ] **Contact.jsx:** formulář sbírá jméno+email ale aktuálně data neposílá (simulovaný submit) - ověřit záměr
- [ ] **Statické produktové stránky** (ItalyRoadtrip, Salzburg): obsahují hardcoded ceny? Synchronizované s DB?

### Environment variables
- [ ] Main app: `VITE_SUPABASE_ANON_KEY` - ověřit že je to skutečně anon key, ne service_role
- [ ] Žádné jiné env vars nepotřebné?

### Web search
- Supabase anonymous auth security 2026
- Content Security Policy CSP Supabase

### Výstup
Report: `docs/audit-results/cast-5b-eshop.md`

---

## ČÁST 6: Infrastruktura, production readiness, backup, monitoring

**Cíl:** Audit Supabase project settings, příprava na produkci, Free→Pro upgrade plán, backup strategie, monitoring, dependency audit, git secrets scan.

### Dashboard kontroly (manuální checklist)

**Authentication:**
- [ ] Email confirmations enabled
- [ ] OTP expiry nastaveny (≤3600s)
- [ ] Minimum password length (≥8)
- [ ] CAPTCHA enabled (Cloudflare Turnstile)
- [ ] Anonymous sign-ins: enabled (záměrně)
- [ ] Custom SMTP server
- [ ] MFA enforcement
- [ ] Password reset flow: funguje správně? Emaily přicházejí?
- [ ] Email confirmation flow: customizované šablony?

### Auth flow funkční testy

**Cíl:** Ověřit že auth flows skutečně fungují, ne jen že jsou zapnuté v Dashboard.

**Checklist:**
- [ ] Password reset: odeslat reset email na admin adresu, ověřit doručení a obsah
- [ ] Email šablony: zkontrolovat v Supabase Dashboard → Authentication → Email Templates (customizované?)
- [ ] Redirect URLs: ověřit v Auth Settings → URL Configuration (Site URL, Redirect URLs)
- [ ] OTP: ověřit expiry nastavení a formát emailu
- [ ] Frontend callback: jak e-shop handluje auth callbacks? (hledat route pro `/auth/callback`, `/reset-password`)

**Bash příkaz:**
```bash
# Hledat auth callback handling ve frontendu
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy
rg "auth/callback|reset-password|confirm|verify" --type js src/
rg "onAuthStateChange|SIGNED_IN|PASSWORD_RECOVERY" --type js src/
```

**API:**
- [ ] Exposed schemas: jen public
- [ ] JWT expiry (3600s)
- [ ] Max rows per request: rozumný limit

**Database:**
- [ ] SSL Enforcement enabled
- [ ] Network Restrictions (Pro plan)
- [ ] Connection pooling mode

**Storage:**
- [ ] Bucket size limits
- [ ] Allowed MIME types
- [ ] Public bucket: jen products-images a blog-images

### Free → Pro upgrade priority

| Feature | Free | Pro | Priorita |
|---------|------|-----|----------|
| Backupy | Nelze stáhnout | Nightly, 7 dní | KRITICKÉ |
| pg_cron | Ne | Ano | VYSOKÉ (cleanup tokens) |
| Pause po neaktivitě | Ano (7 dní) | Ne | KRITICKÉ |
| Network Restrictions | Ne | Ano | VYSOKÉ |
| Log retention | 1 den | 7 dní | STŘEDNÍ |
| Log Drains | Ne | Ano | STŘEDNÍ (Sentry) |

### Backup strategie (Free plan workaround)

**Problém:** Free plan nemá automatické backupy. Data v produkci jsou nechráněná.

```bash
# Ověřit dostupnost pg_dump přes CLI
supabase db dump --linked -f /tmp/test-backup.sql
# Pokud funguje, změřit velikost a čas
ls -la /tmp/test-backup.sql
```

**Checklist:**
- [ ] `supabase db dump --linked` funguje na Free plan?
- [ ] Supabase Dashboard → Database → Backups - co je dostupné?
- [ ] Manual pg_dump přes connection string (Settings → Database → Connection string)
- [ ] Doporučení: cron job (GitHub Actions) pro pravidelný dump
- [ ] Test restore: `psql < dump.sql` na lokální DB
- [ ] Dokumentovat backup proceduru v runbooku

### Monitoring a alerting

```bash
# Error tracking SDK v projektech
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy
rg "sentry|logrocket|bugsnag|datadog|newrelic" --type js --type ts src/ package.json
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy-admin
rg "sentry|logrocket|bugsnag|datadog|newrelic" --type js --type ts src/ package.json
```

**Checklist:**
- [ ] Error tracking: je nasazeno Sentry, LogRocket, nebo jiný nástroj? (pravděpodobně NE)
- [ ] Edge function errors: jak se dozví admin o selhání? (jen Supabase Dashboard → Logs)
- [ ] Uptime monitoring: existuje? (UptimeRobot, Checkly)
- [ ] Stripe webhook failures: Stripe Dashboard → Developers → Webhooks → Failed events
- [ ] Database connection pool exhaustion: monitoring?
- [ ] Doporučení: Sentry pro frontend + Supabase Log Drains (Pro plan)

### Git history secrets scan

```bash
# Scan git historie obou projektů na potenciální secrets
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy
git log -p --all -- '*.ts' '*.js' '*.jsx' '*.tsx' '*.env*' '*.json' | grep -iE "sk_live|sk_test|service_role|supabase_service|secret_key|private_key|password\s*=" | head -50

cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy-admin
git log -p --all -- '*.ts' '*.js' '*.jsx' '*.tsx' '*.env*' '*.json' | grep -iE "sk_live|sk_test|service_role|supabase_service|secret_key|private_key|password\s*=" | head -50
```

**Alternativa (rychlejší, pokud je nainstalován):**
```bash
# trufflehog nebo gitleaks
npx gitleaks detect --source /Users/janparma/Desktop/Projekty/cesty-bez-mapy --no-git
npx gitleaks detect --source /Users/janparma/Desktop/Projekty/cesty-bez-mapy-admin --no-git
```

**Checklist:**
- [ ] Žádné Stripe live/test keys v git historii
- [ ] Žádný Supabase service_role key v git historii
- [ ] Žádné .env soubory commitnuté v historii
- [ ] Pokud nalezeny: rotovat klíče (Stripe Dashboard, Supabase Dashboard → Settings → API)
- [ ] .gitignore obsahuje `.env*`, `supabase/.temp/`

### Deployment infrastruktura

| Aplikace | Hosting | Security headers | CI/CD |
|----------|---------|-----------------|-------|
| E-shop | Vercel (manual deploy) | ŽÁDNÉ ❌ | Manuální |
| Admin | Vercel (auto-deploy) | Částečné ⚠️ (chybí CSP, HSTS) | Vercel auto-deploy |
| Edge Functions | Supabase | N/A | Manual `supabase functions deploy` |

**Checklist:**
- [ ] E-shop: přidat security headers do vercel.json
- [ ] Admin: doplnit CSP a HSTS do vercel.json
- [ ] CI/CD: deploy migrací je manuální - doporučení pro automatizaci?
- [ ] Edge Functions: deployment process - kdo a kdy deployuje?

### SQL dotazy

```sql
-- Extensions v public schema (lint rule 0014)
SELECT extname, extnamespace::regnamespace AS schema FROM pg_extension
WHERE extnamespace = 'public'::regnamespace;

-- Realtime publications
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- Database size
SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size;

-- Connection stats
SELECT count(*) AS active_connections FROM pg_stat_activity;

-- Velikost tabulek pro backup planning
SELECT relname, n_live_tup,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(relid) DESC;
```

### Dependency audit

**npm (oba projekty):**

```bash
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy && npm audit
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy-admin && npm audit
```

- [ ] npm audit: žádné critical/high vulnerabilities
- [ ] @supabase/supabase-js verze: **e-shop ^2.79.0 vs admin ^2.84.0** - sjednotit na nejnovější
- [ ] React verze: **e-shop ^19.1.0 vs admin ^19.0.0** - kompatibilní ale liší se
- [ ] react-router-dom: **e-shop ^7.7.1 vs admin ^7.1.3** - značný rozdíl
- [ ] Žádné deprecated packages

**Deno (Edge Functions) - ověřeno:**

Všechny funkce importují přímo z esm.sh URL (ne z import map):
- `stripe@20` - ověřit zda existuje novější major
- `@supabase/supabase-js@2` - major range, ověřit zda je to dostatečně specifické
- Pouze `create-stripe-product` má lokální `deno.json`
- **Žádný** globální `import_map.json` ani `deno.lock`
- [ ] Doporučení: sjednotit dependency management - buď všechny funkce s deno.json, nebo globální import_map
- [ ] Pinnout na přesné verze (cross-ref Část 4)

**Supabase CLI:**

```bash
supabase --version  # porovnat s latest
```

### Staging environment doporučení
- [ ] Separátní Supabase projekt
- [ ] Separátní Stripe test mode
- [ ] CI/CD: GitHub Actions pro deploy migrací
- [ ] `supabase link` pro přepínání mezi projekty

### Web search
- Supabase production checklist 2026
- Supabase Free vs Pro plan comparison 2026
- esm.sh dependency pinning Deno
- Supabase backup Free plan workaround 2026
- Sentry Supabase Edge Functions integration

### Výstup
Report: `docs/audit-results/cast-6-infrastruktura.md`

---

## ČÁST 7: Konsolidace dokumentace

**Cíl:** Ověřit přesnost všech dokumentů vůči živé DB, identifikovat mezery, navrhnout strukturu. Spustit AŽ PO částech 0-6, 8, 9.

### Soubory k revizi (9 dokumentů)
1. `supabase/MIGRATIONS.md` (1173 řádků)
2. `supabase/rls-policies-audit-v2.md`
3. `supabase/RLS_UNIFICATION_PROPOSAL.md`
4. `supabase/RLS_AUDIT_PROMPT.md`
5. `docs/ARCHITECTURE_DECISIONS.md` (7 ADRs)
6. `docs/CUSTOM_ITINERARY_IMPLEMENTATION.md`
7. `docs/rls-policies-audit.md` (v1 - stará)
8. `CLAUDE.md` (main app)
9. `cesty-bez-mapy-admin/CLAUDE.md` (admin)

### Známé issues v dokumentaci
- [ ] CLAUDE.md (main app) zmiňuje product_categories - DROPNUTA v migraci 009
- [ ] rls-policies-audit-v2.md psáno po 025 - zastaralá po 026-028
- [ ] ADR-005 zmiňuje Turnstile CAPTCHA - NENÍ implementováno
- [ ] CUSTOM_ITINERARY_IMPLEMENTATION.md říká "Frontend NOT yet implemented" - ověřit (CustomItineraryForm.jsx existuje a je 45KB)
- [ ] MIGRATIONS.md sekce 5 (RLS) - aktuální po 028?
- [ ] Admin CLAUDE.md říká Vite 6, ale e-shop má Vite 7 - konzistence?

### Co rozhodnout
- Sjednotit Supabase docs do jednoho DATABASE.md?
- Archivovat staré audity?
- Zavést versioning dokumentů (datum, po které migraci)?
- Přidat runbook pro běžné operace?

### Výstup
Report: `docs/audit-results/cast-7-dokumentace.md` + aktualizované soubory.

---

## ČÁST 8: Stripe datová integrita + E2E verifikace

**Cíl:** Ověřit konzistenci dat mezi Supabase DB a Stripe. Produkty, ceny, webhook konfigurace, payment flow end-to-end verifikace.

**Závislost:** Ideálně po Části 4 (Edge Functions audit).

### Soubory k revizi
- `supabase/functions/create-stripe-product/index.ts`
- `supabase/functions/create-checkout-session/index.ts`
- `supabase/functions/stripe-webhook/index.ts`
- Admin: `src/dataProvider/withStripeSync.ts`

### SQL dotazy

```sql
-- 8A. Všechny produkty s Stripe IDs
SELECT id, title, price, stripe_product_id, stripe_price_id, is_deleted
FROM products ORDER BY title;

-- 8B. Produkty BEZ Stripe IDs (nebyly synced)
SELECT id, title, price FROM products
WHERE stripe_product_id IS NULL OR stripe_price_id IS NULL;

-- 8C. Smazané produkty se Stripe IDs (měli by být archived ve Stripe)
SELECT id, title, stripe_product_id, stripe_price_id FROM products WHERE is_deleted = true;

-- 8D. Objednávky s Stripe session/payment IDs
SELECT id, order_number, status, stripe_session_id, stripe_payment_id, total_amount
FROM orders ORDER BY created_at DESC;

-- 8E. Objednávky bez Stripe payment ID (potenciálně ztracené platby)
SELECT id, order_number, status, stripe_session_id, created_at
FROM orders WHERE stripe_payment_id IS NULL AND status != 'pending';

-- 8F. Cenová konzistence: order_items vs produkty
SELECT oi.id, oi.product_id, oi.price_at_purchase, p.price AS current_price,
  oi.price_at_purchase != p.price AS price_changed
FROM order_items oi JOIN products p ON p.id = oi.product_id;

-- 8G. Integration logs pro Stripe errory
SELECT * FROM integration_logs WHERE service = 'stripe' AND status = 'error'
ORDER BY created_at DESC LIMIT 20;

-- 8H. Idempotence: duplicitní objednávky se stejným stripe_session_id
SELECT stripe_session_id, COUNT(*) as cnt
FROM orders WHERE stripe_session_id IS NOT NULL
GROUP BY stripe_session_id HAVING COUNT(*) > 1;
```

### Stripe CLI / API kontroly

```bash
# Pokud máš Stripe CLI nainstalován:
stripe products list --limit 100
stripe prices list --limit 100
stripe webhooks list
# Posledních 20 webhook eventů
stripe events list --limit 20
```

### Checklist
- [ ] Všechny aktivní produkty v DB mají validní stripe_product_id a stripe_price_id
- [ ] Stripe produkty odpovídají DB produktům (název, cena)
- [ ] Smazané produkty jsou archived ve Stripe (ne active)
- [ ] Stripe Price immutability: při změně ceny se vytváří nový Price, starý se deaktivuje
- [ ] Webhook endpoint URL je správná a aktivní
- [ ] Webhook events: checkout.session.completed je jediný subscribed event? Nebo více?
- [ ] Stripe test mode vs live mode: správně používány?
- [ ] Refund flow: existuje? Je implementován v edge functions?
- [ ] Idempotence: duplicitní webhook eventy nezpůsobí duplicitní objednávky
- [ ] Integration logs zaznamenávají všechny Stripe interakce
- [ ] price_at_purchase v order_items odpovídá Stripe Price v době nákupu

### E2E payment flow verifikace

**Cíl:** Ověřit celý platební flow end-to-end (READ-ONLY, žádné destruktivní akce).

**Webhook endpoint verifikace:**
- [ ] Webhook URL ukazuje na `https://dkblgznhnixubyoghrqe.supabase.co/functions/v1/stripe-webhook`?
- [ ] Webhook je aktivní a doručuje eventy?
- [ ] Které events jsou subscribed? (checkout.session.completed, charge.refunded, ...)

**Refund flow audit:**
- [ ] Existuje edge function pro refundy? (pravděpodobně NE)
- [ ] Jak admin provádí refund? (přímo ve Stripe Dashboard?)
- [ ] Aktualizuje se order status na 'refunded' po Stripe refundu?
- [ ] Webhook: je subscribed na `charge.refunded` event?

**Poznámka:** Plný E2E test (vytvoření checkout session → platba → webhook) vyžaduje buď `stripe trigger checkout.session.completed` nebo manuální test v prohlížeči. Doporučit jako součást manuální test matice.

### Web search
- Stripe webhook best practices 2026
- Stripe product price sync patterns

### Výstup
Report: `docs/audit-results/cast-8-stripe.md`

---

## ČÁST 9: GDPR compliance

**Cíl:** Ověřit soulad s GDPR pro český e-shop - zpracování osobních údajů, souhlas, právo na výmaz, export dat, cookies.

**Závislost:** Ideálně po Části 5b (e-shop frontend audit).

### Soubory k revizi
- E-shop: `src/pages/CustomItineraryForm.jsx` (sbírá osobní údaje)
- E-shop: `src/pages/Contact.jsx` (**sbírá jméno a email** - aktuálně simulovaný submit, ale formulář existuje)
- E-shop: cookie/consent komponenty - **NEEXISTUJÍ** (ověřeno - žádné cookie consent, gdpr, privacy komponenty)
- Admin: `src/resources/customers/` (přístup k osobním údajům)
- Migrace definující newsletter_consent_log
- Privacy policy / obchodní podmínky (pokud existují na webu)

### SQL dotazy

```sql
-- 9A. Newsletter consent log - struktura a data
SELECT column_name, data_type, is_nullable FROM information_schema.columns
WHERE table_name = 'newsletter_consent_log' ORDER BY ordinal_position;

-- 9B. Ukázka consent záznamů
SELECT * FROM newsletter_consent_log ORDER BY created_at DESC LIMIT 10;

-- 9C. Osobní údaje v customers
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'customers' ORDER BY ordinal_position;

-- 9D. Osobní údaje v orders
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'orders' ORDER BY ordinal_position;

-- 9E. Osobní údaje v custom_itinerary_requests (form_data JSONB)
SELECT id, form_data FROM custom_itinerary_requests LIMIT 5;

-- 9F. Auth users metadata
SELECT id, email, raw_user_meta_data, created_at FROM auth.users LIMIT 5;
```

### GDPR checklist

**Zákonný základ zpracování (čl. 6 GDPR):**
- [ ] Souhlas pro newsletter (newsletter_consent_log)
- [ ] Plnění smlouvy pro objednávky (orders, order_items, customers)
- [ ] Oprávněný zájem pro analytics (pokud existují)

**Práva subjektů údajů (čl. 15-22 GDPR):**
- [ ] Právo na přístup (čl. 15): může zákazník exportovat svá data?
- [ ] Právo na opravu (čl. 16): může zákazník opravit své údaje?
- [ ] Právo na výmaz (čl. 17): existuje mechanismus pro smazání všech dat zákazníka?
  - customers záznam
  - orders (anonymizovat nebo smazat?)
  - custom_itinerary_requests (form_data obsahuje osobní údaje)
  - newsletter_consent_log
  - auth.users záznam
  - storage soubory spojené se zákazníkem
- [ ] Právo na přenositelnost (čl. 20): export dat ve strojově čitelném formátu (JSON/CSV)
- [ ] Právo na odvolání souhlasu (čl. 7): může zákazník odvolat newsletter souhlas?

**Informační povinnost (čl. 13-14 GDPR):**
- [ ] Privacy policy na webu existuje a je aktuální
- [ ] Informace o zpracování při sbírání dat (formuláře, checkout)
- [ ] Kontakt na správce údajů

**Cookies a sledování:**
- [ ] Cookie consent banner na webu - **CHYBÍ** (ověřeno, žádná implementace)
- [ ] Přehled používaných cookies (Supabase session, analytics?)
- [ ] Third-party tracking (Google Analytics, Meta Pixel)?
- [ ] LocalStorage: co se ukládá? (cart `cbm_cart`, auth tokens - osobní údaje?)

**Technická opatření (čl. 32 GDPR):**
- [ ] Šifrování při přenosu (HTTPS/SSL) - Supabase default
- [ ] Šifrování v klidu (Supabase PostgreSQL encryption at rest)
- [ ] Přístupová práva (RLS, MFA pro adminy)
- [ ] Audit trail: kdo přistupoval k osobním údajům? (integration_logs? cross-ref Část 5a-i)
- [ ] Data minimizace: sbíráme jen nezbytné údaje?
- [ ] Retenční politika: jak dlouho uchováváme data? (objednávky, customers, expired tokens)

**Zpracovatel (čl. 28 GDPR):**
- [ ] Supabase DPA (Data Processing Agreement) podepsán?
- [ ] Stripe DPA podepsán?
- [ ] Další zpracovatelé (hosting, email provider)?

### Co vytvořit (doporučení)
- Data deletion script/function: SQL funkce pro kompletní vymazání zákazníka
- Data export endpoint: Edge function pro export zákaznických dat (JSON)
- Cookie consent: Implementace cookie banneru
- Privacy policy: Aktualizace nebo vytvoření
- Retenční politika: Definovat dobu uchovávání dat

### Web search
- GDPR e-shop Česká republika povinnosti 2026
- Supabase GDPR compliance DPA
- Cookie consent český e-shop zákon

### Výstup
Report: `docs/audit-results/cast-9-gdpr.md`

---

## Jak spustit každou část

Každá session začíná tímto kontextem:

```
Potřebuji provést ČÁST X (název) komplexního auditu Supabase databáze
pro e-commerce aplikaci s cestovními průvodci.

Projekty:
- Main app: /Users/janparma/Desktop/Projekty/cesty-bez-mapy
- Admin: /Users/janparma/Desktop/Projekty/cesty-bez-mapy-admin
- Supabase ref: dkblgznhnixubyoghrqe

Data v DB: Mix reálných a testovacích dat. Všechny testy MUSÍ používat ROLLBACK.
Audit reporty ukládat do: cesty-bez-mapy/docs/audit-results/

Supabase CLI spouštět z main app adresáře:
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy
supabase db query --linked "SQL"

[OBSAH PŘÍSLUŠNÉ ČÁSTI Z TOHOTO PLÁNU]

Výstup: Report v docs/audit-results/cast-X-nazev.md + konkrétní SQL/code fixy.
Použij web search pro Supabase docs a best practices 2025-2026.
```

## Protokol pro kritické issues

Pokud audit najde kritický bezpečnostní problém:
1. **STOP** - zastavit audit
2. **DOKUMENTOVAT** - zapsat problém, dopad, severity
3. **OPRAVIT IHNED** - vytvořit hotfix migraci/fix
4. **TESTOVAT** - ověřit opravu
5. **POKRAČOVAT** - teprve pak pokračovat

## Verifikace po dokončení všech částí

### Automatické testy

```bash
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy
supabase db lint --linked        # žádné warningy (kromě 0012)
supabase db diff --linked        # žádný drift

cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy-admin
npm run type-check               # žádné chyby
npm run build                    # úspěšný build
```

### Manuální test matice

| Test | Aplikace | Očekávaný výsledek |
|------|----------|-------------------|
| Admin CRUD produktů | Admin | Funguje bez chyb |
| Admin CRUD objednávek | Admin | Funguje bez chyb |
| Admin CRUD custom requests | Admin | Funguje bez chyb |
| Admin upload obrázků/PDF | Admin | Upload do správných bucketů |
| Veřejné zobrazení produktů | E-shop | Pouze aktivní (is_deleted=false) |
| Guest checkout | E-shop | Objednávka bez účtu |
| Custom itinerary form | E-shop | Request vytvořen |
| PDF download přes token | E-shop | Signed URL, expirace OK |
| Newsletter signup | E-shop | Consent uložen, validace OK |
| Stripe produkty match DB | Stripe+DB | Všechny stripe_product_id existují |
| Webhook endpoint aktivní | Stripe | Správná URL, events subscribed |
| GDPR data export | Admin/DB | Zákazník data exportovatelná |
| GDPR data deletion | Admin/DB | Kompletní vymazání možné |

### Verifikační SQL

```sql
-- Všechny policies po migraci 029
SELECT t.tablename, COUNT(p.policyname) as policy_count,
  STRING_AGG(p.policyname, ', ' ORDER BY p.policyname) as policies
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public'
GROUP BY t.tablename ORDER BY t.tablename;

-- Snake_case pojmenování (po 029 by nemělo nic vrátit)
SELECT policyname FROM pg_policies
WHERE schemaname = 'public' AND policyname ~ '[A-Z ]';

-- Žádná tabulka bez RLS
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity;
```

---

## Změny oproti původnímu plánu

1. **CLI setup:** Přidán krok `supabase init` + `supabase link` do Části 0 (config.toml a .supabase/ neexistují)
2. **docs/audit-results/:** Přidáno vytvoření adresáře do Části 0
3. **Edge function importy:** Upřesněno - všechny importují z esm.sh URL, žádný globální import_map, deno.json jen v create-stripe-product
4. **Část 5a-ii:** Přidán `ImageGalleryInput.tsx` do auditu products
5. **Část 5b:** Rozšířena o Contact.jsx (sbírá jméno+email), grep přes VŠECHNY stránky, CustomItineraryDetail.jsx označen jako statický (přeskočit)
6. **Část 6:** Přidány konkrétní verze dependencies a nesrovnalosti (supabase-js ^2.79 vs ^2.84, react-router-dom ^7.7 vs ^7.1)
7. **Část 7:** Přidán issue s CUSTOM_ITINERARY_IMPLEMENTATION.md ("not yet implemented" ale 45KB formulář existuje)
8. **Část 9:** Explicitně potvrzeno - žádné cookie consent komponenty neexistují
9. **Grep syntax:** Použit `rg --type js` místo `grep --include="*.{js,jsx}"`

### Změny z review (sloučení mezer)

10. **Část 0:** Přejmenována na "Verify + Hotfix" - nejdřív ověřit problémy v kódu, pak fixovat. Zachytit originální kód v reportu.
11. **Část 4:** Přidán rate limiting audit - bezpečnostní matice rozšířena, SQL dotazy pro detekci abuse, checklist pro rate limiting.
12. **Část 5a-i:** Přidán admin audit trail - SQL dotazy na auth.audit_log_entries a integration_logs, checklist pro logování admin operací.
13. **Část 5b:** 4 subagenti místo 3 - CustomItineraryForm.jsx (45KB) dostává vlastního dedikovaného subagenta.
14. **Část 6:** Přidána backup strategie pro Free plan (pg_dump workaround, cron job doporučení, test restore).
15. **Část 6:** Přidán monitoring a alerting audit (error tracking, uptime, webhook failures).
16. **Část 6:** Přidány auth flow kontroly (password reset, email confirmation šablony).
17. **Část 4:** Přidána kontrola Edge Function Secrets v Supabase Dashboard.
18. **Část 8:** Přidán E2E payment flow verifikace (webhook endpoint, refund flow, idempotence SQL test, stripe events list).
19. **Subagent tabulka:** Aktualizována - Část 4 má +1 Bash, Část 5a-i má +1 Bash, Část 5b má 4× Explore, celkem ~41 subagentů.

### Změny z finálního review

20. **Část 3b:** Přidán performance audit s EXPLAIN ANALYZE na 4 kritických dotazech + poznámka o RLS testování přes service_role.
21. **Část 2b:** Přidána rollback strategie pro migraci 029 (rollback soubor + backup před aplikací + verifikační kroky).
22. **Část 6:** Přidán git history secrets scan (grep + gitleaks alternativa) pro oba projekty.
23. **Část 0:** Přidána dokumentace supabase/ adresáře v admin projektu (CLI cache, přidat do .gitignore).
24. **Část 0:** Rozšířen deployment krok o verifikaci (curl health check, logy, smoke test, rollback postup).
25. **Část 5b:** NOVÁ sekce - security headers. E-shop na Vercel NEMÁ žádné security headers v vercel.json (na rozdíl od admin). Vite build config (sourcemap, console stripping) funguje správně.
26. **Část 5a-i:** Přidán audit chybějících headers v admin Vercel config (CSP, HSTS).
27. **Část 6:** NOVÁ sekce - deployment infrastruktura přehled (oba projekty na Vercel, edge functions manuální deploy).
28. **Část 4:** CORS wildcard zvýšen na CRITICAL. Přidán konkrétní doporučený fix s origin whitelistem.
29. **Část 4+6:** Edge function dependency pinning zvýšen na HIGH. Přidán konkrétní postup pinnování.
30. **Část 5a-i + 5b:** Přidán env variable audit (nekonzistentní pojmenování, .env v git, chybějící validace).
