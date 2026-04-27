# ČÁST 6: Infrastruktura, production readiness, backup, monitoring

**Datum auditu:** 2026-02-15
**Auditor:** Claude Code (automatizovaný audit)
**Stav:** SQL dotazy doplněny 2026-02-16 přes pg modul.

---

## 1. DB stav (velikost, connections, extensions, realtime)

### Database
- **Velikost DB:** 13 MB
- **Aktivní spojení:** 13
- **Realtime:** Žádné tabulky publikovány (Realtime nepoužíván) ✅

### Extensions

| Extension | Schema |
|-----------|--------|
| moddatetime | extensions |
| pg_graphql | graphql |
| pg_stat_statements | extensions |
| pgcrypto | extensions |
| plpgsql | pg_catalog |
| supabase_vault | vault |
| uuid-ossp | extensions |

✅ Žádné extensions v public schema (lint rule 0014 OK)
✅ moddatetime a pgcrypto přítomny (očekávané)
⚠️ pg_cron CHYBÍ (vyžaduje Pro plan - potřeba pro cleanup expired tokens)

### Velikosti tabulek

| Tabulka | Řádky | Velikost |
|---------|-------|----------|
| products | 6 | 280 kB |
| orders | 6 | 152 kB |
| custom_itinerary_requests | 3 | 136 kB |
| user_roles | 0 | 64 kB |
| order_items | 9 | 64 kB |
| customers | 3 | 64 kB |
| integration_logs | 0 | 56 kB |
| categories | 3 | 48 kB |
| download_tokens | 0 | 48 kB |
| blog_posts | 0 | 40 kB |
| newsletter_consent_log | 0 | 40 kB |

📊 Malá DB, testovací/early-stage data. user_roles=0 je podezřelé (admin role by měla existovat).

**Očekávání na základě znalosti projektu:**
- ~11 tabulek (products, orders, order_items, customers, download_tokens, blog_posts, categories, custom_itinerary_requests, user_roles, atd.)
- Malá DB (testovací + pár reálných dat)
- Realtime pravděpodobně NEPOUŽÍVÁN (žádné subscription v kódu)
- Extensions: minimálně uuid-ossp (používán v migracích)

---

## 2. npm audit výsledky obou projektů

### E-shop (cesty-bez-mapy)
**7 vulnerabilities** (4 moderate, 2 high, 1 critical):
- **CRITICAL:** node-tar Race Condition (GHSA-r6q2-hw4h-h46w)
- **HIGH:** node-tar Hardlink Path Traversal (GHSA-34x7-hfp2-rc4v)
- **MODERATE:** Vite middleware issues (3x) - GHSA-g4jq-h2w9-997c, GHSA-jqfw-vq24-v9c3, GHSA-93m4-6634-74q7
- Fix: `npm audit fix`

### Admin (cesty-bez-mapy-admin)
**4 vulnerabilities** (2 moderate, 2 high):
- **HIGH:** React Router CSRF (GHSA-h5cw-625j-3rxh), XSS Open Redirects (GHSA-2w69-qvjg-hvjx)
- **MODERATE:** qs DoS (2x) - GHSA-6rw7-vpxm-498p, GHSA-w7fw-mjwx-w883
- Fix: `npm audit fix`

### Git secrets scan
✅ **Žádné secrets nalezeny** v git historii obou projektů (sk_live, sk_test, service_role, secret_key, private_key)

---

## 3. Dependency nesrovnalosti mezi projekty

### Porovnání klíčových závislostí

| Balíček | E-shop (main) | Admin | Rozdíl | Severity |
|---------|---------------|-------|--------|----------|
| `@supabase/supabase-js` | `^2.79.0` | `^2.84.0` | **5 minor verzí** | MEDIUM |
| `react` | `^19.1.0` | `^19.0.0` | Minor (kompatibilní) | LOW |
| `react-dom` | `^19.1.0` | `^19.0.0` | Minor (kompatibilní) | LOW |
| `react-router-dom` | `^7.7.1` | `^7.1.3` | **6 minor verzí** | MEDIUM |
| `vite` | `^7.0.4` | `^6.2.6` | **MAJOR rozdíl** | MEDIUM |
| `@types/react` | `^19.1.8` | `^18.3.3` | **MAJOR rozdíl** | HIGH |
| `@types/react-dom` | `^19.1.6` | `^18.3.0` | **MAJOR rozdíl** | HIGH |

### Detailní analýza

**@supabase/supabase-js:**
- E-shop: `^2.79.0`, Admin: `^2.84.0`
- Admin je novější, ale oba jsou v rámci major verze 2
- **Doporučení:** Sjednotit na nejnovější dostupnou verzi v obou projektech

**react / react-dom:**
- E-shop: `^19.1.0`, Admin: `^19.0.0`
- Oba jsou React 19, funkčně kompatibilní
- **Doporučení:** Sjednotit na `^19.1.0`

**react-router-dom:**
- E-shop: `^7.7.1`, Admin: `^7.1.3` (+ `react-router: ^7.1.3`)
- Značný rozdíl - 6 minor verzí
- **Doporučení:** Aktualizovat admin na `^7.7.1`

**vite:**
- E-shop: `^7.0.4` (major 7), Admin: `^6.2.6` (major 6)
- **MAJOR rozdíl** - e-shop je na Vite 7, admin na Vite 6
- **Doporučení:** Aktualizovat admin na Vite 7 (ověřit kompatibilitu s react-admin)

**@types/react + @types/react-dom:**
- E-shop: `^19.x`, Admin: `^18.x`
- Admin používá React 19 runtime ale TypeScript typy pro React 18
- **Doporučení:** Aktualizovat admin typy na `^19.x` - může odhalit nové type errory

### Pouze v jednom projektu

| Balíček | Projekt | Poznámka |
|---------|---------|----------|
| `tailwindcss` | E-shop | Styling framework |
| `@tailwindcss/vite` | E-shop | Vite plugin |
| `jspdf` | E-shop | PDF generování |
| `vitest` | E-shop | Testovací framework |
| `@mui/material` | Admin | UI framework (MUI 7) |
| `react-admin` | Admin | Admin framework |
| `ra-supabase` | Admin | Supabase data provider |
| `typescript` | Admin | TS compiler |
| `prettier` | Admin | Formátování |

---

## 4. Deno/Edge Function dependency analýza

### Import mapa

| Funkce | Stripe | Supabase JS | Import metoda |
|--------|--------|-------------|---------------|
| `create-checkout-session` | `stripe@20` | `@supabase/supabase-js@2` | Přímý esm.sh URL |
| `create-stripe-product` | `stripe@20` (via deno.json) | -- | Import map v deno.json |
| `stripe-webhook` | `stripe@20` | `@supabase/supabase-js@2` | Přímý esm.sh URL |
| `get-download-url` | -- | `@supabase/supabase-js@2` | Přímý esm.sh URL |
| `get-order-by-session` | `stripe@20` | `@supabase/supabase-js@2` | Přímý esm.sh URL |

### Přesné import URL

**Stripe:**
```
https://esm.sh/stripe@20?target=denonext
```
- Použito v: create-checkout-session, create-stripe-product (via import map), stripe-webhook, get-order-by-session
- Verze: `@20` = major range pinning (NE přesná verze)
- API verze: `2025-12-15.clover` (sjednocená napříč funkcemi)

**Supabase JS:**
```
https://esm.sh/@supabase/supabase-js@2
```
- Použito v: create-checkout-session, stripe-webhook, get-download-url, get-order-by-session
- Verze: `@2` = major range pinning (NE přesná verze)

### deno.json soubory

Pouze **1 z 5 funkcí** má `deno.json`:
- `/supabase/functions/create-stripe-product/deno.json` - obsahuje import map pro Stripe
- Ostatní 4 funkce: žádný deno.json, žádný import_map.json, žádný deno.lock

### Problémy

| # | Problém | Severity |
|---|---------|----------|
| D1 | **Major range pinning** (`@20`, `@2`) místo přesných verzí (`@20.1.0`, `@2.84.0`) | **HIGH** |
| D2 | **Nekonzistentní dependency management** - 1 funkce s deno.json, 4 bez | **MEDIUM** |
| D3 | **Žádný deno.lock** - buildy nejsou reprodukovatelné | **HIGH** |
| D4 | **esm.sh bez pin URL** - esm.sh podporuje `?pin=v135` pro immutable buildy | **MEDIUM** |

### Doporučení

1. **Přesné verze:** Změnit `stripe@20` na `stripe@20.x.x` a `@supabase/supabase-js@2` na `@supabase/supabase-js@2.84.0`
2. **Sjednotit deno.json:** Buď všechny funkce s vlastním deno.json, nebo globální import_map.json v `supabase/functions/`
3. **Přidat deno.lock:** Pro reprodukovatelné buildy
4. **Použít esm.sh pin:** `https://esm.sh/v135/stripe@20.1.0?target=denonext`

---

## 5. Git secrets scan výsledky

> **VYŽADUJE MANUÁLNÍ SPUŠTĚNÍ:**

```bash
# Main app
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy
git log -p --all -- '*.ts' '*.js' '*.jsx' '*.tsx' '*.env*' '*.json' | grep -iE "sk_live|sk_test|service_role|supabase_service|secret_key|private_key" | head -50

# Admin
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy-admin
git log -p --all -- '*.ts' '*.js' '*.jsx' '*.tsx' '*.env*' '*.json' | grep -iE "sk_live|sk_test|service_role|supabase_service|secret_key|private_key" | head -50
```

### .gitignore analýza (ověřeno)

**E-shop (.gitignore) - ROBUSTNÍ:**
- `.env`, `.env.local`, `.env.*.local`, `*.env` - pokryto
- `supabase/.env`, `supabase/config.toml`, `.supabase/`, `supabase/.temp/` - pokryto
- `*_backup.sql`, `schema_dump.sql` - pokryto
- `*.key`, `*.pem`, `*.p12`, `*.pfx`, `*.crt` - certifikáty pokryty
- `secrets.json`, `config.json` - pokryto
- SQL soubory ignorovány KROMĚ migrací (`!supabase/migrations/*.sql`) - dobře

**Admin (.gitignore) - MINIMÁLNÍ:**
- `.env`, `.env.local`, `.env*.local` - základní pokrytí
- `supabase/.temp/` - přidáno
- **CHYBÍ:** `*.key`, `*.pem`, `secrets.json`, `config.json`, `*.sql`, `*_backup.sql`

| # | Problém | Severity |
|---|---------|----------|
| G1 | Admin .gitignore je příliš minimální oproti main app | **MEDIUM** |
| G2 | Admin nemá ignoraci pro `*.key`, `*.pem`, certifikáty | **MEDIUM** |
| G3 | Admin nemá ignoraci pro `secrets.json`, `config.json` | **LOW** |

---

## 6. Error tracking/monitoring stav

### Výsledek hledání

**Hledané SDK:** Sentry, LogRocket, Bugsnag, Datadog, New Relic

| Projekt | Nalezeno | Stav |
|---------|----------|------|
| E-shop (src/) | **NIC** | Bez monitoringu |
| E-shop (package.json) | **NIC** | Žádná dependency |
| Admin (src/) | **NIC** | Bez monitoringu |
| Admin (package.json) | **NIC** | Žádná dependency |
| Edge Functions | **NIC** | Pouze console.log/error |

### Dopady

- **Frontend chyby** se ztrácejí - admin se o nich nedozví, pokud je uživatel nenahlásí
- **Edge Function chyby** jsou viditelné pouze v Supabase Dashboard → Logs (retence 1 den na Free plan)
- **Stripe webhook failures** viditelné pouze ve Stripe Dashboard
- **Žádný alerting** - nikdo není notifikován při výpadku

| # | Problém | Severity |
|---|---------|----------|
| M1 | **Žádný error tracking** v žádném projektu | **HIGH** |
| M2 | **Žádný uptime monitoring** | **MEDIUM** |
| M3 | **Edge function logy** retence pouze 1 den (Free plan) | **HIGH** |
| M4 | **Žádný alerting** při chybách | **HIGH** |

### Doporučení

1. **Sentry** pro oba frontend projekty (free tier: 5K events/měsíc)
2. **Sentry pro Edge Functions** (experimentální, ale možné přes `@sentry/deno`)
3. **UptimeRobot** pro uptime monitoring (free tier: 50 monitors)
4. **Supabase Log Drains** (vyžaduje Pro plan) → Sentry/Datadog
5. **Stripe webhook monitoring** - nastavit email notifikace ve Stripe Dashboard

---

## 7. Auth flow analýza

### Frontend callback handling

**Hledané patterny v e-shop src/:**
- `auth/callback` - **NENALEZENO**
- `reset-password` - **NENALEZENO**
- `confirm` - **NENALEZENO** (v auth kontextu)
- `verify` - **NENALEZENO**
- `onAuthStateChange` - **NENALEZENO**
- `SIGNED_IN` - **NENALEZENO**
- `PASSWORD_RECOVERY` - **NENALEZENO**

### Závěr

E-shop frontend **nemá žádný auth callback handler**. To znamená:
- Password reset emaily mohou odkazovat na URL, které aplikace nezpracovává
- Email confirmation flow nemusí fungovat správně
- Auth state změny nejsou sledovány (přihlášení/odhlášení)

| # | Problém | Severity |
|---|---------|----------|
| A1 | **Chybí auth callback route** v e-shop frontendu | **HIGH** |
| A2 | **Chybí onAuthStateChange listener** | **MEDIUM** |
| A3 | **Password reset flow** pravděpodobně nefunguje E2E | **HIGH** |

### Doporučení

1. Přidat `/auth/callback` route pro zpracování auth redirectů
2. Implementovat `onAuthStateChange` listener pro sledování auth stavu
3. Ověřit Supabase Dashboard → Auth → URL Configuration (redirect URLs)
4. Otestovat password reset flow end-to-end

---

## 8. Backup strategie

> **Test pg_dump VYŽADUJE MANUÁLNÍ SPUŠTĚNÍ:**

```bash
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy
npx supabase db dump --linked -f /tmp/test-backup.sql 2>&1
ls -la /tmp/test-backup.sql 2>/dev/null
```

### Aktuální stav

- **Plán:** Supabase Free plan
- **Automatické backupy:** NEDOSTUPNÉ na Free plan
- **Manuální backupy:** Pouze přes `supabase db dump` nebo přímý `pg_dump`
- **Backup procedura:** NEEXISTUJE (žádný dokumentovaný proces)
- **Restore test:** NIKDY PROVEDEN

| # | Problém | Severity |
|---|---------|----------|
| B1 | **Žádné automatické backupy** (Free plan) | **CRITICAL** |
| B2 | **Žádná backup procedura** dokumentována | **HIGH** |
| B3 | **Restore nikdy otestován** | **HIGH** |

### Doporučení

1. **Okamžitě:** Ověřit funkčnost `supabase db dump` (příkaz výše)
2. **Krátkodobě:** Nastavit GitHub Actions cron job pro pravidelný dump (denně)
3. **Střednědobě:** Upgrade na Pro plan (automatické nightly backupy, 7 dní retence)
4. **Otestovat restore:** `psql < dump.sql` na lokální DB

---

## 9. Security headers analýza

### E-shop (`vercel.json`)

```json
{
  "rewrites": [{"source": "/(.*)", "destination": "/index.html"}],
  "git": {"deploymentEnabled": {"main": false}}
}
```

**Security headers: ŽÁDNÉ**

| Header | Stav | Dopad |
|--------|------|-------|
| `X-Content-Type-Options` | CHYBÍ | MIME sniffing útoky |
| `X-Frame-Options` | CHYBÍ | Clickjacking |
| `X-XSS-Protection` | CHYBÍ | XSS (legacy) |
| `Content-Security-Policy` | CHYBÍ | XSS, injection |
| `Strict-Transport-Security` | CHYBÍ | Downgrade útoky |
| `Referrer-Policy` | CHYBÍ | Únik referrer dat |
| `Permissions-Policy` | CHYBÍ | Neoprávněný přístup k API |

### Admin (`vercel.json`)

```json
{
  "headers": [{
    "source": "/(.*)",
    "headers": [
      {"key": "X-Content-Type-Options", "value": "nosniff"},
      {"key": "X-Frame-Options", "value": "DENY"},
      {"key": "X-XSS-Protection", "value": "1; mode=block"},
      {"key": "Referrer-Policy", "value": "strict-origin-when-cross-origin"},
      {"key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation()"}
    ]
  }]
}
```

**Security headers: ČÁSTEČNÉ (5/7)**

| Header | Stav | Poznámka |
|--------|------|----------|
| `X-Content-Type-Options` | **OK** | `nosniff` |
| `X-Frame-Options` | **OK** | `DENY` |
| `X-XSS-Protection` | **OK** | `1; mode=block` |
| `Referrer-Policy` | **OK** | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | **OK** | Camera, mic, geo disabled |
| `Content-Security-Policy` | **CHYBÍ** | Kritický pro XSS prevenci |
| `Strict-Transport-Security` | **CHYBÍ** | Kritický pro HTTPS enforcement |

| # | Problém | Severity |
|---|---------|----------|
| S1 | **E-shop: ŽÁDNÉ security headers** | **HIGH** |
| S2 | **Admin: chybí CSP** | **MEDIUM** |
| S3 | **Admin: chybí HSTS** | **MEDIUM** |
| S4 | **E-shop: auto-deploy vypnutý** na main branch | **LOW** (info) |

### Doporučené headers pro e-shop (`vercel.json`)

```json
{
  "rewrites": [{"source": "/(.*)", "destination": "/index.html"}],
  "headers": [{
    "source": "/(.*)",
    "headers": [
      {"key": "X-Content-Type-Options", "value": "nosniff"},
      {"key": "X-Frame-Options", "value": "DENY"},
      {"key": "X-XSS-Protection", "value": "1; mode=block"},
      {"key": "Referrer-Policy", "value": "strict-origin-when-cross-origin"},
      {"key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()"},
      {"key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload"},
      {"key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https://*.supabase.co data:; connect-src 'self' https://*.supabase.co https://api.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com;"}
    ]
  }]
}
```

---

## 10. Free → Pro upgrade prioritní tabulka

| Feature | Free plan | Pro plan | Priorita | Důvod |
|---------|-----------|----------|----------|-------|
| **Automatické backupy** | Nedostupné | Nightly, 7 dní | **CRITICAL** | Produkční data bez zálohy |
| **Pause po neaktivitě** | Po 7 dnech | Nikdy | **CRITICAL** | E-shop může být nedostupný |
| **pg_cron** | Ne | Ano | **HIGH** | Cleanup expired tokens, scheduled tasks |
| **Network Restrictions** | Ne | Ano | **HIGH** | Omezení přístupu k DB |
| **Log retention** | 1 den | 7 dní | **HIGH** | Debugging edge function chyb |
| **Log Drains** | Ne | Ano | **MEDIUM** | Export logů do Sentry/Datadog |
| **Custom domains** | Ne | Ano | **LOW** | Lepší branding |
| **Email templates** | Omezené | Plné | **LOW** | Customizace auth emailů |

**Odhad měsíčních nákladů:** $25/měsíc (Supabase Pro plan)

**Doporučení:** Upgrade na Pro plan je **kriticky nutný** před ostrým spuštěním e-shopu. Minimálně kvůli:
1. Automatickým backupům (data jsou jinak nechráněná)
2. Prevenci auto-pause (e-shop nesmí být nedostupný)

---

## 11. Deployment infrastruktura přehled

| Aplikace | Hosting | Deploy metoda | CI/CD | Branch |
|----------|---------|---------------|-------|--------|
| E-shop | Vercel | **Manuální** (auto-deploy off) | Žádný | main |
| Admin | Vercel | **Auto-deploy** | Vercel auto | main |
| Edge Functions | Supabase | **Manuální** (`supabase functions deploy`) | Žádný | N/A |
| Migrace | Supabase | **Manuální** (`supabase db push`) | Žádný | N/A |

### Problémy

| # | Problém | Severity |
|---|---------|----------|
| I1 | **Žádný staging environment** | **HIGH** |
| I2 | **Edge functions deploy je manuální** - riziko zapomenutí | **MEDIUM** |
| I3 | **Migrace deploy je manuální** - riziko nesynchronizace | **MEDIUM** |
| I4 | **E-shop deploy je manuální** - nekonzistentní s admin | **LOW** |

### Doporučení pro staging

1. Separátní Supabase projekt (Free plan pro staging)
2. Separátní Stripe test mode (již existuje - test vs live keys)
3. GitHub Actions pro automatický deploy migrací a edge functions
4. `supabase link` pro přepínání mezi projekty

---

## 12. Supabase CLI verze

> **VYŽADUJE MANUÁLNÍ SPUŠTĚNÍ:**

```bash
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy
npx supabase --version
```

---

## 13. Souhrnná tabulka nalezených problémů

### CRITICAL

| # | Problém | Oblast | Akce |
|---|---------|--------|------|
| B1 | Žádné automatické backupy (Free plan) | Backup | Upgrade na Pro plan |

### HIGH

| # | Problém | Oblast | Akce |
|---|---------|--------|------|
| D1 | Major range pinning v edge functions (`@20`, `@2`) | Dependencies | Pinout na přesné verze |
| D3 | Žádný deno.lock v edge functions | Dependencies | Přidat deno.lock |
| M1 | Žádný error tracking v žádném projektu | Monitoring | Nasadit Sentry |
| M3 | Edge function logy retence 1 den | Monitoring | Pro plan + Log Drains |
| M4 | Žádný alerting při chybách | Monitoring | Sentry + UptimeRobot |
| A1 | Chybí auth callback route v e-shop frontendu | Auth | Implementovat /auth/callback |
| A3 | Password reset flow pravděpodobně nefunguje | Auth | Otestovat + implementovat |
| S1 | E-shop: ŽÁDNÉ security headers | Security | Přidat do vercel.json |
| B2 | Žádná backup procedura dokumentována | Backup | Vytvořit runbook |
| B3 | Restore nikdy otestován | Backup | Provést test restore |
| I1 | Žádný staging environment | Infra | Vytvořit staging Supabase projekt |

### MEDIUM

| # | Problém | Oblast | Akce |
|---|---------|--------|------|
| D2 | Nekonzistentní deno.json (1/5 funkcí) | Dependencies | Sjednotit |
| D4 | esm.sh bez pin URL | Dependencies | Přidat `?pin=vXXX` |
| G1 | Admin .gitignore příliš minimální | Security | Rozšířit dle main app |
| G2 | Admin chybí ignorace certifikátů | Security | Přidat `*.key`, `*.pem` |
| S2 | Admin: chybí CSP header | Security | Přidat Content-Security-Policy |
| S3 | Admin: chybí HSTS header | Security | Přidat Strict-Transport-Security |
| M2 | Žádný uptime monitoring | Monitoring | UptimeRobot |
| A2 | Chybí onAuthStateChange listener | Auth | Implementovat |
| I2 | Edge functions deploy manuální | Infra | GitHub Actions |
| I3 | Migrace deploy manuální | Infra | GitHub Actions |
| -- | `@supabase/supabase-js` rozdíl: e-shop ^2.79 vs admin ^2.84 | Dependencies | Sjednotit |
| -- | `react-router-dom` rozdíl: e-shop ^7.7 vs admin ^7.1 | Dependencies | Sjednotit |
| -- | `vite` major rozdíl: e-shop ^7 vs admin ^6 | Dependencies | Aktualizovat admin |

### LOW

| # | Problém | Oblast | Akce |
|---|---------|--------|------|
| G3 | Admin chybí ignorace secrets.json, config.json | Security | Přidat |
| S4 | E-shop auto-deploy vypnutý | Infra | Info - záměrný |
| -- | `@types/react` major rozdíl: e-shop ^19 vs admin ^18 | Dependencies | Aktualizovat admin |
| I4 | E-shop deploy manuální | Infra | Zvážit auto-deploy |

---

## 14. Položky vyžadující manuální ověření

Následující kontroly vyžadují Bash přístup nebo Supabase Dashboard:

### Bash příkazy k manuálnímu spuštění

```bash
# 1. SQL dotazy (DB stav)
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy
npx supabase db query --linked "SELECT extname, extnamespace::regnamespace AS schema FROM pg_extension WHERE extnamespace = 'public'::regnamespace;"
npx supabase db query --linked "SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';"
npx supabase db query --linked "SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size;"
npx supabase db query --linked "SELECT count(*) AS active_connections FROM pg_stat_activity;"
npx supabase db query --linked "SELECT relname, n_live_tup, pg_size_pretty(pg_total_relation_size(relid)) AS total_size FROM pg_stat_user_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(relid) DESC;"

# 2. npm audit
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy && npm audit 2>&1
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy-admin && npm audit 2>&1

# 3. Git secrets scan
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy && git log -p --all -- '*.ts' '*.js' '*.jsx' '*.tsx' '*.env*' '*.json' | grep -iE "sk_live|sk_test|service_role|supabase_service|secret_key|private_key" | head -50
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy-admin && git log -p --all -- '*.ts' '*.js' '*.jsx' '*.tsx' '*.env*' '*.json' | grep -iE "sk_live|sk_test|service_role|supabase_service|secret_key|private_key" | head -50

# 4. Backup test
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy && npx supabase db dump --linked -f /tmp/test-backup.sql 2>&1
ls -la /tmp/test-backup.sql 2>/dev/null

# 5. Supabase CLI verze
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy && npx supabase --version
```

### Supabase Dashboard kontroly

- [ ] Authentication → Email confirmations enabled?
- [ ] Authentication → OTP expiry (≤3600s)?
- [ ] Authentication → Minimum password length (≥8)?
- [ ] Authentication → CAPTCHA (Cloudflare Turnstile)?
- [ ] Authentication → Anonymous sign-ins enabled?
- [ ] Authentication → Custom SMTP?
- [ ] Authentication → MFA enforcement?
- [ ] Authentication → Email Templates - customizované?
- [ ] Authentication → URL Configuration - redirect URLs správně?
- [ ] API → Exposed schemas: jen public?
- [ ] API → JWT expiry (3600s)?
- [ ] API → Max rows per request?
- [ ] Database → SSL Enforcement?
- [ ] Database → Connection pooling mode?
- [ ] Storage → Bucket size limits?
- [ ] Storage → Allowed MIME types?
- [ ] Storage → Public buckets: jen products-images a blog-images?

---

## 15. Executive summary

### Stav: Vhodné pro testovací provoz, NEVHODNÉ pro produkci

Projekt má základní funkční infrastrukturu (Supabase Free plan + Vercel + Stripe), ale pro produkční nasazení chybí klíčové bezpečnostní a provozní prvky:

**Top 3 akce před spuštěním:**

1. **Upgrade Supabase na Pro plan** ($25/měsíc) - automatické backupy, žádný auto-pause, lepší logy
2. **Nasadit error tracking** (Sentry free tier) - bez monitoringu se o chybách nedozvíte
3. **Přidat security headers** do e-shop vercel.json - aktuálně ŽÁDNÉ

**Odhadovaný čas na opravu všech CRITICAL + HIGH issues:** 2-3 dny práce + $25/měsíc za Pro plan.
