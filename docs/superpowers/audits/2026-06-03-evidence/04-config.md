# Auth / API / Network konfigurace (Task 1.4)

> ⚠️ **Důležité:** `supabase/config.toml` je **lokální dev** config. Řada hodnot (TOTP enroll, TLS, network_restrictions, email confirmations) jsou lokální defaulty a **NEreprezentují produkci**. Pro živý stav slouží advisor + přímé DB introspekce (níže), ne config.toml.

## Živá DB ground-truth (MCP execute_sql, 2026-06-03)

| Metrika | Hodnota | Význam |
|---|---|---|
| total_users | 17 | |
| **anonymous_users** | **15** | **anon sign-ins LIVE zapnuté a používané** |
| permanent_users | 2 | = 2 admini |
| mfa_factors (total/verified) | 2 / 2 | admin TOTP MFA živě vynucené ✓ |
| admin_roles | 2 | |
| Data: orders/order_items/products/customers/custom_requests | 12 / 15 / 6 / 4 / 5 | reálná pre-launch data |
| download_tokens | 0 | díra zatím bez živých tokenů → fix před launchem |

## [api] (config.toml — relevantní i pro produkci)

```
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000
```
✓ Jen `public` + `graphql_public` vystaveno přes PostgREST. `max_rows=1000` rozumný strop. Žádný nález.

## Auth nálezy

### [HIGH/MEDIUM] Leaked-password protection vypnutá (LIVE — advisor)
- **Důkaz:** security advisor `auth_leaked_password_protection` WARN (živý projekt).
- **Doporučení (06/2026):** zapnout HaveIBeenPwned kontrolu v Auth → Password settings.
- **Blok:** B5. (Pozn.: admini chrání MFA, ale zákazníci s heslem ne → zapnout.)

### [MEDIUM] Anonymous sign-ins zapnuté + download_tokens RLS to nereflektuje
- **Důkaz:** 15 anonymních uživatelů v `auth.users` → anon sign-ins LIVE ON. (config.toml `enable_anonymous_sign_ins=false` je **stale**.)
- **Posouzení:** anon sign-ins jsou **záměrná feature** (anon→permanent zákaznický flow). Samo o sobě NENÍ chyba. ALE je to **příčina exploitovatelnosti** [CRITICAL] `download_tokens` `USING(true)` policy pro roli `authenticated` (anon uživatel = role authenticated).
- **Doporučení:** (a) opravit download_tokens RLS (blok B1, CRITICAL); (b) sjednotit config.toml na `enable_anonymous_sign_ins = true` aby odrážel realitu (Low, dokumentace); (c) ověřit, že žádná další `authenticated USING(true)` policy nevystavuje citlivá data (provedeno — jen download_tokens).
- **Blok:** B1 (RLS fix) + B5 (config doc).

### [MEDIUM — ověřit LIVE] Slabá password policy
- **Důkaz:** config.toml `minimum_password_length = 6`, `password_requirements = ""`. **POZOR:** lokální hodnota; živá policy je v dashboardu a může se lišit.
- **Doporučení:** ověřit živou hodnotu; pokud 6, zvednout na ≥ 8 (06/2026 doporučení) + zvážit password_requirements. 
- **Blok:** B5 (po ověření live).

### Bez nálezu / lokální šum (NEhlásit jako produkční)
- `[auth.mfa.totp] enroll_enabled=false/verify_enabled=false` — **lokální default**; živě je MFA aktivní (2/2 verified). Ignorovat.
- `[api.tls] enabled=false` — lokální dev; produkční Supabase vždy TLS. Ignorovat.
- `[db.network_restrictions] enabled=false` — lokální; IP allowlist je dashboard feature (volitelné, není vyžadováno pro launch).
- `[auth.email] enable_confirmations=false` — lokální default; živá hodnota v dashboardu (ověřit, zda zákaznický signup vyžaduje potvrzení — ale zákazníci jdou přes Stripe/anon, ne přes email signup).
- `jwt_expiry=3600`, refresh token rotation on, reuse_interval=10 — ✓ dobré.
- `[auth.rate_limit]` — email_sent=2, sign_in_sign_ups=30, anonymous_users=30, token_refresh=150 — rozumné (lokální; živě v dashboardu).

## DB / verze
- `major_version = 17` (Postgres 17) ✓ — odpovídá živému projektu.

## Network / TLS
- Produkční Supabase: TLS enforced by default. `db.network_restrictions` lze zapnout v dashboardu (IP allowlist) — **volitelné hardening**, ne blocker. Pozn.: edge funkce běží mimo IP restrikce.

## Shrnutí Task 1.4
- **Reálné auth nálezy (live):** leaked-password protection OFF (B5); password length ověřit+zvednout (B5); anon sign-ins ON → příčina download_tokens CRITICAL (B1) + stale config (B5 doc).
- **Pozitiva:** admin MFA živě vynucené (2/2), API schémata úzká, JWT/refresh nastavení správné.
- **Metodická poznámka:** config.toml NEpoužívat jako důkaz produkčního auth stavu — ověřovat advisorem/dashboardem/DB.
