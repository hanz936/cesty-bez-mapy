# Cesty bez mapy — Dokumentace migrací

> **Verze:** 2.0 · **Aktualizováno:** 2026-06-04
> **Stav:** Konsolidováno do jediné baseline migrace.

---

## 1. Přehled

Schéma databáze je od **2026-06-04** vedeno jako **jediná baseline migrace**:

```
supabase/migrations/00000000000000_baseline.sql
```

Tato baseline vznikla **konsolidací 49 původních migrací** (`001`–`049`) v rámci pre-launch
auditu Supabase vrstvy. Vygenerována z živého schématu (`supabase db dump --linked --keep-comments`)
a doplněna o části, které `db dump` na Supabase localu nereprodukuje:

| Sekce baseline | Proč doplněno ručně |
|---|---|
| Hlavní dump (public + extensions + vault) | tabulky, 14 funkcí, public triggery, policies, granty, comments |
| **STORAGE object RLS policies** (16) | `storage` je managed schéma — `db dump` ho vynechává |
| **FUNCTION EXECUTE grants** (explicitní REVOKE) | Supabase local default-privileges by jinak daly anon/auth execute |
| **AUTH triggers** na `auth.users` (2) | `auth` je managed schéma — `db dump` ho vynechává |

**Ověření kompletnosti:** `supabase db reset --local` projde + introspekční hash schématu
(tabulky/RLS, policies public+storage, funkce+search_path+secdef, execute granty, extensions,
public+auth triggery) je **identický s remote** (mimo base-image `pg_graphql`).
`supabase migration list --linked` ukazuje na obou stranách jen baseline.

## 2. Původní migrace (archiv)

Všech 49 původních migrací (`001`–`049`, vč. `003_…DOCUMENTATION_ONLY.md`) je zachováno v:

```
supabase/_archive/migrations-pre-baseline/
```

Slouží jen jako historický referenční materiál — **nejsou** součástí migračního řetězce
(CLI je nečte, leží mimo `supabase/migrations/`). Remote historie migrací byla srovnána
přes `supabase migration repair` (24 timestamp verzí → reverted, baseline → applied).

## 3. Bezpečnostní audit (2026-06-03/04)

Konsolidaci předcházel kompletní audit Supabase vrstvy. Report + evidence:

```
docs/superpowers/audits/2026-06-03-supabase-audit.md
docs/superpowers/audits/2026-06-03-evidence/
```

Klíčové opravy zahrnuté v baseline (migrace 047–049 před konsolidací):
- **CRITICAL:** odstraněna `USING(true)` expozice `download_tokens` (bearer tokeny k placeným PDF).
- `revoke execute` na SECURITY DEFINER funkcích od anon/authenticated (linty 0028/0029).
- `blog_tags` multiple-permissive (0006), redundantní index (0009), `search_path=''` sjednocení.
- `pg_net` přesunut z `public` do `extensions` (lint 0014).
- Edge: `resend-webhook` `verify_jwt=false`, `get-order-by-session` fix.

Vědomě ponecháno: `fakturoid_tokens` RLS-bez-policy (deny-all), `0012` anon-access policies
(admin policies gated `is_admin()` vylučující anon), pre-launch unused indexes.
Odloženo na Pro plán: leaked-password protection (HIBP).

## 4. Konvence pro nové migrace

- Nové migrace přidávej do `supabase/migrations/` s **14-místným timestamp** prefixem:
  `supabase migration new <nazev>` → `YYYYMMDDHHMMSS_<nazev>.sql`. Seřadí se **za** baseline.
- Lokální ověření: `supabase db reset --local` (postaví schéma z baseline + nových migrací).
- Aplikace na remote: přes `apply_migration` (MCP) nebo `supabase db push`.
- RLS: admin policies přes `(select is_admin())` (JWT-claim, fail-closed); user-scoped přes
  `(select auth.uid())` (initplan-wrapped kvůli výkonu).
- SECURITY DEFINER funkce: vždy `set search_path = ''` + plně kvalifikované názvy; `revoke execute`
  od anon/authenticated, pokud nemají být volány přes PostgREST RPC.
- Po DDL změnách spusť `get_advisors` (security + performance) a vyřeš nové linty.

## 5. Storage buckety

Buckety jsou **dashboard-managed** (historicky `003_…DOCUMENTATION_ONLY.md` byl jen dokumentace,
ne migrace). Aktuální stav:

| Bucket | Public | Limit | MIME |
|---|---|---|---|
| `products-images` | ano | 10 MB | image/jpeg,png,webp |
| `blog-images` | ano | 10 MB | image/jpeg,png,webp |
| `products-pdfs` | ne | 50 MB | application/pdf |
| `custom-itinerary-pdfs` | ne | 200 MB | application/pdf |

Object-level RLS policies (admin-only per bucket) jsou součástí baseline.
