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
- `SECURITY DEFINER` ⇒ povinně `set search_path = ''` (+ explicitní `public.` reference). Default `security invoker`.

## Typy a komentáře
- `text` (ne `varchar`), `jsonb` (ne `json`), `timestamptz` (ne `timestamp`).
- Enumy: `text + CHECK`, povolené hodnoty v komentáři sloupce. Žádné native `enum` typy.
- Komentáře **anglicky**; každá tabulka + netriviální sloupec má `COMMENT`.
