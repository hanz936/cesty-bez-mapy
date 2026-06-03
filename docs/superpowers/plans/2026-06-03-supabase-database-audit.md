# Audit Supabase databáze + konsolidace migrací — Implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Důkazně podložený audit celé Supabase vrstvy (DB/Auth/Storage/API/edge funkce), oprava všech nálezů jako migrace s review gates a konsolidace 46 migrací do jedné baseline — vše proti dokumentaci 06/2026.

**Architecture:** Fázový postup s review gates. Fáze 1–2 (discovery + report) jsou read-only a plně konkrétní. Fáze 3 (remediation) je procesní šablona instancovaná per nález až **po schválení reportu** (přesné opravné SQL vzniká z nálezů). Fáze 4–6 (typy, konsolidace, docs) jsou opět plně konkrétní příkazy. Žádný destruktivní reset remote — data se zachovají; konsolidace mění jen historii migrací.

**Tech Stack:** Supabase CLI v2.104.0, Postgres 17, Supabase MCP (`get_advisors`, `execute_sql`, `apply_migration`, `generate_typescript_types`), Context7 + Firecrawl (ověřování 06/2026), Deno edge funkce.

**Spec:** [docs/superpowers/specs/2026-06-03-supabase-database-audit-design.md](../specs/2026-06-03-supabase-database-audit-design.md)
**Projekt ref:** `dkblgznhnixubyoghrqe` · **Repo:** `cesty-bez-mapy` (frontend) · **Větev:** `chore/supabase-db-audit`

---

## File Structure

**Vytvoří se (committed audit trail):**
- `docs/superpowers/audits/2026-06-03-supabase-audit.md` — finální audit report se severitami
- `docs/superpowers/audits/2026-06-03-evidence/` — syrové výstupy (advisors JSON, introspekce, verify_jwt matice)
- `supabase/migrations/0NN_*.sql` — nové opravné migrace (per blok, číslování navazuje na 046)
- `supabase/migrations/_archive/` — sem se přesune 46 původních migrací při konsolidaci
- `supabase/migrations/<ts>_baseline.sql` — jedna konsolidovaná baseline (Fáze 5)

**Upraví se:**
- `supabase/config.toml` — případné `verify_jwt` / auth / api opravy
- `supabase/functions/<name>/index.ts` — opravy edge funkcí
- `supabase/MIGRATIONS.md` — reconciliace (Fáze 6)
- `cesty-bez-mapy-admin` + `cesty-bez-mapy` — regenerované TS typy (Fáze 4)

**Pomocné (gitignored):** `.firecrawl/` (scrapy), `.audit-tmp/` (scratch).

---

## FÁZE 0 — Příprava a evidence scaffolding

### Task 0.1: Ověřit větev a vytvořit evidence adresáře

**Files:**
- Create: `docs/superpowers/audits/2026-06-03-evidence/.gitkeep`

- [ ] **Step 1: Ověřit větev**

Run: `git -C /Users/janparma/Desktop/Projekty/cesty-bez-mapy branch --show-current`
Expected: `chore/supabase-db-audit`

- [ ] **Step 2: Vytvořit adresáře**

```bash
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy
mkdir -p docs/superpowers/audits/2026-06-03-evidence
mkdir -p .audit-tmp
touch docs/superpowers/audits/2026-06-03-evidence/.gitkeep
grep -qxF '.audit-tmp/' .gitignore || echo '.audit-tmp/' >> .gitignore
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/audits/2026-06-03-evidence/.gitkeep .gitignore
git commit -m "chore(audit): evidence scaffolding"
```

### Task 0.2: Baseline snapshot historie migrací

**Files:**
- Create: `docs/superpowers/audits/2026-06-03-evidence/00-migration-list-before.txt`

- [ ] **Step 1: Zachytit stav historie migrací (LOCAL vs REMOTE)**

Run: `supabase migration list --linked > docs/superpowers/audits/2026-06-03-evidence/00-migration-list-before.txt 2>&1`
Expected: tabulka LOCAL │ REMOTE │ TIME; **zkontrolovat, že LOCAL a REMOTE sloupce sedí** (žádný drift). Pokud je drift, poznamenat — ovlivní Fázi 5.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/audits/2026-06-03-evidence/00-migration-list-before.txt
git commit -m "chore(audit): snapshot migration history before audit"
```

---

## FÁZE 1 — Discovery sweep (read-only, žádné změny)

### Task 1.1: Supabase advisors (security + performance)

**Files:**
- Create: `docs/superpowers/audits/2026-06-03-evidence/01-advisors-security.json`
- Create: `docs/superpowers/audits/2026-06-03-evidence/01-advisors-performance.json`

- [ ] **Step 1: Spustit security advisor přes MCP**

Použij MCP nástroj `get_advisors` s `project_id="dkblgznhnixubyoghrqe"`, `type="security"`. Výstup ulož do `01-advisors-security.json`.

- [ ] **Step 2: Spustit performance advisor přes MCP**

Použij MCP `get_advisors` s `type="performance"`. Výstup ulož do `01-advisors-performance.json`.

- [ ] **Step 3: Zmapovat nálezy na katalog lintů**

Pro každý nález zaznamenat lint kód (0001–0029) a surface dle §5 specu. Toto je páteř reportu.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/audits/2026-06-03-evidence/01-advisors-*.json
git commit -m "audit(discovery): advisors security + performance snapshot"
```

### Task 1.2: Introspekce schématu, RLS, funkcí, indexů, grantů, storage

**Files:**
- Create: `docs/superpowers/audits/2026-06-03-evidence/02-introspection.md`

Spusť každý dotaz přes MCP `execute_sql` (read-only) a výstupy slož do `02-introspection.md` pod nadpisy.

- [ ] **Step 1: Tabulky + RLS status**

```sql
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;
```
Expected: seznam 11 tabulek; **každá musí mít `rls_enabled = true`** (jinak lint 0013).

- [ ] **Step 2: Všechny RLS policies (per operace, role, výrazy)**

```sql
select schemaname, tablename, policyname, permissive, roles, cmd,
       qual as using_expr, with_check as check_expr
from pg_policies
where schemaname in ('public','storage')
order by tablename, cmd, policyname;
```
Expected: ~50 policies. Sledovat: `USING (true)` díry, `auth.uid()` bez `(select …)` (lint 0003), nekonzistentní pojmenování, duplicitní permissive policies (lint 0006/0024), policies odkazující `user_metadata` (lint 0015).

- [ ] **Step 3: Tabulky bez primárního klíče (lint 0004)**

```sql
select c.relname
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public' and c.relkind='r'
  and not exists (
    select 1 from pg_constraint con
    where con.conrelid = c.oid and con.contype = 'p')
order by 1;
```
Expected: ideálně prázdné.

- [ ] **Step 4: Funkce — security definer, search_path, jazyk (linty 0010/0011)**

```sql
select n.nspname as schema, p.proname as func,
       p.prosecdef as security_definer,
       p.proconfig as config,
       l.lanname as language
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname in ('public')
order by 2;
```
Expected: každá `security_definer = true` funkce **musí** mít v `config` `search_path=...` (jinak lint 0011). Zaznamenat funkce bez pinned search_path.

- [ ] **Step 5: Grants EXECUTE na funkce (linty 0028/0029)**

```sql
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon_exec,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by 1;
```
Expected: žádná `security_definer` funkce by neměla mít `anon_exec=true` bez záměru (navazuje na migraci 032).

- [ ] **Step 6: Triggery**

```sql
select event_object_table as table_name, trigger_name,
       action_timing, event_manipulation, action_statement
from information_schema.triggers
where trigger_schema = 'public'
order by 1,2;
```

- [ ] **Step 7: Indexy + neindexované FK (linty 0001/0005/0009)**

```sql
-- neindexované foreign keys
select conrelid::regclass as table_name, conname as fk
from pg_constraint c
where contype = 'f' and connamespace = 'public'::regnamespace
  and not exists (
    select 1 from pg_index i
    where i.indrelid = c.conrelid
      and (c.conkey::int[]) <@ (i.indkey::int[]))
order by 1;
```
Expected: zaznamenat neindexované FK. Doplnit dotaz na `pg_stat_user_indexes` pro nevyužité indexy (idx_scan = 0).

- [ ] **Step 8: Extensions — schéma + verze (linty 0014/0022)**

```sql
select e.extname, n.nspname as schema, e.extversion as installed,
       (select default_version from pg_available_extensions a
         where a.name = e.extname) as latest
from pg_extension e
join pg_namespace n on n.oid = e.extnamespace
order by 1;
```
Expected: žádná extension v `public` (lint 0014); `installed = latest` (jinak 0022).

- [ ] **Step 9: Storage buckety + public flag (lint 0025)**

```sql
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets order by name;
```
Expected: `products-images`, `blog-images` public; `products-pdfs` private. Ověřit, že public buckety nemají policy umožňující listing (lint 0025).

- [ ] **Step 10: Foreign keys + ON DELETE chování**

```sql
select conrelid::regclass as child, conname,
       confrelid::regclass as parent, confdeltype as on_delete
from pg_constraint
where contype='f' and connamespace='public'::regnamespace
order by 1;
```
Expected: ověřit konzistenci kaskád (`confdeltype`: a=NO ACTION, c=CASCADE, n=SET NULL).

- [ ] **Step 11: Commit**

```bash
git add docs/superpowers/audits/2026-06-03-evidence/02-introspection.md
git commit -m "audit(discovery): schema/RLS/functions/indexes/storage introspection"
```

### Task 1.3: Edge funkce — inventář, verify_jwt matice, čtení kódu

**Files:**
- Create: `docs/superpowers/audits/2026-06-03-evidence/03-edge-functions.md`

- [ ] **Step 1: Sestavit verify_jwt matici**

Pro každou z 13 funkcí (`create-checkout-session`, `create-invoice`, `create-stripe-product`, `csp-report`, `download-invoice-pdf`, `get-blog-preview`, `get-download-url`, `get-order-by-session`, `resend-email`, `resend-webhook`, `send-custom-itinerary-email`, `stripe-webhook`, `submit-contact-form`) zaznamenat:
- `verify_jwt` v `supabase/config.toml` (default `true`, pokud blok chybí)
- jak funkce ověřuje volajícího v kódu (signature / service-role / anon)

Z `config.toml` mají `verify_jwt = false` jen: `submit-contact-form`, `stripe-webhook`, `csp-report`.

- [ ] **Step 2: Cross-check podpisů u webhooků**

Přečíst `index.ts` u `stripe-webhook` (Stripe signature), `resend-webhook` (svix/Resend signature), `csp-report` (size limit / žádná auth), `submit-contact-form` (Turnstile). **Nález-kandidát:** `resend-webhook` má default `verify_jwt = true`, ale Resend neumí posílat Supabase JWT — ověřit, jak je nasazené (`--no-verify-jwt` flag?) a jestli funguje. Zaznamenat.

- [ ] **Step 3: Bezpečnostní průchod každé funkce**

Pro každou funkci zkontrolovat: validace vstupů, CORS hlavičky, leaky secretů do response/logů, error handling (žádné polykání chyb), idempotence webhooků. Zaznamenat nálezy se severitou.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/audits/2026-06-03-evidence/03-edge-functions.md
git commit -m "audit(discovery): edge functions verify_jwt matrix + security pass"
```

### Task 1.4: Auth / API / network konfigurace

**Files:**
- Create: `docs/superpowers/audits/2026-06-03-evidence/04-config.md`

- [ ] **Step 1: Zachytit relevantní config.toml sekce**

Zaznamenat z `supabase/config.toml`: `[api] schemas`, `max_rows`, `[auth]` (MFA, password policy, JWT expiry, anonymous sign-ins — lint 0012), `[db.network_restrictions]`, TLS/SSL enforcement.

- [ ] **Step 2: Ověřit live auth nastavení (které nejsou v config.toml)**

Zkontrolovat v Supabase dashboardu / přes MCP: leaked-password protection (HaveIBeenPwned), MFA enforcement, anonymous sign-ins enabled. Zaznamenat.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/audits/2026-06-03-evidence/04-config.md
git commit -m "audit(discovery): auth/api/network config snapshot"
```

---

## FÁZE 2 — Verifikace best practices + audit report

### Task 2.1: Ověřit nálezy proti dokům 06/2026 a přiřadit severity

- [ ] **Step 1: Pro každou kategorii nálezů ověřit doporučení**

Pro každý typ nálezu (RLS pattern, search_path, extension placement, verify_jwt, …) ověřit aktuální doporučení přes Context7 (`/websites/supabase`, `/supabase/cli`) nebo Firecrawl (pokud Context7 nestačí). Zdroje už částečně staženy v `.firecrawl/` — nestahovat znovu.

- [ ] **Step 2: Přiřadit severity**

Každému nálezu přiřadit Critical / High / Medium / Low + konkrétní remediation. Kritéria: Critical = exploitovatelná díra (RLS bypass, exposed sensitive data, nezautentizovaný webhook); High = bezpečnostní lint bez přímého exploitu; Medium = výkon/konzistence; Low = kosmetika.

### Task 2.2: Napsat audit report

**Files:**
- Create: `docs/superpowers/audits/2026-06-03-supabase-audit.md`

- [ ] **Step 1: Vytvořit report dle šablony**

```markdown
# Supabase Audit — cesty-bez-mapy (2026-06-03)

> Projekt: dkblgznhnixubyoghrqe · Postgres 17 · CLI v2.104.0
> Ověřeno proti dokumentaci 06/2026 (Context7 + Firecrawl)

## Souhrn nálezů
| # | Surface | Lint/typ | Severity | Stav |
|---|---------|----------|----------|------|
| 1 | … | 00NN … | Critical | open |

## Detail nálezů
### [SEVERITY] <název nálezu>
- **Surface:** …
- **Důkaz:** <odkaz na evidence soubor / SQL výstup>
- **Doporučení (06/2026):** <ověřené řešení + zdroj>
- **Remediation blok:** B<n>

## Plán remediace (bloky)
- B1 Bezpečnost · B2 Integrita · B3 RLS sjednocení · B4 Výkon/indexy
- B5 Auth/Storage/API config · B6 Edge funkce

## Mimo scope / vědomě ponecháno
…
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/audits/2026-06-03-supabase-audit.md
git commit -m "audit(report): full Supabase audit report with severities"
```

> ### 🚦 GATE 1 — Schválení reportu
> **STOP.** Předlož report uživateli. Žádná oprava (Fáze 3) nezačne, dokud uživatel report neschválí. Uživatel může nález přeřadit/zamítnout.

---

## FÁZE 3 — Remediation (procesní šablona, per blok, až po GATE 1)

> Přesné opravné SQL/kód vzniká z konkrétních nálezů (proto nelze předem). Každý blok B1–B6 jede **stejnou smyčkou** níže. Bloky se dělají v pořadí B1→B6. Číslování migrací navazuje na `046` (tj. `047_…`, `048_…`).

### Šablona bloku (opakuj per blok B1–B6)

**Files (per blok):**
- Create: `supabase/migrations/0NN_<blok>_<popis>.sql` (DB bloky)
- Modify: `supabase/functions/<name>/index.ts` nebo `supabase/config.toml` (blok B6 / config)

- [ ] **Step 1: Napsat opravnou migraci / změnu z nálezů bloku**

Příklady patternů dle typu nálezu (instancuj konkrétními tabulkami/policy z reportu):

```sql
-- RLS: zapnout RLS na tabulce bez něj (lint 0013)
alter table public.<table> enable row level security;

-- RLS perf: obalit auth.uid() do select (lint 0003)
alter policy "<policy>" on public.<table>
  using ( (select auth.uid()) = user_id );

-- Funkce: pinnout search_path (lint 0011)
alter function public.<fn>() set search_path = '';

-- Extension mimo public (lint 0014)
alter extension <ext> set schema extensions;

-- Odebrat execute anon z security-definer fce (lint 0028)
revoke execute on function public.<fn>() from anon;

-- Chybějící index na FK (lint 0001)
create index if not exists idx_<table>_<col> on public.<table>(<col>);
```

- [ ] **Step 2: Aplikovat lokálně proti shadow DB a ověřit, že migrace projde**

Run: `supabase db reset --local`
Expected: všechny migrace včetně nové projdou bez chyby.

- [ ] **Step 3: Ověřit, že nález je opraven (introspekce)**

Spusť relevantní introspekční dotaz z Task 1.2 lokálně; potvrď, že nález zmizel (např. RLS enabled, search_path pinned).

- [ ] **Step 4: Review gate per blok**

Použij `superpowers:requesting-code-review` (nebo `code-review` skill) na diff migrace. U B6 (edge funkce) navíc `security-review` skill + `pr-review-toolkit` `silent-failure-hunter`. **Žádné aplikování na remote před schválením.**

- [ ] **Step 5: Aplikovat na remote (po schválení)**

Použij MCP `apply_migration` s názvem a SQL migrace (NE `db push --linked` destruktivně). Pro edge funkce: `supabase functions deploy <name>`.

- [ ] **Step 6: Re-run advisors a potvrdit, že nález zmizel**

MCP `get_advisors` (security/performance dle bloku); potvrď, že odpovídající lint už nehlásí.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0NN_*.sql   # nebo functions/config
git commit -m "fix(db): <blok> — <stručný popis remediace>"
```

**Bloky a jejich obsah (instancuj z reportu):**
- **B1 Bezpečnost** — RLS díry, exposed sensitive columns, sec-definer execute granty, exposed extensions, anonymous sign-ins
- **B2 Integrita** — chybějící PK, FK kaskády, NOT NULL/check constraints, sirotci
- **B3 RLS sjednocení** — konzistentní pojmenování policies (dle `RLS_UNIFICATION_PROPOSAL`), odstranění duplicit (lint 0006/0024)
- **B4 Výkon/indexy** — initplan wrap (0003), chybějící/duplicitní/nevyužité indexy
- **B5 Auth/Storage/API config** — `config.toml` auth (MFA, leaked-password, JWT), storage bucket listing, API exposed schémata/max_rows
- **B6 Edge funkce** — verify_jwt + signature verifikace, validace vstupů, CORS, error handling, idempotence

---

## FÁZE 4 — Regenerace TypeScript typů

### Task 4.1: Vygenerovat a rozšířit typy do obou repů

**Files:**
- Modify: typy v `cesty-bez-mapy` a `cesty-bez-mapy-admin` (cesty dle stávajícího umístění generovaných typů)

- [ ] **Step 1: Vygenerovat typy z aktuálního schématu**

Použij MCP `generate_typescript_types` (`project_id="dkblgznhnixubyoghrqe"`). Případně CLI: `supabase gen types typescript --linked`.

- [ ] **Step 2: Rozšířit do obou repů a ověřit type-check**

Run (admin): `cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy-admin && npm run type-check`
Expected: PASS. Totéž v frontend repu, pokud generované typy používá.

- [ ] **Step 3: Commit (v obou repech, kde se typy mění)**

```bash
git commit -am "chore(types): regenerace TS typů po remediaci schématu"
```

---

## FÁZE 5 — Konsolidace 46 → 1 baseline

> **GATE před začátkem:** uživatel potvrdí variantu A a (po Step 1) zvolenou cestu 1 vs 2. Žádný `db reset` na remote.

### Task 5.1: Pre-flight drift check

- [ ] **Step 1: Porovnat LOCAL vs REMOTE historii**

Run: `supabase migration list --linked`
Expected: LOCAL a REMOTE sloupce sedí → **cesta 1 (squash)**. Pokud drift → **cesta 2 (dump fallback)**.

### Task 5.2 — Cesta 1: `migration squash` (když není drift)

- [ ] **Step 1: Squash historie do jedné baseline**

Run: `supabase migration squash --linked --password "$SUPABASE_DB_PASSWORD"`
Expected: vznikne jeden baseline soubor odpovídající schema-only dumpu; remote historie srovnána.

- [ ] **Step 2: Pokračovat na Task 5.3 (verifikace)**

### Task 5.2 — Cesta 2: `db dump` baseline fallback (když je drift)

- [ ] **Step 1: Dump schématu do baseline migrace**

Run: `supabase db dump --linked -f supabase/migrations/00000000000001_baseline.sql`
Expected: jeden soubor s plným schématem (RLS, granty, funkce, triggery, extensions, storage policies).

- [ ] **Step 2: Srovnat remote historii migrací**

Pro každou ze 46 starých verzí: `supabase migration repair --status reverted <version>`, poté baseline: `supabase migration repair --status applied 00000000000001`.
Expected: `supabase migration list --linked` ukazuje jen baseline jako applied na obou stranách.

### Task 5.3: Archivace, kuratela a verifikace nulového driftu

- [ ] **Step 1: Přesunout 46 původních migrací do archivu**

```bash
mkdir -p supabase/migrations/_archive
git mv supabase/migrations/0[0-4][0-9]_*.sql supabase/migrations/_archive/ 2>/dev/null || true
git mv supabase/migrations/003_*.md supabase/migrations/_archive/ 2>/dev/null || true
```
*(Pozn.: u cesty 1 squash sám staré soubory odstraní — archivuj jen to, co zůstalo.)*

- [ ] **Step 2: Lehká kuratela baseline**

Přidat hlavičku s komentářem (datum, původ = konsolidace 46 migrací), doménové oddělovače (`-- ===== PRODUCTS =====` atd.). Žádné funkční změny SQL.

- [ ] **Step 3: Verifikace — čistý lokální reset musí projít**

Run: `supabase db reset --local`
Expected: baseline projde bez chyby, lokální schéma postavené.

- [ ] **Step 4: Verifikace — nulový drift proti remote**

Run: `supabase db diff --linked`
Expected: **prázdný výstup** (žádný drift). Pokud něco hlásí → baseline je neúplná, NEzafixovat, vrátit se a doplnit (řeš přes `superpowers:systematic-debugging`).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations
git commit -m "refactor(db): konsolidace 46 migrací do jedné baseline (verifikováno nulovým driftem)"
```

---

## FÁZE 6 — Reconciliace dokumentace

### Task 6.1: Aktualizovat / archivovat staré DB docs

**Files:**
- Modify: `supabase/MIGRATIONS.md`
- Modify: `CLAUDE.md` (oba repy — reference na migrace)
- Move: `supabase/RLS_AUDIT_PROMPT.md`, `supabase/RLS_UNIFICATION_PROPOSAL.md`, `supabase/rls-policies-audit-v2.md` → `supabase/_archive/`

- [ ] **Step 1: Přepsat MIGRATIONS.md na aktuální stav**

Aktualizovat na stav po konsolidaci (1 baseline, aktuální tabulky/policies/funkce), nahradit zastaralé statistiky (28 migrací → baseline).

- [ ] **Step 2: Archivovat splněné RLS návrhy**

```bash
mkdir -p supabase/_archive
git mv supabase/RLS_AUDIT_PROMPT.md supabase/RLS_UNIFICATION_PROPOSAL.md supabase/rls-policies-audit-v2.md supabase/_archive/
```

- [ ] **Step 3: Aktualizovat reference v CLAUDE.md (oba repy)**

Pokud CLAUDE.md odkazuje na konkrétní čísla migrací (např. „migrace 035", „migration 046"), aktualizovat na baseline.

- [ ] **Step 4: Commit**

```bash
git add supabase/MIGRATIONS.md supabase/_archive CLAUDE.md
git commit -m "docs(db): reconciliace dokumentace po auditu a konsolidaci"
```

---

## Self-Review (vyplněno při psaní plánu)

**Spec coverage:** Surfaces 1–10 → discovery Task 1.2 (1–9 DB) + 1.3 (10 edge) + 1.4 (6/8/9 config); remediace bloky B1–B6 pokrývají všechny surfaces; konsolidace §8 → Fáze 5; doc reconciliace §7 krok 7 → Fáze 6; advisor katalog §5 → Task 1.1. ✓

**Placeholder scan:** Opravné SQL ve Fázi 3 je záměrně šablonové (nálezy nejsou předem známé) — poskytnuty konkrétní vzorové patterny per lint + přesné verifikační příkazy. Discovery, konsolidace i docs jsou plně konkrétní. ✓

**Type/příkaz konzistence:** `migration squash --linked`, `migration repair --status`, `db dump --linked -f`, `db diff --linked`, MCP `apply_migration`/`get_advisors`/`generate_typescript_types` — názvy ověřeny proti CLI/MCP referenci (§12 specu). ✓

**Bezpečnost dat:** Žádný `db reset` na remote (jen `--local`); remote změny jen přes `apply_migration`; konsolidace mění jen historii. ✓
