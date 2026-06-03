# Supabase Audit — cesty-bez-mapy (2026-06-03)

> Projekt `dkblgznhnixubyoghrqe` · Postgres 17 · CLI v2.104.0
> Ověřeno proti dokumentaci 06/2026 (Context7 `/supabase/supabase` + Firecrawl)
> Evidence: [`2026-06-03-evidence/`](./2026-06-03-evidence/) (advisors JSON, introspekce, edge-fn matice, config, verifikace)

## Executive summary

Databáze je **celkově ve velmi dobrém stavu** — RLS zapnuté na všech 17 tabulkách, policies používají initplan-wrapped `(select is_admin())`/`(select auth.uid())` (žádný lint 0003), všechny funkce mají pinned `search_path` (žádný 0011), všechny FK indexované (žádný 0001), všechny tabulky mají PK, FK kaskády promyšlené, storage buckety správně, edge funkce vesměs exemplární (signature verifikace, Turnstile, defense-in-depth admin checky). Admin MFA (TOTP) je živě vynucené (2/2 faktory verified).

**Ale je tu 1 kritická díra a několik HIGH/MEDIUM nálezů, které je nutné opravit před launchem:**

| # | Surface | Lint/typ | Severity | Blok | Stav |
|---|---|---|---|---|---|
| F1 | RLS | `download_tokens` `USING(true)` SELECT (anon+auth) | **🔴 CRITICAL** | B1 | open |
| F2 | Edge/config | `resend-webhook` verify_jwt=true (webhook se odmítá) | **🟠 HIGH** | B6 | open |
| F3 | Auth | Leaked-password protection vypnutá (HaveIBeenPwned) | **🟡 MEDIUM** | B5 | open |
| F4 | Functions | 0028/0029 secdef exec anon: `increment_download_count`, `increment_email_resend_count` | **🟠 HIGH** | B1 | open |
| F5 | Edge/schema | `get-order-by-session` čte neexistující `download_tokens.expires_at` | **🟡 MEDIUM** | B6 | open |
| F6 | Auth | `minimum_password_length=6` (< doporučených 8) | **🟡 MEDIUM** | B5 | open |
| F7 | RLS/perf | `blog_tags` multiple permissive policies (0006) | 🟢 LOW | B3 | open |
| F8 | Functions | 0028/0029 secdef exec: `notify_vercel_blog_publish` + 2 trigger fce | 🟢 LOW | B1 | open |
| F9 | Extensions | `pg_net` v `public` (0014) — relokace invazivní | 🟢 LOW | B5 | open |
| F10 | Perf | redundantní index `idx_orders_stripe_payment_id` (0009) | 🟢 LOW | B4 | open |
| F11 | Config | config.toml `enable_anonymous_sign_ins=false` je stale (živě ON) | 🟢 LOW | B5 | open |
| F12 | Functions | nekonzistentní `search_path` konvence (`''` vs `public`) | 🟢 LOW | B4 | open |
| F13 | Edge | `get-order-by-session` přeskočí ownership check při prázdném emailu | 🟢 LOW | B6 | open |

Pozn.: 31× `unused_index` (0005) = **pre-launch šum** (idx_scan=0, žádný provoz) → NEdropovat, jen sledovat. `fakturoid_tokens` RLS-bez-policy (0008) = **správný deny-all** stav pro service-only tabulku → ponechat.

---

## Detail nálezů

### 🔴 [CRITICAL] F1 — `download_tokens` čitelné kýmkoliv (RLS `USING(true)`)
- **Surface:** 2 (RLS) · **Blok:** B1
- **Důkaz:** [`02-introspection.md`](./2026-06-03-evidence/02-introspection.md) Step 2/11.
  - `download_tokens_public_select` → role **anon**, SELECT, `USING (true)`.
  - `download_tokens_authenticated_select` → role **authenticated**, SELECT, `USING (true)`.
  - anon i authenticated mají table-level `GRANT SELECT` (Supabase default). Tabulka v `public` → vystavená přes PostgREST.
- **Dopad:** `download_tokens.token` je **bearer capability** pro stažení placených PDF (`get-download-url` → signed URL do private bucketů `products-pdfs`/`custom-itinerary-pdfs`). Kdokoliv s **veřejným anon klíčem** může `GET /rest/v1/download_tokens?select=*` a přečíst **všechny tokeny** + vazby na objednávky/itineráře (PII). → **stažení cizího placeného obsahu + únik PII.** Riziko je reálné: anon sign-ins jsou živě zapnuté (15 anon users), tj. i `authenticated` policy je vystavená komukoliv.
  - Teď `download_tokens=0` řádků → zatím není co leaknout, ale **jakmile půjdou reálné objednávky, tokeny vzniknou** → fix PŘED launchem.
- **Doporučení (ověřeno 06/2026):** dropnout **obě** broad SELECT policies. Legitimní flow (`get-download-url`) jede přes **service_role** (obchází RLS) → odstranění nic nerozbije (cross-check [`03-edge-functions.md`](./2026-06-03-evidence/03-edge-functions.md)). Volitelně ponechat admin-only SELECT.

### 🟠 [HIGH] F2 — `resend-webhook` má verify_jwt=true (gateway webhook odmítá)
- **Surface:** 10 (edge) + 6 (config) · **Blok:** B6
- **Důkaz:** MCP `list_edge_functions` → `verify_jwt:true`; config.toml ho neuvádí. Kód ověřuje svix podpis správně.
- **Dopad:** Resend posílá svix podpis, ne Supabase JWT → gateway request odmítne (401) před funkcí → bounce/complaint → `email_suppressions` pipeline **pravděpodobně tiše nefunguje** (odesílání na mrtvé adresy, poškození reputace, neúčinná GDPR suppression).
- **Doporučení:** `[functions.resend-webhook] verify_jwt = false` v config.toml + redeploy. Ověřit logy/`email_events` (6 řádků existuje — prověřit, zda z webhooku).

### 🟡 [MEDIUM] F3 — Leaked-password protection vypnutá → **ODLOŽENO NA PRO**
- **Surface:** 6 (auth) · **Blok:** B5 · **Stav:** **deferred (plan-gated)**
- **Důkaz:** security advisor `auth_leaked_password_protection` WARN (živý projekt).
- **⚠️ Plan-gating (ověřeno 06/2026):** dokumentace Supabase — *„Leaked password protection is available on the **Pro Plan and above**."* Projekt je na **Free** → nelze zapnout teď. → **odložit na Pro** (konec vývoje, dle [[project_pre_launch_secret_swap]] timeline). Advisor bude WARN hlásit do té doby = očekávané.
- **Doporučení:** při přechodu na Pro zapnout `password_hibp_enabled=true` (Auth → Providers → Email, nebo `PATCH /v1/projects/{ref}/config/auth`).

### 🟠 [HIGH] F4 — secdef funkce manipulovatelné anonem (0028/0029)
- **Surface:** 3 (functions) · **Blok:** B1
- **Důkaz:** [`02-introspection.md`](./2026-06-03-evidence/02-introspection.md) Step 5. `increment_download_count(uuid)` a `increment_email_resend_count(text,uuid,text)` jsou SECURITY DEFINER s `anon`+`authenticated` EXECUTE, volatelné přes `/rest/v1/rpc/...`.
- **Dopad:** anon může bumpovat `download_count` libovolného tokenu (DoS download limitu) a vyčerpat `email_resend_counts` cizí objednávky (DoS resend limitu). Bez data-leaku (funkce mají whitelist, žádná injekce), ale zneužitelné.
- **Doporučení:** `revoke execute ... from anon, authenticated;` — `service_role` si execute drží; legitimní volající (get-download-url, resend-email, send-custom-itinerary-email) jedou service role → bezpečné (cross-check Task 1.3).

### 🟡 [MEDIUM] F5 — `get-order-by-session` čte neexistující sloupec `expires_at`
- **Surface:** 10 (edge) / 1 (schema konzistence) · **Blok:** B6
- **Důkaz:** `get-order-by-session/index.ts:151` `select("token, expires_at")`; `download_tokens` sloupec `expires_at` nemá (tokeny perpetual).
- **Dopad:** dotaz vždy selže → `download_token: null` v odpovědi → success page po platbě nemusí dostat token touto cestou (latentní bug).
- **Doporučení:** odstranit `expires_at` ze selectu i `download_expires_at` z response (perpetual model).

### 🟡 [MEDIUM] F6 — slabá délka hesla
- **Surface:** 6 (auth) · **Blok:** B5
- **Důkaz:** config.toml `minimum_password_length=6`. Docs 06/2026: „Anything less than 8 is not recommended."
- **Doporučení:** zvednout na **≥ 8** (`password_min_length`) + zvážit `password_required_characters` (digits+lower+upper+symbols). Ověřit živou hodnotu (dashboard). Live config, ne migrace.

### 🟢 [LOW] F7 — `blog_tags` multiple permissive policies (0006)
- **Surface:** 2 (RLS) / 4 (perf) · **Blok:** B3
- **Důkaz:** performance advisor 0006 — `blog_tags` má pro authenticated/SELECT dvě permissive policy (`blog_tags_admin_all` + `blog_tags_public_read`).
- **Severity:** `public_read` je už `USING(true)`, takže admin SELECT overlap nepřidává řádky — jen planner overhead na malé tabulce → **LOW** (verifikací sníženo z MEDIUM).
- **Doporučení:** ponechat jen `blog_tags_public_read` (USING true) pro SELECT a admin policy omezit na write operace (INSERT/UPDATE/DELETE), nebo sjednotit. Perf optimalizace.

### 🟢 LOW nálezy (souhrn)
- **F8** — `notify_vercel_blog_publish` + `update_all_products_in_order` + `update_product_total_sales` mají anon/auth EXECUTE. notify vrací `trigger` (PostgREST RPC nevystaví), ostatní jsou trigger fce → ne přímo zneužitelné. Revoke = hygiena. (B1)
- **F9** — `pg_net` v `public` (0014). **Ověřeno:** relokace NENÍ triviální `ALTER EXTENSION SET SCHEMA` (jako PostGIS); doporučená cesta `drop+create extension pg_net schema extensions`, ale pg_net používá trigger `notify_vercel_blog_publish` → **invazivní**. → **ROZHODNUTO (uživatel): přesunout OPATRNĚ** do `extensions` + re-test blog-deploy triggeru (net.http_post). Migrace v bloku B4-infrastruktura, samostatně s ověřením triggeru. (B4)
- **F10** — redundantní `idx_orders_stripe_payment_id` (duplikát UNIQUE constraint indexu `orders_stripe_payment_id_key`) → drop. (B4)
- **F11** — config.toml `enable_anonymous_sign_ins=false` je **stale** (živě 15 anon users → ON, záměrná feature). Sjednotit na `true`. (B5, doc)
- **F12** — nekonzistentní `search_path` (`''` vs `public`) napříč funkcemi → sjednotit na `''`. Kosmetika (funkčně OK, kvalifikované názvy). (B4)
- **F13** — `get-order-by-session` přeskočí ownership email check, když je `customer_details.email` prázdný → fail-closed. (B6, volitelné)

---

## Plán remediace (bloky, pořadí B1→B6)

Migrace navazují na `046` (tj. `047_…`+). Každý blok = smyčka: napsat → `db reset --local` → introspekce ověří → **review gate** → `apply_migration` na remote → re-run advisors → commit. Žádný `db reset` na remote; data se zachovají.

- **B1 — Bezpečnost DB (CRITICAL+HIGH):** drop 2 broad SELECT policies na `download_tokens` (F1); `revoke execute` na `increment_download_count`, `increment_email_resend_count` (F4) + `notify_vercel_blog_publish` a 2 trigger fce (F8) od anon/authenticated. → migrace.
- **B2 — Integrita:** **žádné DB integritní nálezy** (PK/FK/constraints/kaskády čisté). Přeskočit.
- **B3 — RLS sjednocení:** `blog_tags` 0006 konsolidace (F7); volitelně sjednotit pojmenování policies (snake_case vs „Admins can…"). → migrace.
- **B4 — Výkon/indexy + infra:** drop `idx_orders_stripe_payment_id` (F10); sjednotit `search_path` funkcí na `''` (F12); **pg_net přesun do `extensions` OPATRNĚ + re-test blog-deploy triggeru (F9)** — samostatná migrace s ověřením `net.http_post`. Unused indexy (0005) **ponechat**. → migrace.
- **B5 — Auth/config (dělá UŽIVATEL na dashboardu; část plan-gated):**
  - F3 leaked-password (HIBP) = **Pro-only → ODLOŽENO na Pro** (konec vývoje). Nelze na Free.
  - F6 min length ≥8 + required characters = **Free → uživatel zapne nyní** (dashboard).
  - F11 config.toml `enable_anonymous_sign_ins=true` reconcile = **udělá Claude** (lokální config soubor, ne live).
- **B6 — Edge funkce:** `resend-webhook` verify_jwt=false + redeploy (F2); `get-order-by-session` fix expires_at (F5) + ownership check (F13). → kód + config.toml + deploy.

---

## Poznámka k lintu 0012 (anonymous access)
0012 `auth_allow_anonymous_sign_ins` je živý WARN, protože anon sign-ins jsou zapnuté → role `authenticated` zahrnuje anonymní uživatele. **Prakticky 0012 splývá do F1**: spot-check všech ostatních `authenticated`-policies ukázal, že admin policies gate `(select is_admin())` (a `is_admin()` fail-closed vylučuje `is_anonymous`), user-scoped policies gate `auth_user_id = auth.uid()` → jediná `authenticated USING(true)` díra je `download_tokens` (= F1). Po opravě F1 je 0012 už jen očekávaný důsledek zapnutých anon sign-ins.

## Mimo scope / vědomě ponecháno
- **Wide table grants** (`GRANT ALL` anon/authenticated) = Supabase default; bezpečnost na RLS. Revoke existujících grantů má PostgREST implikace → neměnit (skutečný fix = RLS). **Volitelné forward-looking hardening:** `alter default privileges ... revoke ...` pro *budoucí* objekty (aby se nové tabulky/funkce automaticky nevystavovaly) — odlišné od retroaktivního revoke; mimo scope tohoto auditu.
- **Unused indexes (0005)** = pre-launch šum; revidovat až po reálném provozu.
- **`fakturoid_tokens` RLS-no-policy (0008)** = správný deny-all pro service-only secrets.
- **CORS seznam duplikovaný** napříč edge funkcemi = kosmetika (mohl by žít v `_shared`).

---

## Po remediaci
- **Fáze 4:** regenerace TS typů (po B1–B4 změnách schématu).
- **Fáze 5:** konsolidace 46 migrací → 1 baseline. **POZOR — drift:** local 001–046 vs remote 21 timestampů jsou disjunktní ([`00-migration-list-before.txt`](./2026-06-03-evidence/00-migration-list-before.txt)) → **Cesta 2** (`db dump --keep-comments` baseline + `migration repair`), NE `squash`. `migration repair` mění **jen tracking tabulku** (žádný apply/revert SQL → data netknuta). Lehčí kanonická alternativa: `supabase db pull` (zapíše remote-schema migraci + auto-repair historie v jednom kroku) — dump+repair je ekvivalent s větší kontrolou nad názvem baseline a `--keep-comments`. **Před repairem vzít `db dump --data-only` zálohu** (belt-and-suspenders).
- **Fáze 6:** reconciliace docs (MIGRATIONS.md, CLAUDE.md, archiv RLS návrhů).
