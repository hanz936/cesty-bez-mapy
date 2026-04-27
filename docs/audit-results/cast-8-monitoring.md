# CAST 8: Monitoring, logging, error handling

**Datum auditu:** 2026-02-18
**Auditor:** Claude Code (automatizovany audit)

---

## 1. Error Tracking (externí služba)

### Stav: CHYBÍ

- **Sentry, Datadog, LogRocket, Bugsnag:** Žádná z těchto služeb není integrována ani v e-shopu, ani v admin panelu.
- V `package.json` obou projektů nejsou žádné závislosti na error tracking knihovnách.
- V `index.html` e-shopu nejsou žádné tracking skripty.

### Logger utility (e-shop)

Soubor `/src/utils/logger.js` obsahuje připravený wrapper:

```js
// Error monitoring service integration point
// errorMonitoring.captureException(safeError, { extra: additionalInfo })
```

- V development loguje plně (stack trace, additional info).
- V produkci loguje sanitizovanou verzi (bez stack trace).
- **Integration point pro Sentry/jiný systém je připravený, ale zakomentovaný.**

### Hodnocení

| Kritérium | Stav |
|-----------|------|
| Error tracking služba | CHYBÍ |
| Připravený integration point | Ano (logger.js) |
| Produkční error sanitizace | Ano |

**Doporučení:**
- Integrace Sentry (free tier stačí pro začátek) - odkomentovat a doplnit `errorMonitoring.captureException()` v `logger.js`.
- Alternativa: Supabase Edge Function pro sběr client-side errors.

---

## 2. React Error Boundaries

### E-shop: Ano

Soubor `/src/App.jsx` obsahuje `AppErrorBoundary` (class component):

```jsx
class AppErrorBoundary extends React.Component {
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        // User-friendly error page s tlačítkem "Obnovit stránku"
      );
    }
    return this.props.children;
  }
}
```

- Obaluje celou aplikaci (`<AppErrorBoundary>` kolem `<CartProvider>` a `<Router>`).
- Zobrazuje českou chybovou stránku s tlačítkem pro reload.
- Loguje chyby přes `logger.error()`.

### Admin panel: NE (spoléhá na React Admin)

- Žádný vlastní Error Boundary v admin panelu.
- React Admin má interní error handling, ale nezachytí všechny runtime chyby.

### Hodnocení

| Projekt | Error Boundary | UX při chybě |
|---------|---------------|--------------|
| E-shop | Ano (App-level) | Česká stránka + reload |
| Admin | Ne (React Admin default) | Generická chyba |

**Doporučení:**
- Zvážit granularnější Error Boundaries v e-shopu (checkout, product detail).
- V admin panelu je React Admin default dostatečný pro interní nástroj.

---

## 3. Error Handling v Edge Functions

Všech 5 Edge Functions má konzistentní error handling pattern:

### Společný pattern

```typescript
try {
  // Business logika
  // Input validace s 400 responses
  // DB chyby s console.error + 404/500 responses
} catch (error) {
  console.error("Error ...", error);
  return new Response(
    JSON.stringify({
      error: error instanceof Error ? error.message : "Neznámá chyba",
    }),
    { status: 500, headers: corsHeaders }
  );
}
```

### Detail po funkcích

| Funkce | Validace vstupu | Specifické error typy | Idempotence |
|--------|-----------------|----------------------|-------------|
| `create-checkout-session` | Ano (line_items, URLs) | Stripe errors (statusCode, code) | Ne |
| `stripe-webhook` | Ano (signature) | Webhook signature verification | Ano (duplicate order check) |
| `get-download-url` | Ano (token) | Token expiry (410 Gone) | N/A |
| `get-order-by-session` | Ano (session_id) | Stripe session retrieval | N/A |
| `create-stripe-product` | Ano (title, price, product_id) | Generic | Ne |

### Silné stránky

- `create-checkout-session`: Rozlišuje `Stripe.errors.StripeError` od generických chyb, vrací `error.code` a `error.statusCode`.
- `stripe-webhook`: Implementuje idempotenci (kontrola existující objednávky před vytvořením).
- `stripe-webhook`: Webhook signature verification pro bezpečnost.
- `get-download-url`: Správný HTTP status 410 (Gone) pro expirované tokeny.
- Všechny funkce logují průběh přes `console.log` (viditelné v Supabase Dashboard > Edge Functions > Logs).

### Slabiny

- Chybí structured logging (JSON format pro strojové zpracování).
- Logování citlivých dat: `console.log(JSON.stringify(session.customer_details))` ve webhook handleru loguje zákaznické údaje.
- Chybí request ID / correlation ID pro sledování requestů across functions.
- `console.error` jde pouze do Supabase interních logů - bez alertingu.

---

## 4. Health Checks

### Stav: CHYBÍ

- Žádný health check endpoint pro Edge Functions.
- Žádný uptime monitoring (UptimeRobot, Pingdom, apod.).
- Žádný cron job pro kontrolu stavu systému.

**Doporučení:**
- Přidat jednoduchý health check endpoint (GET `/health` na Edge Function).
- Nastavit UptimeRobot (free) pro monitoring e-shopu a API.
- Zvážit Supabase Cron (vyžaduje Pro plan) pro periodické kontroly.

---

## 5. Alerting

### Stav: CHYBÍ

- Žádný alerting systém.
- Chyby v Edge Functions jsou viditelné pouze v Supabase Dashboard logách.
- Stripe webhook failures: Stripe automaticky opakuje (retry), ale notifikace závisí na Stripe Dashboard nastavení.

**Doporučení:**
- Nastavit Stripe webhook failure alerts v Stripe Dashboard.
- Integrace Sentry pro real-time error alerting (email/Slack).
- Supabase Database Webhooks pro kritické DB eventy (volitelné).

---

## 6. Logging

### Přehled

| Vrstva | Typ logování | Kam | Retence |
|--------|-------------|-----|---------|
| E-shop (frontend) | `logger.js` wrapper | Browser console | Session |
| Admin (frontend) | React Admin default | Browser console | Session |
| Edge Functions | `console.log/error` | Supabase Logs | Supabase plan dependent |
| Database | `integration_logs` tabulka | PostgreSQL | Neomezená |

### integration_logs tabulka

```sql
CREATE TABLE integration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service text NOT NULL CHECK (service IN ('ecomail', 'facturoid', 'stripe', 'other')),
  action text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);
```

- Tabulka existuje, ale **aktuálně obsahuje 0 řádků** (viz Část 6 auditu).
- Edge Functions do ní **nezapisují** - logují pouze přes `console.log`.
- Potenciálně připravená pro Ecomail/Facturoid integraci.

**Doporučení:**
- Začít aktivně zapisovat do `integration_logs` z Edge Functions (alespoň stripe webhook events).
- Nebo ji nahradit externím logging systémem (Sentry, Datadog).

---

## 7. Shrnutí a prioritizace

### Kritické (před produkčním nasazením)

| # | Položka | Effort | Dopad |
|---|---------|--------|-------|
| 1 | Integrace Sentry (free tier) | 2h | Viditelnost produkčních chyb |
| 2 | Stripe webhook alerting v Stripe Dashboard | 15min | Notifikace o failed webhooks |
| 3 | Odstranit logování customer_details ve webhook | 5min | GDPR / bezpečnost |

### Důležité (brzy po nasazení)

| # | Položka | Effort | Dopad |
|---|---------|--------|-------|
| 4 | UptimeRobot pro e-shop | 15min | Uptime monitoring |
| 5 | Aktivní zápis do integration_logs | 2h | Audit trail pro integrece |
| 6 | Health check endpoint | 1h | Automatizovaný monitoring |

### Nice-to-have

| # | Položka | Effort | Dopad |
|---|---------|--------|-------|
| 7 | Structured logging (JSON) v Edge Functions | 2h | Strojové zpracování logů |
| 8 | Request correlation IDs | 1h | End-to-end tracing |
| 9 | Granularnější Error Boundaries v e-shopu | 1h | Lepší UX při partial failures |

---

## Celkové hodnocení

**Skóre: 4/10** - Základní error handling je přítomný a konzistentní, ale chybí produkční monitoring stack. Logger utility je připravený na integraci, Error Boundary v e-shopu je funkční. Hlavní mezera je absence jakéhokoli externího error trackingu a alertingu - v produkci budou chyby neviditelné bez aktivního sledování Supabase Dashboard.
