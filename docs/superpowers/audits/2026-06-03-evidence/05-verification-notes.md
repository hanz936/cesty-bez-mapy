# Ověření nálezů proti dokumentaci 06/2026 (Task 2.1)

> Zdroje: Context7 `/supabase/supabase` (06/2026) + Firecrawl scrapy v `.firecrawl/` + advisor remediation URLs.

## pg_net v public (lint 0014) — VERIFIKOVÁNO, překlasifikace
- Supabase docs (extensions overview): „Most extensions are installed under the `extensions` schema."
- pg_net **není jednoduše relocatable** přes `ALTER EXTENSION ... SET SCHEMA` (jako PostGIS). Doporučená cesta dle docs/troubleshooting: `drop extension pg_net; create extension pg_net schema extensions;` (drop + recreate).
- **Riziko:** pg_net používá trigger `notify_vercel_blog_publish` (`net.http_post`). Drop/recreate je invazivní; navíc pg_net je do jisté míry Supabase-managed.
- **Závěr:** 0014 = **LOW / handle-with-care**. Buď (a) opatrně drop+recreate v `extensions` + re-test blog deploy trigger, nebo (b) vědomě ponechat (WARN, ne exploit). → rozhodnutí uživatele na GATE 1.

## Password security (potvrzeno doporučení 06/2026)
- „Set a large minimum password length. **Anything less than 8 characters is not recommended.**" → current `minimum_password_length=6` je pod doporučením → zvednout na **≥ 8**.
- Required characters: nejsilnější = digits+lower+upper+symbols (`password_required_characters`).
- „Prevent the use of leaked passwords" → zapnout **HaveIBeenPwned** (`password_hibp_enabled`).
- **Mechanismus:** live auth config přes dashboard nebo `PATCH /v1/projects/{ref}/config/auth` (`password_min_length`, `password_required_characters`, `password_hibp_enabled`). **NE migrace, NE plně config.toml** pro remote. → blok B5 = config/dashboard, ne SQL.

## RLS + anonymous sign-ins (0012) — potvrzeno
- 15 anon uživatelů (live) → anon sign-ins zapnuté, role `authenticated` zahrnuje anonymní → `USING(true)` policy na `authenticated` je vystavená anonu.
- Fix download_tokens: **dropnout obě broad SELECT policy** (`download_tokens_public_select`, `download_tokens_authenticated_select`). Legitimní flow (get-download-url) jede přes **service role** → odstranění nic nerozbije. (Cross-check Task 1.3 potvrzen.)

## Standardní remediace (vysoká jistota, advisor URLs)
- **0028/0029** secdef execute: `revoke execute on function ... from anon, authenticated;` — service_role si execute drží (callers jedou service role → bezpečné). Cross-check Task 1.3 potvrzen.
- **0006** multiple permissive (blog_tags): sjednotit do jedné policy nebo přidat `is_admin` OR do public_read (perf). 
- **0003** initplan: NEAPLIKUJE SE — policies už `(select auth.uid())`/`(select is_admin())` (ověřeno introspekcí, advisor 0003 nehlásil).
- **0008** fakturoid_tokens RLS-no-policy: deny-all = bezpečný stav pro service-only secrets tabulku (INFO, ponechat; volitelně doplnit komentář).
- **resend-webhook verify_jwt=false:** standardní pattern pro webhooky (signatura ověřená v kódu). Advisor/CLI docs potvrzují default verify_jwt=true → pro externí webhook nutné false.
- **Redundantní index** `idx_orders_stripe_payment_id` (duplikát `orders_stripe_payment_id_key` UNIQUE): drop plain index (0009 logika).

## Wide table grants anon/authenticated — ponecháno
- `GRANT ALL` na anon/authenticated je **Supabase default**; model staví bezpečnost na RLS. Revoke (TRUNCATE/REFERENCES/TRIGGER) = volitelná hygiena, ale má PostgREST implikace → **mimo scope / Low** (neriskovat rozbití API). Skutečný fix = RLS (download_tokens).
