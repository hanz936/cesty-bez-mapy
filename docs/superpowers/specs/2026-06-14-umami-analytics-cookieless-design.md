# Cookieless analytika (Umami) + Zásady cookies — Design

- **Datum:** 2026-06-14
- **Repo:** `cesty-bez-mapy` (frontend), větev `feat/umami-analytics`
- **Stav:** Schváleno k sepsání plánu (brainstorming hotový, 3 ověřovací průchody)
- **Autor rozhodnutí:** parma29 (tech lead). Dashboard používá Jana (business owner).

## 1. Cíl a kontext

Web `cestybezmapy.cz` (React 19 + Vite 7 SPA, prerender, Vercel, Cloudflare DNS,
Supabase, Sentry-EU) **dosud nemá žádnou analytiku ani stránku zásad**. Footer odkazy
„Obchodní podmínky" (`#podminky`) a „Ochrana údajů" (`#soukromi`) jsou jen placeholdery.

Chceme měřit **návštěvnost + klíčové e-commerce události** způsobem, který je
**co nejlepší pro EU (GDPR/ÚOOÚ) a zdarma**, s **českým rozhraním pro Janu**.

### Cíle
- Sledovat návštěvnost (zdroje, top stránky/produkty, zařízení, země).
- Sledovat nákupní funnel a tržby (view → add-to-cart → begin-checkout → purchase).
- Plně GDPR/ÚOOÚ compliant, **bez opt-in cookie lišty**.
- Zdarma, nízká údržba, české UI dashboardu.
- Stránka Zásady ochrany osobních údajů (scaffold + faktická cookie tabulka).

### Ne-cíle (mimo rozsah)
- Žádný consent banner / CMP (cookieless → není potřeba).
- Žádné marketingové/reklamní pixely (Meta, Google Ads, retargeting).
- Finální právní text zásad (dodá/schválí Jana, příp. právník).
- Stránka Obchodní podmínky.
- Proxy/self-host migrace Umami (zdokumentováno jako budoucí volba).
- Úklid nepoužitých `fonts.googleapis`/`gstatic` originů v CSP.
- Analytika v admin panelu.

## 2. Zvolený nástroj: Umami (Umami Cloud, EU region, free)

### Rozhodnutí a zdůvodnění
- **Cookieless → bez banneru.** Umami nepoužívá cookies, neukládá PII, neidentifikuje
  jednotlivce. Podle ÚOOÚ stačí informovat na podstránce, lišta není nutná; protože
  nemáme žádné nenezbytné cookies, není ani k čemu dávat souhlas.
- **Zdarma + EU rezidence.** Umami Cloud free = 100k událostí/měs, 3 weby, bez karty;
  servery v US **i EU** → při signupu zvolíme **EU region**.
- **Lean (~2 KB skript)** — sedí na přísný CSP a performance ladění webu.
- **České UI** — jediná ze zvažovaných možností (Umami má `cs-CZ` lokalizaci;
  PostHog ani Vercel Analytics češtinu nemají).
- **Funnel + Revenue + Goals** reporty pokrývají „kde lidé odpadávají" a tržby.

### Zamítnuté alternativy
- **GA4** — v EU právně nejproblematičtější (transfery do US, Schrems II), vynucuje
  opt-in banner + Consent Mode v2, ztráta 30–60 % dat od odmítnutí. Proti všem cílům.
- **PostHog EU** — zdarma, EU (Frankfurt), nejlepší funnely, ale těžký skript (~50 KB)
  a UI jen anglicky. Overkill pro malý e-shop.
- **Vercel Web Analytics** — nejmenší zásah + Core Web Vitals, ale na Pro pay-per-event,
  data v US, bez vizuálního funnelu, UI jen anglicky.
- **Umami self-host** — plná EU rezidence a vlastnictví, ale provozní zátěž (druhý deploy
  + DB) pro solo provoz těsně před launchem. Ponecháno jako budoucí migrace (stejný nástroj).

## 3. Architektura

Umami Cloud běží mimo náš kód. Do webu přidáme jediný lehký tracker skript; ten
**sám sleduje pageviews i SPA route changes** (hlídá History API: `pushState`,
`replaceState`, `popstate`). E-commerce akce posíláme ručně přes `window.umami.track()`.
Data tečou cookieless POSTem (`fetch`/`sendBeacon`) na `<host>/api/send`, anonymně
(hash návštěvníka, session zahozena po 24 h).

### Jednotky

1. **Vite plugin v `vite.config.js` (`transformIndexHtml`)** — vloží do `index.html <head>`:
   - drobný **inline bootstrap** definující `window.umamiBeforeSend` (sanitizace URL),
   - **deferred Umami `<script>`** s atributy (viz níže),
   - **jen v produkčním buildu** a jen když je `VITE_UMAMI_WEBSITE_ID` nastavené
     (Vite je u podmínek v HTML záměrně neopinionated → řeší se pluginem; zároveň to
     zabrání nenahrazenému literálu `%VITE_%` a načítání skriptu v dev/preview).

   Atributy skriptu:
   ```html
   <script defer
     src="<EU host>/script.js"            <!-- z VITE_UMAMI_SRC, default cloud.umami.is -->
     data-website-id="<VITE_UMAMI_WEBSITE_ID>"
     data-domains="cestybezmapy.cz,www.cestybezmapy.cz"
     data-do-not-track="true"
     data-before-send="umamiBeforeSend"></script>
   ```

2. **`src/lib/analytics.js`** — jen aplikační vrstva (ne načítání skriptu):
   - `trackEvent(name, data)` — wrap `window.umami?.track(...)`; když tracker není
     (adblock, dev, prerender), **tiše no-opne** (žádná chyba).
   - `ANALYTICS_EVENTS` — konstanty názvů eventů (proti překlepům).

3. **`umamiBeforeSend(type, payload)`** (inline bootstrap) — z URL odstřihne citlivé
   parametry (`session_id`, `token`) a **ponechá `utm_*`**; vrací upravený payload.

4. **Instrumentace** — volání `trackEvent(...)` v existujících komponentách (viz §4).

5. **Stránka Zásady** + routa + footer wiring (viz §5).

6. **CSP / env / docs / testy** (viz §6–§8).

### Tok dat
`Návštěvník → pageview (auto) → Umami` … `e-commerce akce → trackEvent() →
window.umami.track() → Umami` … `Jana → Umami Cloud (české UI) → návštěvnost,
top produkty, zdroje, funnel, tržby (CZK)`.

### Ošetření hran
- Adblock/dev/prerender → `trackEvent` no-op bez chyb (25–45 % requestů blokují
  adblockery i u privacy-first domén → akceptováno; proxy je budoucí volba).
- `purchase` **jen 1× per `session_id`** (pojistka proti refreshi potvrzení).
- **Žádné PII** v datech eventů (jen produkt/hodnota/měna, ne jméno/e-mail/order-id osoby).
- `data-domains` brání počítání localhost/preview (dvojitá pojistka k prod-only injekci).
- Ověřit, že `scripts/prerender.mjs` zachová `<head>` skript v prerenderovaných stránkách.

## 4. Eventy (taxonomie)

Konvence: krátké, anglické, `kebab-case` (styl Umami docs), ≤ 50 znaků, bez PII.
Pageviews jdou automaticky (každá routa vč. `/pruvodce/:slug`) → `view-item` neměříme.
**Číselná data jen přes JS `umami.track()`** (data-atributy ukládají vše jako text).
**`revenue` + `currency` jen na `purchase`** (jinak by se křivil Revenue report; `CZK` je
platný ISO 4217).

| Event | Kde | Data |
|---|---|---|
| `add-to-cart` | ProductDetail / CartContext | `{ product, price }` |
| `begin-checkout` | Checkout, před Stripe redirectem | `{ items, value }` |
| `purchase` | OrderConfirmation, **1× per session_id** | `{ revenue, currency: 'CZK', items }` |
| `itinerary-start` | CustomItineraryForm (1. krok) | — |
| `itinerary-submit` | odeslání dotazníku na míru | — |
| `newsletter-signup` | NewsletterForm (footer + checkout) | `{ location }` |
| `contact-submit` | Contact / Collaboration | `{ type }` |

Funnel pro Janu: `/cestovni-pruvodci` → `add-to-cart` → `begin-checkout` → `purchase`.
Tržby se sčítají z `purchase` (Revenue report); konverze přes Goals report.

## 5. Stránka Zásady ochrany osobních údajů

- Nová routa `ROUTES.PRIVACY = '/ochrana-osobnich-udaju'` → `src/pages/Privacy.jsx` (česky).
- Footer placeholder `#soukromi` („Ochrana údajů") přepojit na tuto routu.

### Faktický inventář (ověřeno v kódu)

**A) Úložiště na naší doméně (localStorage):**
| Klíč | Účel | Kategorie |
|---|---|---|
| `cbm_cart` | obsah košíku | nezbytné |
| `sb-<ref>-auth-token` (Supabase) | anonymní přihlášení k objednávce/formulářům | nezbytné |

**B) Třetí strany aktivované akcí uživatele (cookies na JEJICH doméně):**
| Služba | Kdy | Pozn. |
|---|---|---|
| Stripe Checkout | platba | hostovaný redirect → cookies na `checkout.stripe.com` (client-side Stripe.js se nepoužívá) |
| Cloudflare Turnstile | odeslání formuláře | bezpečnostní |
| YouTube (nocookie) | přehrání videa v blogu | cookies až po kliknutí na play |

**C) Zpracovatelé (server-side, bez client cookies):** Supabase, Sentry (EU), Ecomail,
Resend, Fakturoid, ARES (client-side lookup IČO, bez cookie).

**D) Analytika:** Umami (EU region) — cookieless, anonymní, bez PII.

> Pozn.: Web nenačítá Google Fonts (běží na systémových fontech) — žádný GDPR problém
> s fonty, byť CSP je zatím povoluje.

### Kostra stránky (GDPR čl. 13 + ÚOOÚ)
Správce + kontakt **(placeholder pro Janu — IČO, adresa, e-mail)**; účely a právní
základy; oprávněné zájmy; příjemci/zpracovatelé (seznam výše + odkazy na jejich zásady);
předání mimo EU (US zpracovatelé → SCC/DPF); doba uložení; práva subjektu; stížnost
k ÚOOÚ; datum účinnosti. **Bez banneru.** Finální právní formulace = Jana/právník.

## 6. CSP, env, konfigurace

### CSP (`vercel.json`)
Přidat Umami host do dvou direktiv (tracker jede přes `fetch`/`sendBeacon`, žádný
img-pixel → `img-src` netřeba):
- `script-src` → `https://cloud.umami.is`
- `connect-src` → `https://cloud.umami.is`

Inline bootstrap (`umamiBeforeSend`) využije **už existující `'unsafe-inline'`** v
`script-src`. Přesný host potvrdit z dashboardu po výběru **EU regionu** (očekáváme
`cloud.umami.is`).

### Env proměnné (Vercel → Production; web ID je veřejné, smí být v bundlu)
- `VITE_UMAMI_WEBSITE_ID` — ID webu z dashboardu (povinné pro aktivaci).
- `VITE_UMAMI_SRC` *(volitelné)* — default `https://cloud.umami.is/script.js`
  (umožní pozdější proxy/self-host bez zásahu do kódu).
- Aktivace: skript se injektne jen když je `VITE_UMAMI_WEBSITE_ID` vyplněné **a**
  build je produkční. Doplnit do `.env.example`.

## 7. Dokumentace
- `docs/MANUAL_SETUP_UMAMI.md` (styl `MANUAL_SETUP_TURNSTILE.md`): založení Umami Cloud
  účtu → **EU region** → přidat web `cestybezmapy.cz` → zkopírovat web ID → nastavit
  env ve Vercelu → **přepnout dashboard do češtiny** → sdílet přístup Janě → ověřit
  příchozí eventy.
- Frontend `CLAUDE.md`: krátká sekce „Analytika (Umami)" + env + odkaz na
  `src/lib/analytics.js`.

## 8. Testování
- **Unit (Vitest):**
  - `trackEvent` bezpečně no-opne bez `window.umami`; jinak volá `umami.track(name, data)`
    se správnými argumenty.
  - `umamiBeforeSend` odstřihne `session_id`/`token`, ponechá `utm_*`; nespadne na chybějících polích.
  - Vite plugin injektuje skript jen v produkci a se správnými atributy (idempotentně).
  - `purchase` se vyšle jen 1× per `session_id`.
- **Živé ověření (po deploy):** projít web, vyvolat add-to-cart / begin-checkout /
  newsletter → zkontrolovat pageviews + eventy v dashboardu, sestavit funnel, po
  testovacím nákupu ověřit Revenue v CZK; **0 CSP violations** v konzoli.
  - Reálný Turnstile Playwright neproklikne → captcha-gated flows (kontakt/checkout)
    ověřit ručně v prohlížeči.
  - Během prelaunche (Basic auth + noindex) se počítají i vlastní návštěvy — baseline.

## 9. Pořadí implementace
1. `src/lib/analytics.js` (`trackEvent` + `ANALYTICS_EVENTS`) + unit testy.
2. Vite plugin (`transformIndexHtml`): inline `umamiBeforeSend` bootstrap + deferred
   Umami skript (prod-only, dle env) + unit test pluginu.
3. CSP v `vercel.json` (script-src + connect-src `cloud.umami.is`).
4. Instrumentace eventů v komponentách (cart, ProductDetail, Checkout, OrderConfirmation,
   CustomItineraryForm, NewsletterForm, Contact/Collaboration).
5. `src/pages/Privacy.jsx` + `ROUTES.PRIVACY` + přepojení footeru.
6. Docs (`MANUAL_SETUP_UMAMI.md`, `CLAUDE.md`).
7. **Manuální setup účtu (uživatel/Jana)** — Umami Cloud + EU region + web ID do Vercelu.
8. Živé ověření.

## 10. Otevřené / manuální kroky (na uživateli)
- Založit Umami Cloud účet, zvolit **EU region**, přidat web, získat `VITE_UMAMI_WEBSITE_ID`.
- Nastavit env ve Vercel Production; potvrdit přesný host pro CSP.
- Přepnout dashboard do češtiny a sdílet přístup Janě.
- Doplnit/schválit právní text stránky Zásady (správce, kontakt, IČO).

## 11. Ověřovací log (zdroje, 06/2026)
- **Umami tracker / SPA / events / funnel / revenue** — Context7 `/websites/umami_is`
  + Firecrawl scrape oficiálních docs (`tracker-configuration`, `track-events`, `revenue`,
  `guides/track-single-page-apps`): SPA auto-track přes History API; `umami.track(name,data)`;
  číselná data jen přes JS; `revenue`+`currency` pro Revenue report; název ≤ 50 znaků;
  funnel kroky `path`|`event`; atributy `data-domains`/`data-do-not-track`/`data-before-send`/
  `data-exclude-search`. React/Vite metoda = skript v `index.html <head>`; žádný oficiální
  `@umami/react`; tracker přes `fetch`/`sendBeacon`.
- **Umami cookieless / GDPR / EU region** — umami.is/pricing + homepage: „No cookies
  required", „servers in US and EU", GDPR/CCPA.
- **Vite** — Context7 `/vitejs/vite`: `%VITE_%` HTML replacement, podmínky přes
  `transformIndexHtml` plugin, jen `VITE_`-prefix do klientu, `import.meta.env.PROD`.
- **EU/ČR právo** — ÚOOÚ Q&A k cookies (banner není nutný, stačí podstránka);
  GDPR čl. 13 povinný obsah; GA4 v EU právně rizikové (Schrems II).
- **Realita adblock** — Nuxt Scripts / Blockthrough 2026: 25–45 % blokace trackerů.
- **Kód projektu** — ověřen inventář úložišť/třetích stran (jen `cbm_cart` + Supabase
  auth v localStorage; bez client Stripe.js; bez Google Fonts; YouTube nocookie; ARES).
