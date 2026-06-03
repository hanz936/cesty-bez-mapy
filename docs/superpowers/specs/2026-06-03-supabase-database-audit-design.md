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
| **Strategie konsolidace** | **Zafixovat až po ověření aktuálních Supabase doků 06/2026** (Context7/Firecrawl), pak finální doporučení + rozhodovací gate |
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
    secretů, error handling, idempotence (Stripe/Resend/Fakturoid webhooky)

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
   (Context7 + Firecrawl). **Zde se zafixuje strategie konsolidace** (viz §8) → finální
   doporučení + rozhodovací gate.
3. **Audit report** — `docs/superpowers/audits/2026-06-03-supabase-audit.md` se severitami a
   konkrétní remediací. **Review gate: schválení, než se cokoliv mění.**
4. **Remediation po blocích** — opravy seskupené do logických migrací v pořadí:
   bezpečnost → integrita → RLS sjednocení → výkon/indexy → auth/storage/api config → edge
   funkce. Každý blok: subagent-driven (implementer + 2 review), `apply_migration` na remote,
   ověření přes advisors. **Review gate per blok.**
5. **Regenerace typů** — `generate_typescript_types` → aktualizace v repech, kde se typy
   používají.
6. **Konsolidace** — až je remote čistý a stabilní: baseline dle zvolené strategie (§8),
   archivace 46 migrací, `migration repair`, **verifikace `db reset` + `db diff` = nulový
   drift**.
7. **Doc reconciliation** — nahradit zastaralé `MIGRATIONS.md` / RLS docs aktuálním stavem;
   uklidit `RLS_AUDIT_PROMPT.md` / `RLS_UNIFICATION_PROPOSAL` (splněno/archiv).

## 8. Strategie konsolidace migrací

**Mechanika společná všem variantám:** zachovat data (žádný remote reset), upravit jen
*historii migrací* přes `migration repair`, verifikovat nulový drift přes `db reset` (lokálně)
+ `db diff` (proti remote) před zafixováním.

**Varianty k rozhodnutí (zafixuje se v kroku 2 po ověření doků 06/2026):**

- **A — Baseline dump + repair** *(výchozí doporučení)*: jedna baseline migrace z remote
  `db dump` (jen schéma vč. RLS, grantů, funkcí, triggerů, extensions, storage policies),
  lehká kuratela (hlavičky/domény/komentáře), archivace 46, repair historie. Spolehlivé,
  deterministické, nulová odchylka od reality.
- **B — Deklarativní schema**: přechod na `schemas/*.sql` po doménách jako zdroj pravdy
  (`[db.migrations] schema_paths` už je v `config.toml`). Modernější, ale větší změna
  workflow — zvolit **jen pokud to ověření doků 06/2026 vyloženě doporučí**.
- **C — Ručně psaná migrace**: jedna čistá kuratovaná migrace od ruky. Nejčitelnější, ale
  pracné a náchylné k odchylce od remote.

**Rozhodovací gate:** po ověření doků předložit finální doporučení; uživatel potvrdí variantu
před provedením konsolidace.

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
