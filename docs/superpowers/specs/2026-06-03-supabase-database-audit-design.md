# Audit Supabase databáze + konsolidace migrací — Design

> **Datum:** 2026-06-03
> **Projekt:** cesty-bez-mapy (Supabase ref `dkblgznhnixubyoghrqe`, Postgres 17)
> **Stav:** Design schválen, čeká na zápis implementačního plánu
> **Repo práce:** `cesty-bez-mapy` (frontend) — zde žijí migrace i edge funkce

---

## 1. Cíl

Důkazně podložený audit celé Supabase vrstvy (DB + Auth + Storage + API + edge funkce),
oprava všech nálezů a konsolidace 46 migrací do jedné správné baseline — vše proti best
practices a dokumentaci platné k **06/2026**, ověřeno přes Context7 a Firecrawl (žádné
spoléhání na trénovací data).

## 2. Kontext a výchozí stav

- **46 migrací** (~7 050 řádků SQL) v `supabase/migrations/`
- 11 tabulek, 3 storage buckety, ~50 RLS policies, triggery, funkce, indexy
- **14 edge funkcí** (`supabase/functions/`)
- Existující **zastaralé** audit dokumenty (leden/květen): `MIGRATIONS.md` (psané pro 28
  migrací), `RLS_AUDIT_PROMPT.md`, `RLS_UNIFICATION_PROPOSAL.md` (jen návrh, neaplikovaný),
  `rls-policies-audit-v2.md` — budou součástí auditu jako vstup a nakonec reconciliovány
- CLI linknuté (v2.104.0), dostupné Supabase MCP + `supabase` skill

## 3. Klíčová rozhodnutí (z brainstormingu)

| Téma | Rozhodnutí |
|------|-----------|
| **Rozsah** | Úplně vše vč. hloubkového bezpečnostního code-review všech 14 edge funkcí |
| **Stav DB** | Pre-launch, bez reálných zákazníků, ale **data zachovat** — žádný destruktivní reset remote |
| **Nálezy** | Plný report → schválení → opravit vše (bezpečnost i konzistence) jako migrace s review per blok → pak konsolidace |
| **Strategie konsolidace** | Ověřeno proti dokům 06/2026 (viz §12) → **varianta A: `supabase migration squash --linked`** (primárně), s `db dump` baseline + `migration repair` jako fallback. Declarative (B) zamítnuta. Rozhodovací gate na potvrzení zůstává. |
| **Umístění** | Spec + audit report ve frontend repu `cesty-bez-mapy/docs/superpowers/` |

## 4. Rozsah auditu — surfaces

1. **Schéma & integrita** — tabulky, sloupce, datové typy, constraints (PK/FK/unique/check),
   defaulty, NOT NULL, cizí klíče a kaskády, sirotčí data
2. **RLS** — zapnuté na všech tabulkách, kompletní policies per operace, konzistentní
   pojmenování (navazuje na nedokončený `RLS_UNIFICATION_PROPOSAL`), žádné `USING (true)`
   díry, korektní anon vs authenticated
3. **Funkce & triggery** — `SECURITY DEFINER` vs `INVOKER`, `search_path` pinning,
   grant/revoke execute, JWT custom access token hook
4. **Indexy & výkon** — chybějící indexy na FK, nevyužité indexy, RLS-perf
   (`(select auth.uid())` init-plan pattern)
5. **Extensions** — verze, umístění mimo `public`, zbytečné
6. **Auth konfigurace** — MFA enforcement, heslové politiky, JWT expiry,
   leaked-password protection, anonymous sign-ins
7. **Storage** — bucket konfigurace (public/private), policies, navázání na migraci 046
8. **API/PostgREST expozice** — exponovaná schémata, `max_rows`, co je veřejně čitelné
   přes anon klíč
9. **Síť & secrets** — network restrictions, Vault, žádné hardcoded secrets
10. **Edge funkce (14)** — autorizace (JWT/service-role), validace vstupů, CORS, leaky
    secretů, error handling, idempotence (Stripe/Resend/Fakturoid webhooky). **Cross-check
    `verify_jwt`:** každá funkce s `verify_jwt = false` (webhooky — Stripe, Resend, CSP report)
    musí dělat vlastní ověření podpisu (Stripe signature, svix/Resend), jinak je veřejně
    volatelná bez autentizace.

## 5. Metodika

- **Důkazně, ne od oka.** Každé „best practice" tvrzení ověřeno proti dokumentaci 06/2026.
- **Automatizovaný baseline:** Supabase MCP `get_advisors` (security + performance lints).
- **Skutečný stav remote:** MCP `execute_sql` read-only introspekční dotazy (rozšíření
  dotazů z `RLS_AUDIT_PROMPT.md`).
- **Ověření aktuálnosti:** Context7 (`resolve-library-id` → `query-docs`) pro Supabase &
  Postgres docs; Firecrawl (`firecrawl-search`/`firecrawl-scrape`) pro changelogy, release
  notes a blog, které Context7 nepokrývá.
- **Výstup:** audit report se severitami **Critical / High / Medium / Low** + konkrétní
  remediation per nález.

**Páteř automatizovaného sweepu — Supabase advisor linty (katalog 06/2026, `supabase/splinter`):**
`get_advisors` projede 0001–0029. Mapování na surfaces (ne vyčerpávající):

| Lint | Surface |
|------|---------|
| 0001 unindexed FKs, 0005 unused index, 0009 duplicate index, 0020 table bloat | 4 výkon |
| 0004 no primary key, 0018 unsupported reg types, 0021 fkey to auth unique | 1 integrita |
| 0003 auth rls initplan, 0006 multiple permissive policies, 0007 policy exists rls disabled, 0008 rls enabled no policy, 0013 rls disabled in public, 0015 rls references user metadata, 0024 permissive rls policy | 2 RLS |
| 0010 security definer view, 0011 function search path mutable, 0028/0029 anon/authenticated sec-definer fn executable | 3 funkce |
| 0014 extension in public, 0022 extension versions outdated | 5 extensions |
| 0012 auth allow anonymous sign ins | 6 auth |
| 0025 public bucket allows listing | 7 storage |
| 0002 auth users exposed, 0016 materialized view in api, 0017 foreign table in api, 0019 insecure queue exposed in api, 0023 sensitive columns exposed, 0026/0027 pg_graphql anon/authenticated table exposed | 8 API expozice |

Advisory pokrývá automatizovatelnou část; surfaces 9 (síť/secrets) a 10 (edge funkce) se
auditují ručně + přes code-review/security-review.

## 6. Nástroje, skills a pluginy

**Jádro Supabase**
- `supabase:supabase` skill — autoritativní postupy (migrace, RLS, auth, CLI flow)
- `supabase:supabase-postgres-best-practices` skill — Postgres výkon/schéma/indexy
- Supabase MCP — `get_advisors`, `list_tables`, `list_migrations`, `list_extensions`,
  `execute_sql` (read-only), `get_logs`, `list_edge_functions`/`get_edge_function`,
  `apply_migration` (fáze oprav), `generate_typescript_types`
- Supabase CLI — `db dump`, `db diff`, `db reset` (jen lokálně), `migration list/repair`

**Ověřování aktuálnosti (06/2026)**
- Context7 MCP — Supabase & Postgres dokumentace
- Firecrawl skills — changelogy / release notes / blog

**Exekuce oprav (subagent-driven — standing preference)**
- `superpowers:writing-plans` → implementační plán (terminální krok brainstormingu)
- `superpowers:subagent-driven-development` — implementer + 2 review agenti per task
- `superpowers:requesting-code-review` / `receiving-code-review` — review gate per blok
- `superpowers:verification-before-completion` — důkaz (reset+diff, advisors clean)
- `superpowers:systematic-debugging` — když repair/diff neproběhne čistě
- `karpathy-guidelines` skill — chirurgické změny, surfacing předpokladů, ověřitelná kritéria

**Review SQL migrací a edge-func kódu**
- `code-review` skill na diff migrací a edge funkcí
- `pr-review-toolkit` agenti — zejm. `silent-failure-hunter` (error handling webhooků),
  `type-design-analyzer` (po regeneraci typů)
- `security-review` skill — cílený bezpečnostní průchod diffu edge funkcí (surface 10)

**Doménově specifické (jen kde se to dotýká edge funkcí)**
- `stripe-best-practices` — Stripe webhook/idempotence (`stripe-webhook`,
  `create-checkout-session`, `create-stripe-product`)
- `resend` / `resend-cli` — Resend webhook verifikace + suppression
- `sentry-cli` — korelace DB/edge chyb z produkce

**Záměrně mimo:** frontend-design, email template skills, cloudflare/vercel deploy.

## 7. Sekvence (pořadí je záměrné)

1. **Discovery sweep** — `get_advisors` + introspekční SQL → syrový stav remote. Bez změn.
2. **Verifikace best practices** — pro každou kategorii nálezů ověřit doporučení 06/2026
   (Context7 + Firecrawl). *(Strategie konsolidace už ověřena → §8/§12; potvrzení varianty
   řeší rozhodovací gate před krokem 6.)*
3. **Audit report** — `docs/superpowers/audits/2026-06-03-supabase-audit.md` se severitami a
   konkrétní remediací. **Review gate: schválení, než se cokoliv mění.**
4. **Remediation po blocích** — opravy seskupené do logických migrací v pořadí:
   bezpečnost → integrita → RLS sjednocení → výkon/indexy → auth/storage/api config → edge
   funkce. Každý blok: subagent-driven (implementer + 2 review), `apply_migration` na remote,
   ověření přes advisors. **Review gate per blok.**
5. **Regenerace typů** — `generate_typescript_types` → aktualizace v repech, kde se typy
   používají.
6. **Konsolidace** — až je remote čistý a stabilní: pre-flight `migration list` (drift),
   pak `migration squash --linked` (nebo `db dump` baseline fallback) dle §8, archivace 46
   migrací, **verifikace `db reset` + `db diff` = nulový drift**.
7. **Doc reconciliation** — nahradit zastaralé `MIGRATIONS.md` / RLS docs aktuálním stavem;
   uklidit `RLS_AUDIT_PROMPT.md` / `RLS_UNIFICATION_PROPOSAL` (splněno/archiv).

## 8. Strategie konsolidace migrací (ověřeno 06/2026)

**Mechanika společná:** zachovat data (žádný remote reset), upravit jen *historii migrací*,
verifikovat nulový drift přes `db reset` (lokálně) + `db diff` (proti remote) před zafixováním.
Doloženo: `migration repair` „updates the tracking table only — it does not apply or revert
any SQL" → bezpečné pro data.

**Krok 0 — pre-flight drift check:** `supabase migration list` (LOCAL vs REMOTE). Určí cestu:
- **shoda historie** → čistá cesta přes `migration squash`
- **drift** (remote má migrace navíc / lokál chybí) → fallback baseline dump

**Zvolená varianta: A — squash do jedné baseline.** Dvě cesty stejného cíle:

1. **Primárně `supabase migration squash --linked`** *(first-class příkaz)* — vytvoří jeden
   soubor „equivalent to a schema-only dump after applying existing migrations" a srovná
   remote historii. Funguje, když lokál == remote (viz krok 0).
2. **Fallback `supabase db dump -f …_baseline.sql`** + vyčištění/repair historie remote
   (`migration repair --status reverted` pro staré, baseline jako applied) — robustní i při
   driftu (community-validated brownfield postup). Zachytí plné schéma vč. RLS, grantů,
   funkcí, triggerů, extensions, storage policies.

Po vytvoření baseline: lehká kuratela (hlavičky/domény/komentáře), archivace 46 původních.

**Zamítnuto — B (deklarativní schema):** `migra` diff podle doků 06/2026 prokazatelně
**nezachytí** `alter policy`, owner/grants u views, `security invoker` views, materialized
views, schema privileges, comments, partitions, grants (duplikují se z default privileges).
To je přesně to, na čem tento projekt stojí (RLS policies, revoke execute z migrace 032,
comments). Pro konsolidaci nespolehlivé. *(Pozn.: declarative lze později zvážit pro průběžný
vývoj, ale RLS/grants/comments by stejně musely zůstat ve versioned migracích.)*

**Zamítnuto — C (ručně psaná):** zbytečně pracné a náchylné k odchylce, když squash/dump dá
deterministicky přesný stav.

**Rozhodovací gate:** před krokem 6 potvrdíš variantu A (a po kroku 0 zvolenou cestu 1 vs 2);
teprve pak konsolidace.

## 9. Rizika a mitigace

| Riziko | Mitigace |
|--------|----------|
| Dump vynechá objekt (RLS, grant, trigger, storage policy) | Verifikační gate: čistý `db reset` lokálně **musí** dát `db diff` proti remote prázdný. Squash se nezafixuje, dokud diff není čistý. |
| Špatný `migration repair` rozhodí historii | Repair jen na *historii migrací*, nikdy na data. Předem `migration list` snapshot; postup ověřit nasucho. |
| Ztráta dat (hlavní constraint) | **Žádný `db reset` na remote.** Opravy aditivně/transformačně přes `apply_migration`. Reset jen lokálně proti shadow DB. |
| Oprava RLS omylem zavře legitimní přístup | Každá RLS změna ověřena introspekcí + advisors po aplikaci; review gate. |
| Zastaralá „best practice" z paměti | Tvrdé pravidlo: žádné doporučení bez ověření Context7/Firecrawl k 06/2026. |
| Změna autorizace edge funkce rozbije běžící flow | Code-review + security-review per funkce; nasazení po schválení, ne hromadně. |

## 10. Mimo scope (YAGNI)

- Žádné nové featury
- Žádný refactor aplikačního kódu nad rámec edge-func bezpečnosti
- Žádná migrace na declarative schema „protože je modernější" — jen pokud to ověření doků
  vyloženě doporučí

## 11. Success kritéria

- `get_advisors` (security + performance) **bez Critical/High** nálezů (zbytek vědomě
  triagovaný a zdokumentovaný)
- RLS zapnuté a kompletní na všech tabulkách, konzistentní pojmenování policies
- Funkce s pinned `search_path`, korektní `SECURITY DEFINER`/`INVOKER` a grants
- Edge funkce: ověřená autorizace, validace vstupů, idempotence webhooků, žádné leaky secretů
- **Jedna** baseline migrace; `db reset` lokálně + `db diff` proti remote = **nulový drift**;
  remote data nedotčena
- Audit report a reconciliovaná dokumentace odpovídají reálnému stavu k 06/2026

## 12. Ověření proti dokumentaci (06/2026)

Spec ověřen přes **Context7** (`/supabase/cli`, `/websites/supabase`) a **Firecrawl**
(scrape oficiálních docs + community discussion). Klíčová potvrzení:

- **`supabase migration squash`** je existující first-class příkaz (flag `--linked` pro
  remote historii); squash == schema-only dump po aplikaci migrací. → primární cesta varianty A.
- **`supabase migration repair --status applied|reverted`** mění **jen tracking tabulku**,
  neaplikuje/nereverte SQL. → bezpečné pro zachování dat.
- **Declarative schema caveats** (`migra` diff): nezachytí `alter policy`, view owner/grants,
  `security invoker` views, materialized views, schema privileges, comments, partitions, grants.
  → varianta B zamítnuta pro tento RLS/grant/comment-heavy projekt.
- **RLS perf**: `(select auth.uid())` initPlan caching potvrzeno; security-definer fce nikdy
  v exposed schématu. (advisor `0003`, `0010`, `0011`)
- **Advisor lint katalog 0001–0029** (`supabase/splinter`) = páteř discovery sweepu (viz §5).
- **Edge funkce**: `verify_jwt = false` → funkce musí dělat vlastní ověření podpisu (webhooky).
- **Brownfield konsolidace** (community-validated): při driftu historie `db dump -f baseline`
  + vyčištění/repair `supabase_migrations.schema_migrations` → fallback cesta varianty A.

**Zdroje:** supabase.com/docs — local-development/declarative-database-schemas,
database/database-advisors, deployment/database-migrations, database/postgres/row-level-security,
functions/function-configuration; CLI reference (migration squash/repair); supabase/cli
discussion #40721. Lokální kopie scrapů v `.firecrawl/` (gitignored).
