# Database Conventions — Cesty bez mapy

Závazný standard pojmenování pro Postgres schéma (`public`). Vynucováno pgTAP testem
`supabase/tests/database/00_naming_conventions.test.sql`.

## Identifikátory
- `snake_case`, anglicky, lowercase.
- Tabulky: **množné číslo** (konzistence > volba; viz spec §3).
- Sloupce: časové končí `_at`; vznik řádku = `created_at`, poslední změna = `updated_at`.
- Booleany: `is_`/`has_` pro stavové flagy; „dokončená akce" v minulém čase povolena bez prefixu
  (`invoice_sent`, `ecomail_synced`, `consent_given`).

## Klíče a constrainty
- PK: `id uuid default gen_random_uuid()`, constraint `<tab>_pkey`.
  Výjimky: `email_suppressions` (natural key `email`), `fakturoid_tokens` (singleton `id boolean`).
- FK: `<tab>_<col>_fkey`. UNIQUE: `<tab>_<col(s)>_key`. CHECK: `<tab>_<col|descriptor>_check`.

## Indexy
- `idx_<plný_název_tabulky>_<col(s)>[_<kvalifikátor>]`. Bez zkratek. Parciální unikát: `idx_<tab>_<col>_unique`.

## RLS policy
- `<tab>_<audience>_<action>`.
- audience ∈ `public` · `authenticated` · `owner` · `admin` · `auth_admin`.
- action ∈ `select` · `insert` · `update` · `delete`.
- Výkon: volání auth obalit jako `( select is_admin() )` / `( select auth.uid() )` (initplan).

## Triggery
- `trg_<tab>_<purpose>`. Pro updated_at: `trg_<tab>_set_updated_at` (funkce `extensions.moddatetime`).

## Funkce
- `snake_case` verb_noun; predikáty `is_*`.
- **Každá funkce** nastavuje `set search_path = ''` a všechny reference plně kvalifikuje
  (`public.…`, `extensions.…`). Povinné u `SECURITY DEFINER`; projektový standard i pro
  `SECURITY INVOKER`. Default `security invoker`.

## Typy a komentáře
- `text` (ne `varchar`), `jsonb` (ne `json`), `timestamptz` (ne `timestamp`).
- Enumy: `text + CHECK`, povolené hodnoty v komentáři sloupce. Žádné native `enum` typy.
- Komentáře **anglicky**; každá tabulka + netriviální sloupec má `COMMENT`.

## Vynucování (pgTAP guard)

`supabase/tests/database/00_naming_conventions.test.sql` (běží přes `supabase test db`,
v CI `.github/workflows/db-lint.yml`) mechanicky vynucuje:

1. žádný identifikátor ani tělo funkce neobsahuje `facturoid`;
2. indexy `idx_*` mají plný název tabulky jako prefix;
3. RLS policy (schémata `public` + `storage`) dodržují `<table>_<audience>_<action>`;
4. constrainty mají suffix `_fkey` / `_key` / `_check`;
5. **všechny** funkce mají `search_path = ''`;
6. user triggery mají prefix `trg_`;
7. type-preference (žádné `varchar` / `char` / `json` / `timestamp`-bez-tz);
8. každá public tabulka má `COMMENT`.

Mimo strojové vynucování (drží se dokumentací): plural tabulek (lingvistické),
anglické komentáře a obsah komentářů u CHECK/enum sloupců.

## Generované TS typy pro edge funkce
`supabase/functions/_shared/database.types.ts` je generovaný (`npm run gen:types`).
Regenerovat při KAŽDÉ změně schématu (migrace). Edge funkce typují klienta přes
`createClient<Database>(...)`; selecty se narrowují automaticky.
