# Audit Report: Cast 1b - Migrace a Storage Review

> **Datum:** 2026-02-18
> **Auditor:** Claude Opus 4.6
> **Zavislost:** Cast 1a (Schema SQL verifikace)
> **Scope:** Migracni soubory vs MIGRATIONS.md dokumentace, storage lifecycle, signed URL review

---

## 1. Prehled

### Analyzovane soubory

- 28 migracnich souboru v `supabase/migrations/` (001-028)
- `supabase/MIGRATIONS.md` (1173 radku)
- `docs/ARCHITECTURE_DECISIONS.md` (7 ADR)
- `supabase/functions/get-download-url/index.ts` (199 radku)
- `src/dataProvider/withStorageUpload.ts` (admin panel, 365 radku)
- `src/utils/storageUtils.ts` (admin panel, 155 radku)
- `supabase/migrations/003_storage_buckets_DOCUMENTATION_ONLY.sql`

### Kriticke zjisteni z Casti 1a

**Migrace 026, 027, 028 NEBYLY aplikovany na produkcni DB.** Toto je zasadni kontext pro cely tento report - produkce bezi na stavu po migraci 025.

---

## 2. Migrace: Soubory vs MIGRATIONS.md

### 2.1 Pocet a kompletnost souboru

| Metrika | Ocekavane | Skutecne | Status |
|---------|-----------|----------|--------|
| Pocet migracnich souboru | 28 | 28 | OK |
| Obdobi | 2025-11-04 az 2026-01-29 | 2025-11-04 az 2026-01-29 | OK |
| Pojmenovani | XXX_popis.sql | Konzistentni | OK |

### 2.2 Seznam migraci - shoda se soubory

Vsech 28 souboru odpovida seznamu v MIGRATIONS.md sekce 2. Zadny soubor nechybi, zadny navic.

### 2.3 Stavy migraci v MIGRATIONS.md

| Stav | Pocet | Spravne oznaceno |
|------|-------|------------------|
| OK | 11 | Ano |
| OK s podminkami | 2 (026 pg_cron, 011 seed) | Ano |
| Castecne prepsano | 3 (002, 006, 012) | Ano |
| Prepsano | 7 (015-017, 019-020, 022) | Ano |
| Chybi hlavicka | 1 (021) | Ano |

**Hodnoceni:** Dokumentace stavu je presna a uzitecna.

### 2.4 Graf zavislosti

Graf zavislosti v MIGRATIONS.md sekce 3 je aktualni a zahrnuje migrace az do 028. Zavislostni retezce jsou spravne:
- `025 -> 026 -> 027 -> 028`
- `013 -> 026` (customers FK)
- `002 -> 028` (RLS fix)

**Nalezene issues:**
- **Zadne** - graf je korektni.

### 2.5 ERD (sekce 4) vs migracni soubory

Porovnani ERD v MIGRATIONS.md s migracnimi soubory:

| Tabulka | ERD presnost | Poznamka |
|---------|-------------|----------|
| customers | OK | `id` bez DEFAULT (013), FK na auth.users (026, ale neaplikovano) |
| products | OK | Vsechny sloupce vcetne category_ids (009), total_sales (010) |
| categories | OK | Komentar o odstranenych sloupcich (008) |
| orders | OK | auth_user_id (019), nullable customer_name a stripe_payment_id (026, neaplikovano) |
| order_items | OK | custom_itinerary_request_id (011) |
| custom_itinerary_requests | OK | auth_user_id (012), paid status (021) |
| blog_posts | OK | |
| download_tokens | OK | |
| integration_logs | OK | |
| newsletter_consent_log | OK | |
| user_roles | OK | |

**CRITICAL: ERD dokumentuje stav PO migraci 028, ale produkce bezi na 025.** To znamena:
- ERD ukazuje `orders.customer_name` jako nullable, ale v produkci je NOT NULL
- ERD ukazuje `orders.stripe_payment_id` jako nullable, ale v produkci je NOT NULL
- ERD ukazuje FK `customers.id -> auth.users(id)`, ale v produkci neexistuje
- ERD komentar `"FK auth.users(id) ON DELETE CASCADE, no DEFAULT"` je castecne nepravdivy pro produkci - DEFAULT byl odstranen v 013 (OK), ale FK chybi

**Doporuceni:** Pridat do MIGRATIONS.md jasnou poznamku, ze ERD odpovidaji stavu po 028, a ze migrace 026-028 je nutne aplikovat.

### 2.6 Indexy (sekce 7) vs migracni soubory

MIGRATIONS.md dokumentuje 35+ indexu. Na zaklade analyzy migracnich souboru:

| Zdroj indexu | Migrace | Pocet |
|-------------|---------|-------|
| customers | 001 | 1 |
| products | 001, 005, 006, 009, 010 | 12 |
| orders | 001, 019 | 7 |
| order_items | 001, 011 | 3 |
| custom_itinerary_requests | 001, 012 | 6 |
| blog_posts | 001 | 2 |
| download_tokens | 001 | 3 |
| integration_logs | 001 | 4 |
| newsletter_consent_log | 001, 018 | 3 |
| user_roles | 001 | 1 |

Celkem: ~42 indexu (vcetne PK a UNIQUE constraints). Dokumentace rika "35+", coz je konzistentni (PK a UK se typicky nepocitaji separatne).

**Hodnoceni:** Shoda je dobra. Zadny index v souborech nechybi v dokumentaci a naopak.

### 2.7 Known Issues (sekce 9)

MIGRATIONS.md dokumentuje 35 known issues. Analyza spravnosti:

#### Kriticke (#1-#10)

| # | Status v doc | Skutecnost | OK? |
|---|-------------|------------|-----|
| 1 | Opraveno v 025 | Opraveno (potvrzeno v 025 - DROP vsech starych policies) | OK |
| 2 | Opraveno v 025 | Opraveno (DROP "Anon role blocked" v 025 cast A.1) | OK |
| 3 | Opraveno v 016 | Opraveno (016 fixuje app_metadata.role) | OK |
| 4 | Opraveno v doc | Spravne - status CHECK neobsahuje 'paid' | OK |
| 5 | Opraveno v 026 | **POZOR: 026 NENI APLIKOVANO** - v produkci NOT NULL | PROBLEM |
| 6 | Opraveno v 026 | **POZOR: 026 NENI APLIKOVANO** - v produkci NOT NULL | PROBLEM |
| 7 | Opraveno v 016 | Opraveno | OK |
| 8 | Opraveno v 027 | **POZOR: 027 NENI APLIKOVANO** - policy stale vyzaduje customer_name | PROBLEM |
| 9 | Opraveno v 028 | **POZOR: 028 NENI APLIKOVANO** - products_public_select stale USING(true) | PROBLEM |
| 10 | Opraveno v 028 | **POZOR: 028 NENI APLIKOVANO** - newsletter bez validace | PROBLEM |

#### Stredni (#8-#20 doc cislovani)

Vsechny stredni issues jsou spravne oznaceny. Klicove:
- #11 (customers FK): Oznaceno "Opraveno v 026" ale **026 neni aplikovano** - FK v produkci chybi
- #19 (handle_new_user osirela): Oznaceno "Opraveno v 026" ale **neni aplikovano** - funkce v produkci existuje

#### Nizke (#21-#35)

Vsechny nizke issues jsou spravne oznaceny a jsou korektne historicke/dokumentacni.

**CRITICAL FINDING:** 7 z 35 known issues je oznaceno jako "Opraveno" ale oprava neni v produkci, protoze migrace 026-028 nebyly aplikovany.

### 2.8 Kvalita migracnich souboru

#### Dodrzovani konvenci

| Konvence | Dodrzovano | Vyjimky |
|----------|-----------|---------|
| Hlavicka (metadata blok) | 27/28 | 021 chybi hlavicka |
| Dependencies v hlavicce | 24/28 | 001-004 (zakladni, bez zavislosti) |
| Idempotentni prikazy | 26/28 | 001 (initial, neni treba), 021 |
| SUCCESS MESSAGE | 22/28 | Starsi migrace (001-004) nemaji |
| SECURITY DEFINER + search_path | Opraveno v 014 | 013 pouzivala `search_path = public` misto `''` |

#### Bezpecnostni vzory

| Vzor | Pouzivano od | Poznamka |
|------|-------------|----------|
| `(SELECT is_admin())` | 024 | Pred 024 pouze `is_admin()` |
| `(SELECT auth.uid())` | 024 | Pred 024 pouze `auth.uid()` |
| `SET search_path = ''` | 014+ | 013 mel `= public`, opraveno v 014 |
| `SECURITY DEFINER` | 002+ | Spravne pro trigger funkce |
| `ON CONFLICT DO NOTHING` | 013+ | Dobra praxe pro idempotenci |

#### Evoluce RLS policies

Retezec oprav pro custom_itinerary_requests policies je nejdelsi:
```
002 -> 012 -> 014 -> 015 -> 016 -> 022 -> 024 -> 025
```
To je 8 migraci pro jednu tabulku. Dokumentace v MIGRATIONS.md sekce 3 (Retezec oprav) toto spravne zachycuje.

### 2.9 Migrace 013 - Detailni analyza

Migrace 013 je klicova pro customer lifecycle:

**Pozitiva:**
- Robustni DO $$ blok s warningem pro existujici data
- ON CONFLICT DO NOTHING pro prevenci duplicit
- Spravne pouziti SECURITY DEFINER
- Dobre komentare a success message
- Trigger WHEN clause pro efektivitu (`OLD.email IS DISTINCT FROM NEW.email`)

**Problemy:**
1. **`SET search_path = public`** misto `= ''` - bezpecnostni issue, opraveno v 014
2. **`ALTER COLUMN id DROP DEFAULT`** - nezdokumentovano v hlavicce migrace, ale je to zasadni zmena chovani (customers.id uz neni auto-generovane)
3. **Chybi FK na auth.users** - pridano az v 026 (neni aplikovano)
4. **Warning misto Exception** - migrace upozorni na existujici data ale nezablokuje se (zakomentovany `RAISE EXCEPTION`)

### 2.10 Migrace 024-025 - Velky RLS refaktoring

**024 (RLS Performance):**
- Spravne prepsani `is_admin()` na PL/pgSQL s cache
- Pridani `is_permanent_user()` helperu
- Konzistentni vzor `(SELECT is_admin())` ve vsech policies
- 27 policies aktualizovano vcetne storage

**025 (Cleanup Duplicate Policies):**
- Systematicky DROP vsech moznych nazvu (stare i nove konvence)
- Vcetne auto-generovanych duplicit z Dashboardu (s nahodnymi suffixy)
- Kratke okno bez policies behem migrace (dokumentovano jako known issue #33)
- Storage policies v DO $$ bloku s EXCEPTION handlerem

**Hodnoceni:** Obe migrace jsou kvalitni, dobre dokumentovane a rizeni rizik je adekvatni.

### 2.11 Migrace 026-028 - Neaplikovane

**026 (Fix Active Bugs):**
- Fix NOT NULL constraints (stripe_payment_id, customer_name)
- FK customers -> auth.users s robustnim handling orphaned records
- pg_cron setup s graceful degradation pro Free tier
- Drop osirele handle_new_user()

**027 (Fix Orders INSERT Policy):**
- Odstraneni customer_name IS NOT NULL z INSERT policy
- Navazuje na 026 (schema fix) s policy fixem

**028 (Fix Products + Newsletter):**
- products_public_select: `USING(true)` -> `USING(is_deleted = false)`
- newsletter: pridani WITH CHECK validace
- Defense in depth pattern

**CRITICAL:** Vsechny tri migrace resi realne bugy, ktere jsou v produkci STALE AKTIVNI:
1. Anonymous checkout nefunguje (orders NOT NULL constraints)
2. Soft-deleted products jsou viditelne na e-shopu
3. Newsletter INSERT bez validace v RLS

---

## 3. Storage Lifecycle Review

### 3.1 Bucket konfigurace

| Bucket | Public | Limit | MIME | Popis |
|--------|--------|-------|------|-------|
| products-pdfs | Ne (private) | 200 MB | application/pdf | PDF pruvodci |
| products-images | Ano | 10 MB | image/jpeg, png, webp | Obrazky produktu |
| blog-images | Ano | 10 MB | image/jpeg, png, webp | Obrazky k clankum |

**Zdroj:** Migrace 003 (documentation only, vytvoreno pres Dashboard).

**Hodnoceni:**
- Limity jsou rozumne (200 MB pro PDF je dostatecne, 10 MB pro obrazky OK)
- MIME typy jsou spravne omezeny
- Private bucket pro PDFs je spravny pristup

### 3.2 Storage RLS Policies

Finalni stav (po 025, aktualni v produkci):

| Bucket | INSERT | UPDATE | DELETE | SELECT |
|--------|--------|--------|--------|--------|
| blog-images | is_admin() | is_admin() | is_admin() | - (public) |
| products-images | is_admin() | is_admin() | is_admin() | - (public) |
| products-pdfs | is_admin() | is_admin() | is_admin() | is_admin() |

**Pozitiva:**
- Vsechny operace vyzaduji admin pristup
- Public buckety nemaji SELECT policy (spravne - Supabase public bucket obchazi RLS pro cteni)
- Private bucket (products-pdfs) ma SELECT policy - spravne

**Potencialni issue:**
- Zadna rate limitace na storage operace (zavisi na Supabase interni ochrane)

### 3.3 Signed URL Lifecycle

**Edge function `get-download-url`:**
- Signed URL expiry: **3600 sekund (1 hodina)**
- Pouziva `service_role` klic (obchazi RLS) - spravne pro server-side operaci
- Overuje download token expiraci pred generovanim URL
- Vraci HTTP 410 (Gone) pro expired tokeny - spravna HTTP semantika

**Admin panel `storageUtils.ts`:**
- Default expiry: **3600 sekund (1 hodina)** - konzistentni s edge function
- Admin panel generuje signed URLs pro nahled PDF v admin rozhrani

**Hodnoceni:** 1 hodina je rozumny kompromis mezi bezpecnosti a uzivatelskym komfortem. Uzivatel ma dost casu stahnout soubor, ale URL neni platna natrvalo.

**Doporuceni:**
- Zvazit zkraceni na 30 minut pro vyssi bezpecnost (stale dostatecne pro stazeni)
- Zvazit pridani logovani pouziti signed URLs do integration_logs

### 3.4 Upload/Delete Lifecycle (Admin Panel)

Analyzovano v `withStorageUpload.ts`:

#### Create Flow
1. Image upload -> public URL ulozena do `image_url`
2. PDF upload -> path ulozeny do `pdf_url` (ne URL, signed URL se generuje on-demand)
3. Gallery images -> array zpracovan, public URLs ulozeny

#### Update Flow
1. Novy soubor: stary se smaze, novy se uploadne
2. Gallery: porovnani starych a novych URL, smazani odstranenych
3. Chyba pri delete stareho souboru: warning, ale pokracuje (spravne)

#### Delete Flow (hard delete)
1. Soft delete (`is_deleted=true`): soubory se **NECHAJI** - spravne
2. Hard delete: pokusi se smazat vsechny soubory (image, PDF, gallery)
3. Chyba pri delete: warning, ale DB delete pokracuje - spravne

**Pozitiva:**
- Dobra error handling (catch + continue pattern)
- Rozliseni soft/hard delete
- Gallery cleanup pri update (smaze odstranene obrazky)

### 3.5 Orphaned Files - Analyza

#### Scenar 1: Soft-deleted produkty
Kdyz se produkt "smaze" (soft delete, `is_deleted = true`):
- Soubory v Storage zustanou - **zamerne** (product muze byt obnoven)
- Stazeni PDF stale funguje pres download tokeny (pokud existuji)
- Po migraci 028 (neaplikovano): RLS skryje soft-deleted produkty pro verejnost

**Problem:** Bez migrace 028 jsou soft-deleted produkty viditelne na e-shopu vcetne jejich obrazku.

#### Scenar 2: Hard-deleted produkty
- `beforeDelete` callback v admin panelu maze soubory
- Ale pokud se produkt smaze jinak (pres SQL, pres Dashboard), soubory zustanu osirele

#### Scenar 3: Update s novym souborem
- `beforeUpdate` maze stary soubor pred uploadem noveho - OK
- Ale pokud upload noveho selze, stary je uz smazany - **potencialni data loss**

#### Scenar 4: Blog post images
- Stejny pattern jako products - beforeDelete cisti, beforeUpdate nahrazuje
- Zadny soft-delete pro blog posts (hard delete only)

**MEDIUM: Zadna periodicka cleanup strategie pro osirele soubory neexistuje.**

Doporuceni:
1. Vytvort cron job (po upgrade na Pro) nebo edge function pro periodicke porovnani souboru v bucketech s DB zaznamy
2. Zvazit preventivni opatreni - upload noveho souboru PRED smazanim stareho

### 3.6 Download Token Lifecycle

| Aspekt | Hodnota | Hodnoceni |
|--------|---------|-----------|
| Expirace tokenu | Neni explicitne v kodu (zavisna na vytvareni) | Overit v checkout flow |
| Cleanup funkce | `cleanup_expired_tokens()` | Existuje od migrace 002 |
| Automaticky cleanup | pg_cron (migrace 026, neni aplikovano) | **NEFUNGUJE** |
| Manualni cleanup | Mozny pres SQL | Nikdy se automaticky nespousti |

**MEDIUM:** Na produkci neexistuje automaticky cleanup expired tokenu. Migrace 026 (s pg_cron) neni aplikovana, a i kdyby byla, pg_cron vyzaduje Pro plan.

---

## 4. ARCHITECTURE_DECISIONS.md Review

### 4.1 Relevance ADR

| ADR | Relevantni | Aktualni |
|-----|-----------|----------|
| ADR-001 (Anonymous Auth) | Ano | Ano - pouziva se Supabase Anonymous Sign-In |
| ADR-002 (auth_user_id column) | Ano | Ano - zakladni architekturni rozhodnuti |
| ADR-003 (Database Triggers) | Ano | Ano - triggery z migrace 013 |
| ADR-004 (window.print PDF) | Ano | Ano - pouziva se pro custom itinerary preview |
| ADR-005 (Cloudflare Turnstile) | Ano | Neovereno - nutno zkontrolovat implementaci |
| ADR-006 (No useTransition) | Nizka | Ano - jednoducha navigace |
| ADR-007 (Post-purchase account) | Ano | Neovereno - nutno zkontrolovat frontend |

### 4.2 ADR-002 vs skutecnost

ADR-002 popisuje "Alternative 3: Make customers.id = auth.users.id" jako odmitnutou alternativu s oduvodnenim "Can't because gen_random_uuid() already set". Ale migrace 013 presne toto dela (`ALTER COLUMN id DROP DEFAULT`). To je fakticky ROZPOR:

- ADR-002 rika: pouzivame dual-column pattern (auth_user_id + customer_id)
- Migrace 013 navic MENI customers.id aby odpovidal auth.users.id
- Vysledek: oba pristupy jsou implementovany soucasne, coz je vlastne spravne, ale ADR to presne nereflektuje

**LOW:** ADR-002 by mel byt aktualizovan, aby reflektoval zmenu v migraci 013 (customers.id = auth.users.id).

### 4.3 Posledni aktualizace

ARCHITECTURE_DECISIONS.md uvadi "Last Updated: 2026-01-10" a "Next Review: After Sprint 4 (Testing)". Dokument nebyl aktualizovan po migracich 014-028.

**LOW:** Dokument je v zakladech spravny, ale neobsahuje poznejsi vyvoj (is_admin() refactoring v 024, RLS cleanup v 025, atd.).

---

## 5. Shrnuty nalezů

### CRITICAL

| # | Nalez | Dopad | Doporuceni |
|---|-------|-------|------------|
| C1 | Migrace 026-028 neaplikovany na produkci | 5 aktivnich bugu v produkci (anonymous checkout, soft-delete visibility, newsletter validation, osirela funkce, chybejici FK) | **Okamzite aplikovat migrace 026, 027, 028 na produkci** |
| C2 | MIGRATIONS.md oznacuje issues #5,6,8,9,10,11,19 jako "Opraveno" | Zavadejici dokumentace - opravy nejsou v produkci | Pridat do MIGRATIONS.md sekci "Pending Production Deployment" |

### HIGH

| # | Nalez | Dopad | Doporuceni |
|---|-------|-------|------------|
| H1 | Soft-deleted produkty viditelne na e-shopu | Smazane produkty se zobrazuji zakaznikum (products_public_select USING true) | Soucasti C1 (migrace 028) |
| H2 | Anonymous checkout blokovan | NOT NULL constraints na orders.customer_name a stripe_payment_id | Soucasti C1 (migrace 026) |
| H3 | Expired download tokeny se nehromadne cistí | Rust DB size, potencialni performance impact | Po aplikaci 026: upgrade na Pro plan pro pg_cron, nebo implementovat alternativni cleanup |

### MEDIUM

| # | Nalez | Dopad | Doporuceni |
|---|-------|-------|------------|
| M1 | Zadna cleanup strategie pro osirele storage soubory | Storage se pomalu plni nereferencovanymi soubory | Vytvorit periodicke porovnani storage vs DB |
| M2 | Upload-then-delete pattern v beforeUpdate | Pokud upload noveho souboru selze, stary je uz smazany | Zmenit poradi: upload novy, pak delete stary |
| M3 | ERD v MIGRATIONS.md neodpovida produkci | Dokumentace je misleading | Pridat jasne oznaceni stavu produkce |

### LOW

| # | Nalez | Dopad | Doporuceni |
|---|-------|-------|------------|
| L1 | ADR-002 neaktualizovan po migraci 013 | Dokumentacni mezera | Aktualizovat ADR |
| L2 | ARCHITECTURE_DECISIONS.md neaktualizovan od 2026-01-10 | Chybi informace o pozdejsim vyvoji | Aktualizovat po auditu |
| L3 | Migrace 021 bez standardni hlavicky | Horsí citelnost | Nelze zpetne opravit, poznamenat |
| L4 | 8 opravnych migraci pro custom_itinerary_requests RLS | Slozity retezec oprav | Zvazit konsolidovanou migraci pro ciste instalace |

---

## 6. Checklist (ze zadani)

- [x] Vsechny sloupce odpovidaji MIGRATIONS.md sekce 4 (ERD) - **Ano, ale ERD reflektuje stav po 028 (ne produkci)**
- [x] Indexy odpovidaji dokumentaci (~35) - **Ano, ~42 vcetne PK/UK, dokumentace uvadi 35+**
- [x] 35 known issues z MIGRATIONS.md sekce 9 spravne oznaceny - **NE: 7 issues oznaceno jako "Opraveno" ale opravy nejsou v produkci (C2)**
- [x] Migration states (OK, Superseded) spravne v MIGRATIONS.md - **Ano**
- [x] Dependency graph v MIGRATIONS.md aktualni - **Ano**
- [x] ADRs v ARCHITECTURE_DECISIONS.md stale relevantni - **Ano, s mensimi mezerami (L1, L2)**
- [ ] Storage: zadne orphaned soubory pro smazane produkty - **NEOVERENO (vyzaduje SQL dotaz 1R na produkci)**
- [x] Storage: signed URL expiry cas v get-download-url je primereny - **Ano, 3600s = 1 hodina**
- [ ] Storage: cleanup strategie pro osirele soubory existuje - **NE (M1)**

---

## 7. Akcni polozky (prioritizovane)

| Priorita | Akce | Slozitost | Zavislost |
|----------|------|-----------|-----------|
| **P0** | Aplikovat migrace 026, 027, 028 na produkci | Nizka | Zadna |
| **P0** | Aktualizovat MIGRATIONS.md - pridat sekci o neaplikovanych migracich | Nizka | Zadna |
| **P1** | Overit orphaned soubory v storage (SQL dotaz 1R) | Nizka | Pristup k produkci |
| **P1** | Overit pocty souboru v bucketech (SQL dotaz 1S) | Nizka | Pristup k produkci |
| **P2** | Opravit upload-before-delete pattern v withStorageUpload.ts | Nizka | Zadna |
| **P2** | Implementovat periodicke storage cleanup (edge function nebo cron) | Stredni | Pro plan (pro cron) |
| **P3** | Aktualizovat ARCHITECTURE_DECISIONS.md | Nizka | Zadna |

---

## 8. SQL dotazy k rucnimu spusteni (z audit planu)

Tyto dotazy nebyly spusteny (omezeni auditu - bez Bash pristupu):

```sql
-- 1R. Storage: orphaned soubory (smazane produkty se soubory v bucketu)
SELECT id, title, image_url, pdf_url, is_deleted FROM products WHERE is_deleted = true;

-- 1S. Storage: pocty souboru v bucketech
SELECT bucket_id, COUNT(*) as file_count,
  pg_size_pretty(SUM(COALESCE((metadata->>'size')::bigint, 0))) as total_size
FROM storage.objects GROUP BY bucket_id ORDER BY bucket_id;
```

**Doporuceni:** Spustit tyto dotazy v dalsim kroku auditu nebo manualne pres `supabase db query --linked`.

---

*Report vygenerovan: 2026-02-18*
*Auditor: Claude Opus 4.6 (Cast 1b)*
