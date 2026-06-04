# Re-verifikace 1:1 baseline ↔ remote (2026-06-04)

> Cíl: nezávisle potvrdit, že konsolidovaná `supabase/migrations/00000000000000_baseline.sql`
> reprodukuje **přesně** schéma živé produkční DB (`dkblgznhnixubyoghrqe`).
> Lokál nejdřív kompletně přestavěn **jen z baseline** (`supabase db reset --local`, aplikováno bez chyby),
> takže se porovnává remote vs. schéma, které baseline reálně vytváří.
> Tři nezávislé metody (A: DDL dump diff, B: migra shadow, C: katalogový podpis).

## Závěr

**Baseline je 1:1 s remote pro 100 % migracemi řízeného schématu.** Jediné rozdíly jsou
verzové posuny **managed komponent** v lokálním dev image (Supabase CLI), které baseline
nevytváří ani vytvářet nemá → **žádná akce.**

| Rozdíl | Kde | Příčina | Akce |
|---|---|---|---|
| `pg_graphql` extension | jen lokál | bundled v local base-image; `db dump --linked` ho z remote nevypisuje (managed) | žádná |
| `storage.iceberg_namespaces`, `storage.iceberg_tables` | jen lokál | lokální `storage-api` image novější než nasazená verze na remote; objeví se na remote po upgradu Supabase | žádná |

## Metoda A — diff plného DDL dumpu (public/extensions/vault)

`supabase db dump --linked` vs `--local` (oba `--keep-comments`), po odfiltrování
nevykonatelného šumu (komentáře `^--`, pg_dump `\restrict` nonce, prázdné řádky):

```
Jediný rozdíl ve vykonatelném DDL:
> CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";   (jen lokál)
```

Vše ostatní bajt-identické: tabulky, sloupce, constrainty, indexy, těla funkcí
(`search_path`, SECDEF), `COMMENT ON`, policies, `REVOKE/GRANT EXECUTE`, triggery.

## Metoda C — katalogový podpis (count + MD5, identický SQL na obou stranách)

SQL: `.audit-tmp/verify/sig.sql` (lokál přes `docker exec … psql`, remote přes MCP `execute_sql`).
MD5 počítá Postgres sám (DB-normalizováno) → imunní vůči rozdílu formátu JSON vs. psql.

| Kategorie | Lokál | Remote | Shoda |
|---|---|---|---|
| A_fn_execute_priv (anon/auth/svc na public fcích) | 14 / `625edc29` | 14 / `625edc29` | ✅ |
| B_policies (public + storage) | 67 / `6cff8aee` | 67 / `6cff8aee` | ✅ |
| C_triggers (public + auth + storage) | 18 / `fecaa13a` | 18 / `fecaa13a` | ✅ |
| D_rls_enabled (public + storage tabulky) | 27 / `2d6e31e9` | 25 / `6a3d51ee` | ⚠️ managed |
| E_functions_def (secdef/cfg/lang/volatility) | 14 / `0331fa71` | 14 / `0331fa71` | ✅ |
| F_indexes | 76 / `481a0b35` | 76 / `481a0b35` | ✅ |
| G_constraints | 63 / `56a47c27` | 63 / `56a47c27` | ✅ |
| H_columns | 190 / `9e180345` | 190 / `9e180345` | ✅ |
| I_extensions | 8 / `9b9af0bf` | 7 / `23b015e4` | ⚠️ managed |

**7 z 9 kategorií bajt-identických** (počet i hash). Obě odchylky vysvětleny v tabulce „Závěr".

Důkaz, že `D_rls_enabled` odchylka NENÍ vada konsolidace:
- baseline obsahuje **nula** `CREATE TABLE storage.*` (`grep` čistý); jediné storage DDL = **16× `CREATE POLICY ON storage.objects`** (sedí přesně, lokál i remote 16),
- všechny storage tabulky vlastní managed role `supabase_storage_admin`,
- **public schéma: 17 tabulek identických** na obou stranách, všechny RLS-enabled.
- Storage: remote 8 managed tabulek, lokál týchž 8 **+** 2 Iceberg (catalog feature novějšího image).

## Metoda B — `supabase db diff --linked --schema public,storage,extensions`

migra (shadow DB z baseline vs. remote) vrací **jen 4 známé policy false-positives**:
`blog_tags_public_read`, `categories_public_select`, `newsletter_consent_public_insert`,
`products_public_select`. Každý `drop policy` je hned následován `create policy`
s **identickou** definicí (migra je neumí spárovat jako „unchanged").

Přímý dump těch 4 policy z obou stran → **bajt-identické**:

```
blog_tags_public_read            | SELECT | {anon,authenticated} | USING=true
categories_public_select         | SELECT | {anon,authenticated} | USING=true
newsletter_consent_public_insert | INSERT | {anon,authenticated} | CHECK=(email,consent_given,source NOT NULL)
products_public_select           | SELECT | {anon,authenticated} | USING=(is_deleted = false)
```

Navíc Metoda C kategorie B (`6cff8aee`) už dokázala shodu hashem přes všech 67 policy →
migra drop/recreate je čistě kosmetický, ne reálný rozdíl.

## Migrační historie

```
supabase migration list --linked
 Local          | Remote         | Time (UTC)
----------------|----------------|----------------
 00000000000000 | 00000000000000 | 00000000000000
```

Jen baseline na obou stranách, žádný drift. Pracovní strom čistý
(dotčen jen gitignored `.audit-tmp/`), baseline v gitu nezměněn.
