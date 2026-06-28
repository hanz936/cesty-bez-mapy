# Umami Cookieless Analytics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cookieless Umami analytics (pageviews + e-commerce events) and a Privacy/Cookies page to the `cesty-bez-mapy` React/Vite site, GDPR-compliant with no consent banner.

**Architecture:** Umami Cloud (external, EU region). The tracker `<script>` is injected into `index.html <head>` by a production-only Vite plugin (official Umami React/Vite method). A tiny `trackEvent()` wrapper sends e-commerce custom events; an inlined `umamiBeforeSend` handler strips sensitive query params. No runtime dependencies added.

**Tech Stack:** React 19, Vite 7, Vitest + React Testing Library, Tailwind 4, Vercel (CSP in `vercel.json`).

**Spec:** `docs/superpowers/specs/2026-06-14-umami-analytics-cookieless-design.md`

**Conventions:**
- Event names: `kebab-case`, English, ≤ 50 chars (Umami style).
- Numeric event data via JS `umami.track()` only (data-attributes store strings).
- `revenue` + `currency` ONLY on `purchase` (drives Umami Revenue report). `CZK` is valid ISO 4217.
- No PII in event data.
- Commit messages: `feat(analytics): …` / `test(analytics): …` (no Co-Authored-By trailer).

---

## Task 1: Analytics module (`trackEvent` + event constants)

**Files:**
- Create: `src/lib/analytics.js`
- Test: `src/lib/analytics.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/analytics.test.js
import { describe, it, expect, vi, afterEach } from 'vitest';
import { trackEvent, ANALYTICS_EVENTS } from './analytics';

afterEach(() => {
  delete window.umami;
  vi.restoreAllMocks();
});

describe('trackEvent', () => {
  it('no-ops (no throw) when window.umami is undefined', () => {
    expect(() => trackEvent('add-to-cart')).not.toThrow();
  });

  it('calls umami.track with name only when no data', () => {
    const track = vi.fn();
    window.umami = { track };
    trackEvent('itinerary-start');
    expect(track).toHaveBeenCalledWith('itinerary-start');
  });

  it('calls umami.track with name and data', () => {
    const track = vi.fn();
    window.umami = { track };
    trackEvent('purchase', { revenue: 199, currency: 'CZK', items: 2 });
    expect(track).toHaveBeenCalledWith('purchase', { revenue: 199, currency: 'CZK', items: 2 });
  });

  it('never throws if umami.track throws', () => {
    window.umami = { track: () => { throw new Error('boom'); } };
    expect(() => trackEvent('purchase', { revenue: 1, currency: 'CZK' })).not.toThrow();
  });

  it('exposes kebab-case event name constants', () => {
    expect(ANALYTICS_EVENTS.PURCHASE).toBe('purchase');
    expect(ANALYTICS_EVENTS.ADD_TO_CART).toBe('add-to-cart');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/analytics.test.js`
Expected: FAIL — cannot resolve `./analytics`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/analytics.js
// Thin wrapper around the Umami tracker (loaded via index.html in production).
// Safe to call anywhere: no-ops if the tracker is absent (dev, prerender, adblock)
// and never throws — analytics must not break the app.

export const ANALYTICS_EVENTS = {
  ADD_TO_CART: 'add-to-cart',
  BEGIN_CHECKOUT: 'begin-checkout',
  PURCHASE: 'purchase',
  ITINERARY_START: 'itinerary-start',
  ITINERARY_SUBMIT: 'itinerary-submit',
  NEWSLETTER_SIGNUP: 'newsletter-signup',
  CONTACT_SUBMIT: 'contact-submit',
};

export function trackEvent(name, data) {
  if (typeof window === 'undefined') return;
  const umami = window.umami;
  if (!umami || typeof umami.track !== 'function') return;
  try {
    if (data === undefined) umami.track(name);
    else umami.track(name, data);
  } catch {
    // intentionally ignored — analytics must never break the app
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/analytics.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics.js src/lib/analytics.test.js
git commit -m "feat(analytics): trackEvent wrapper + event name constants"
```

---

## Task 2: `umamiBeforeSend` payload sanitizer

Strips `session_id` and `token` from tracked URLs (e.g. the Stripe order-confirmation URL) while keeping `utm_*`. Pure and self-contained (no imports) so the Vite plugin can inline it via `.toString()`.

**Files:**
- Create: `src/lib/umamiBeforeSend.js`
- Test: `src/lib/umamiBeforeSend.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/umamiBeforeSend.test.js
import { describe, it, expect } from 'vitest';
import { sanitizeUmamiPayload } from './umamiBeforeSend';

describe('sanitizeUmamiPayload', () => {
  it('strips session_id from the url', () => {
    const out = sanitizeUmamiPayload('event', { url: '/cestovni-pruvodci/objednavka/potvrzeni?session_id=cs_test_123' });
    expect(out.url).toBe('/cestovni-pruvodci/objednavka/potvrzeni');
  });

  it('strips token but keeps utm params', () => {
    const out = sanitizeUmamiPayload('event', { url: '/x?utm_source=instagram&token=abc' });
    expect(out.url).toBe('/x?utm_source=instagram');
  });

  it('leaves a url without query untouched', () => {
    const out = sanitizeUmamiPayload('event', { url: '/cestovni-pruvodci' });
    expect(out.url).toBe('/cestovni-pruvodci');
  });

  it('returns the payload even when there is no url', () => {
    const payload = { foo: 1 };
    expect(sanitizeUmamiPayload('event', payload)).toBe(payload);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/umamiBeforeSend.test.js`
Expected: FAIL — cannot resolve `./umamiBeforeSend`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/umamiBeforeSend.js
// Umami `data-before-send` handler. Pure and dependency-free: the Vite build
// inlines this into index.html via Function.prototype.toString(), so it MUST NOT
// import anything or reference outer scope.
// Contract (Umami v2.18+): (type, payload) => payload (to send) | false (to cancel).
export function sanitizeUmamiPayload(type, payload) {
  if (payload && typeof payload.url === 'string' && payload.url.indexOf('?') !== -1) {
    const qIndex = payload.url.indexOf('?');
    const path = payload.url.slice(0, qIndex);
    const params = new URLSearchParams(payload.url.slice(qIndex + 1));
    params.delete('session_id');
    params.delete('token');
    const rest = params.toString();
    payload.url = rest ? path + '?' + rest : path;
  }
  return payload;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/umamiBeforeSend.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/umamiBeforeSend.js src/lib/umamiBeforeSend.test.js
git commit -m "feat(analytics): umamiBeforeSend URL sanitizer (strips session_id/token, keeps utm)"
```

---

## Task 3: Vite plugin — inject tracker into index.html (production only)

Injects, only when building for production AND `VITE_UMAMI_WEBSITE_ID` is set: (1) an inline bootstrap defining `window.umamiBeforeSend`, (2) the deferred Umami tracker. `data-domains` keeps the build machine (localhost preview during prerender) and previews from recording.

**Files:**
- Create: `vite/umami-plugin.js`
- Create: `vite/umami-plugin.test.js`
- Modify: `vite.config.js`

- [ ] **Step 1: Write the failing test**

```js
// vite/umami-plugin.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { umamiPlugin } from './umami-plugin.js';

const HTML = '<html><head><title>x</title></head><body></body></html>';

function resolved(plugin, { isProduction }) {
  // Minimal stand-in for Vite's ResolvedConfig.
  plugin.configResolved({ mode: isProduction ? 'production' : 'development', root: process.cwd(), isProduction });
}

describe('umamiPlugin', () => {
  beforeEach(() => { process.env.VITE_UMAMI_WEBSITE_ID = 'test-id-123'; });
  afterEach(() => { delete process.env.VITE_UMAMI_WEBSITE_ID; delete process.env.VITE_UMAMI_SRC; });

  it('injects the tracker in a production build with a website id', () => {
    const plugin = umamiPlugin();
    resolved(plugin, { isProduction: true });
    const out = plugin.transformIndexHtml(HTML);
    expect(out).toContain('data-website-id="test-id-123"');
    expect(out).toContain('data-before-send="umamiBeforeSend"');
    expect(out).toContain('window.umamiBeforeSend=');
    expect(out).toContain('data-domains="cestybezmapy.cz,www.cestybezmapy.cz"');
    expect(out).toContain('https://cloud.umami.is/script.js');
  });

  it('does nothing in a non-production build', () => {
    const plugin = umamiPlugin();
    resolved(plugin, { isProduction: false });
    expect(plugin.transformIndexHtml(HTML)).toBe(HTML);
  });

  it('does nothing when website id is missing', () => {
    delete process.env.VITE_UMAMI_WEBSITE_ID;
    const plugin = umamiPlugin();
    resolved(plugin, { isProduction: true });
    expect(plugin.transformIndexHtml(HTML)).toBe(HTML);
  });

  it('honors a custom VITE_UMAMI_SRC', () => {
    process.env.VITE_UMAMI_SRC = 'https://eu.umami.is/script.js';
    const plugin = umamiPlugin();
    resolved(plugin, { isProduction: true });
    expect(plugin.transformIndexHtml(HTML)).toContain('https://eu.umami.is/script.js');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run vite/umami-plugin.test.js`
Expected: FAIL — cannot resolve `./umami-plugin.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// vite/umami-plugin.js
import { loadEnv } from 'vite';
import { sanitizeUmamiPayload } from '../src/lib/umamiBeforeSend.js';

const DOMAINS = 'cestybezmapy.cz,www.cestybezmapy.cz';
const DEFAULT_SRC = 'https://cloud.umami.is/script.js';

// Production-only injection of the Umami tracker into index.html <head>.
// Reads env from process.env (Vercel) with a .env fallback (local builds).
export function umamiPlugin() {
  let enabled = false;
  let websiteId = '';
  let src = DEFAULT_SRC;

  return {
    name: 'umami-analytics',
    apply: 'build',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root || process.cwd(), 'VITE_');
      websiteId = process.env.VITE_UMAMI_WEBSITE_ID || env.VITE_UMAMI_WEBSITE_ID || '';
      src = process.env.VITE_UMAMI_SRC || env.VITE_UMAMI_SRC || DEFAULT_SRC;
      enabled = Boolean(config.isProduction && websiteId);
    },
    transformIndexHtml(html) {
      if (!enabled) return html;
      const bootstrap = `<script>window.umamiBeforeSend=${sanitizeUmamiPayload.toString()}</script>`;
      const tracker =
        `<script defer src="${src}" data-website-id="${websiteId}" ` +
        `data-domains="${DOMAINS}" data-do-not-track="true" data-before-send="umamiBeforeSend"></script>`;
      return html.replace('</head>', `    ${bootstrap}\n    ${tracker}\n  </head>`);
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run vite/umami-plugin.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire the plugin into `vite.config.js`**

Add the import after the existing imports (after line 5):

```js
import { umamiPlugin } from './vite/umami-plugin.js'
```

Add `umamiPlugin()` to the `plugins` array, immediately after the `sentryVitePlugin({ … })` block (it is the last plugin before the `]`):

```js
    sentryVitePlugin({
      org: 'cesty-bez-mapy',
      project: 'cesty-bez-mapy-web',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      telemetry: false,
      release: { name: process.env.VERCEL_GIT_COMMIT_SHA },
      sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
      disable: !process.env.SENTRY_AUTH_TOKEN, // active only on CI/Vercel, not local
    }),
    umamiPlugin(),
  ],
```

- [ ] **Step 6: Verify build does not break (no env → no injection)**

Run: `npm run build 2>&1 | tail -20`
Expected: build + prerender succeed. (Without `VITE_UMAMI_WEBSITE_ID` set, nothing is injected — confirm no `cloud.umami.is` in output: `grep -r "cloud.umami.is" dist/index.html || echo "not injected (expected)"`.)

- [ ] **Step 7: Commit**

```bash
git add vite/umami-plugin.js vite/umami-plugin.test.js vite.config.js
git commit -m "feat(analytics): Vite plugin injects Umami tracker into index.html (prod-only)"
```

---

## Task 4: CSP — allow `cloud.umami.is`

**Files:**
- Modify: `vercel.json`
- Test: `vercel.csp.test.js`

- [ ] **Step 1: Write the failing test**

```js
// vercel.csp.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url)));
const csp = cfg.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;
const directive = (name) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(name + ' '));

describe('CSP allows Umami', () => {
  it('script-src includes cloud.umami.is', () => {
    expect(directive('script-src')).toContain('https://cloud.umami.is');
  });
  it('connect-src includes cloud.umami.is', () => {
    expect(directive('connect-src')).toContain('https://cloud.umami.is');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run vercel.csp.test.js`
Expected: FAIL — `cloud.umami.is` not present.

- [ ] **Step 3: Edit `vercel.json` CSP**

In the `Content-Security-Policy` value, change the `script-src` segment from:

```
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com;
```
to:
```
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://cloud.umami.is;
```

And change the `connect-src` segment from:

```
connect-src 'self' https://*.supabase.co https://api.stripe.com https://ares.gov.cz https://dkblgznhnixubyoghrqe.functions.supabase.co https://*.ingest.de.sentry.io;
```
to:
```
connect-src 'self' https://*.supabase.co https://api.stripe.com https://ares.gov.cz https://dkblgznhnixubyoghrqe.functions.supabase.co https://*.ingest.de.sentry.io https://cloud.umami.is;
```

> If the Umami dashboard assigns a different EU host at signup, replace `https://cloud.umami.is` here (both directives) and `VITE_UMAMI_SRC` to match.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run vercel.csp.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add vercel.json vercel.csp.test.js
git commit -m "feat(analytics): allow cloud.umami.is in CSP (script-src + connect-src)"
```

---

## Task 5: Document env variables

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Append the Umami section to `.env.example`**

Add at the end of the file:

```env

# Umami cookieless analytics (set in Vercel → Production).
# Website ID from the Umami Cloud dashboard (EU region). Public — safe in the bundle.
# Tracker activates ONLY in production builds when this is set.
VITE_UMAMI_WEBSITE_ID=
# Optional: override the tracker script URL (default https://cloud.umami.is/script.js).
# Use the exact host shown in the dashboard for the chosen EU region.
VITE_UMAMI_SRC=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs(analytics): document VITE_UMAMI_* env variables"
```

---

## Task 6: Instrument `add-to-cart` (ProductDetail)

Thin call-site additions over the already-tested `trackEvent`. Verified live in Task 13.

**Files:**
- Modify: `src/pages/ProductDetail.jsx`

- [ ] **Step 1: Add the import**

After line 7 (`import { useCart } from '../contexts';`) add:

```jsx
import { trackEvent, ANALYTICS_EVENTS } from '../lib/analytics';
```

- [ ] **Step 2: Fire on "Přidat do košíku"**

In `handleAddToCart` (currently lines 201-210), add the track call inside the `if (success)` block:

```jsx
  const handleAddToCart = useCallback(() => {
    if (product) {
      const success = addToCart(product);
      if (success) {
        trackEvent(ANALYTICS_EVENTS.ADD_TO_CART, { product: product.slug, price: product.price });
        setAddedToCart(true);
        // Reset notifikace po 3 sekundách
        setTimeout(() => setAddedToCart(false), 3000);
      }
    }
  }, [product, addToCart]);
```

- [ ] **Step 3: Fire on "Koupit hned"**

In `handleBuyNow` (currently lines 213-218):

```jsx
  const handleBuyNow = useCallback(() => {
    if (product) {
      addToCart(product);
      trackEvent(ANALYTICS_EVENTS.ADD_TO_CART, { product: product.slug, price: product.price });
      navigate(ROUTES.CHECKOUT);
    }
  }, [product, addToCart, navigate]);
```

- [ ] **Step 4: Verify lint + build**

Run: `npm run lint && npm run build 2>&1 | tail -5`
Expected: no new lint errors; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ProductDetail.jsx
git commit -m "feat(analytics): track add-to-cart on product detail"
```

---

## Task 7: Instrument `begin-checkout` (Checkout)

**Files:**
- Modify: `src/pages/Checkout.jsx`

- [ ] **Step 1: Add the import**

After line 14 (`import { supabase } from '../lib/supabase';`) add:

```jsx
import { trackEvent, ANALYTICS_EVENTS } from '../lib/analytics';
```

- [ ] **Step 2: Fire at the start of `handleCheckout`**

In `handleCheckout` (currently line 102), add immediately after `setError(null);` (line 104):

```jsx
  const handleCheckout = useCallback(async () => {
    setIsProcessing(true);
    setError(null);
    trackEvent(ANALYTICS_EVENTS.BEGIN_CHECKOUT, { items: itemCount, value: cartTotal });
```

Then add `itemCount` and `cartTotal` to the `useCallback` dependency array (currently `[cartItems, captchaToken, billing, marketingConsent]`):

```jsx
  }, [cartItems, captchaToken, billing, marketingConsent, itemCount, cartTotal]);
```

- [ ] **Step 3: Verify lint + build**

Run: `npm run lint && npm run build 2>&1 | tail -5`
Expected: no new lint errors; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Checkout.jsx
git commit -m "feat(analytics): track begin-checkout before Stripe redirect"
```

---

## Task 8: Instrument `purchase` (OrderConfirmation, once per session)

**Files:**
- Modify: `src/pages/OrderConfirmation.jsx`

- [ ] **Step 1: Add the import**

After line 16 (`import { supabase } from '../lib/supabase';`) add:

```jsx
import { trackEvent, ANALYTICS_EVENTS } from '../lib/analytics';
```

- [ ] **Step 2: Add a once-guard ref**

Next to `const cartClearedRef = useRef(false);` (line 123) add:

```jsx
  const purchaseTrackedRef = useRef(false);
```

- [ ] **Step 3: Fire in the completed branch of `fetchOrder`**

Inside `if (data.status === 'completed' && data.order) {` (line 155), add after `setLoading(false);` (line 158):

```jsx
        // Track purchase once per session (guards against refresh / polling re-entry)
        if (!purchaseTrackedRef.current) {
          trackEvent(ANALYTICS_EVENTS.PURCHASE, {
            revenue: data.order.total_amount,
            currency: 'CZK',
            items: data.order.items?.length ?? 0,
          });
          purchaseTrackedRef.current = true;
        }
```

- [ ] **Step 4: Verify lint + build**

Run: `npm run lint && npm run build 2>&1 | tail -5`
Expected: no new lint errors; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/pages/OrderConfirmation.jsx
git commit -m "feat(analytics): track purchase (revenue/CZK) once per session"
```

---

## Task 9: Instrument `itinerary-start` + `itinerary-submit` (CustomItineraryForm)

**Files:**
- Modify: `src/pages/CustomItineraryForm.jsx`

- [ ] **Step 1: Add the import**

After line 7 (`import { supabase } from '../lib/supabase';`) add:

```jsx
import { trackEvent, ANALYTICS_EVENTS } from '../lib/analytics';
```

- [ ] **Step 2: Fire `itinerary-start` on mount**

The existing scroll-to-top effect is at lines 222-224. Add a dedicated effect right after it:

```jsx
  // Automatické poescrollování na vrchol při načtení stránky
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Analytika: uživatel otevřel dotazník itineráře na míru
  useEffect(() => {
    trackEvent(ANALYTICS_EVENTS.ITINERARY_START);
  }, []);
```

- [ ] **Step 3: Fire `itinerary-submit` on successful insert**

In `handleComplete`, after the success notification (line 201) and before `navigate(...)` (line 202):

```jsx
      // STEP 4: Navigate to preview page with request ID
      showNotification('Požadavek byl úspěšně uložen!', 'success');
      trackEvent(ANALYTICS_EVENTS.ITINERARY_SUBMIT);
      navigate(`/cestovni-pruvodci/itinerar-na-miru/nahled/${insertedRequest.id}`);
```

- [ ] **Step 4: Verify lint + build**

Run: `npm run lint && npm run build 2>&1 | tail -5`
Expected: no new lint errors; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/pages/CustomItineraryForm.jsx
git commit -m "feat(analytics): track itinerary-start (mount) and itinerary-submit"
```

---

## Task 10: Instrument `newsletter-signup` (NewsletterForm)

**Files:**
- Modify: `src/components/layout/NewsletterForm.jsx`

- [ ] **Step 1: Add the import**

After line 3 (`import logger from '../../utils/logger';`) add:

```jsx
import { trackEvent, ANALYTICS_EVENTS } from '../../lib/analytics';
```

- [ ] **Step 2: Accept a `location` prop (defaults to 'footer')**

Change the component signature (line 7) from `const NewsletterForm = () => {` to:

```jsx
const NewsletterForm = ({ location = 'footer' }) => {
```

- [ ] **Step 3: Fire on successful subscribe**

In `handleSubmit`, on success (currently line 65 `setStatus('done');`):

```jsx
        setStatus('done');
        trackEvent(ANALYTICS_EVENTS.NEWSLETTER_SIGNUP, { location });
        setEmail('');
        setToken(null);
```

Add `location` to the `useCallback` dependency array (currently `[email, token]`):

```jsx
    [email, token, location]
```

- [ ] **Step 4: Verify lint + build**

Run: `npm run lint && npm run build 2>&1 | tail -5`
Expected: no new lint errors; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/NewsletterForm.jsx
git commit -m "feat(analytics): track newsletter-signup with location"
```

---

## Task 11: Instrument `contact-submit` (Contact + Collaboration)

**Files:**
- Modify: `src/pages/Contact.jsx`
- Modify: `src/pages/Collaboration.jsx`

- [ ] **Step 1: Contact.jsx — import**

After line 1 (`import { useState, useCallback } from 'react';`) add:

```jsx
import { trackEvent, ANALYTICS_EVENTS } from '../lib/analytics';
```

- [ ] **Step 2: Contact.jsx — fire on success**

After `setIsSubmitted(true);` (line 95):

```jsx
      setIsSubmitted(true);
      trackEvent(ANALYTICS_EVENTS.CONTACT_SUBMIT, { type: 'contact' });
```

- [ ] **Step 3: Collaboration.jsx — import**

Add (after the existing `react` import at the top of the file):

```jsx
import { trackEvent, ANALYTICS_EVENTS } from '../lib/analytics';
```

- [ ] **Step 4: Collaboration.jsx — fire on success**

After `setSubmitSuccess(true);` (line 124):

```jsx
      setSubmitSuccess(true);
      trackEvent(ANALYTICS_EVENTS.CONTACT_SUBMIT, { type: 'collaboration' });
```

- [ ] **Step 5: Verify lint + build**

Run: `npm run lint && npm run build 2>&1 | tail -5`
Expected: no new lint errors; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Contact.jsx src/pages/Collaboration.jsx
git commit -m "feat(analytics): track contact-submit (contact + collaboration)"
```

---

## Task 12: Privacy / Cookies page + route + footer wiring

**Files:**
- Create: `src/pages/Privacy.jsx`
- Create: `src/pages/Privacy.test.jsx`
- Modify: `src/constants/routes.js`
- Modify: `src/App.jsx`
- Modify: `src/components/layout/Footer.jsx`
- Modify: `src/components/layout/NewsletterForm.jsx`

- [ ] **Step 1: Add the route constant**

In `src/constants/routes.js`, add to the `ROUTES` object (after `CONTACT: '/kontakt'`, add a comma to that line):

```js
  CONTACT: '/kontakt',
  PRIVACY: '/ochrana-osobnich-udaju'
```

- [ ] **Step 2: Write the failing test**

```jsx
// src/pages/Privacy.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PrivacyContent } from './Privacy';

describe('Privacy page content', () => {
  it('renders the heading and the cookieless analytics statement', () => {
    render(<MemoryRouter><PrivacyContent /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/ochran[aě] osobních údajů/i);
    expect(screen.getByText(/cookieless/i)).toBeInTheDocument();
  });

  it('lists key storage entries', () => {
    render(<MemoryRouter><PrivacyContent /></MemoryRouter>);
    expect(screen.getByText(/cbm_cart/)).toBeInTheDocument();
    expect(screen.getByText(/Umami/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/pages/Privacy.test.jsx`
Expected: FAIL — cannot resolve `./Privacy`.

- [ ] **Step 4: Create the page**

```jsx
// src/pages/Privacy.jsx
import React from 'react';
import Layout from '../components/layout/Layout';

// PrivacyContent is exported separately so it can be unit-tested without Layout.
// NOTE: Legal wording (controller identity, IČO, address) is a placeholder — to be
// completed/approved by the site owner (Jana), see [PLACEHOLDER] markers.
export function PrivacyContent() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 prose prose-green">
      <h1 className="text-3xl sm:text-4xl font-bold text-black mb-6">
        Zásady ochrany osobních údajů
      </h1>

      <p className="text-gray-700">
        Tyto zásady popisují, jaké údaje zpracováváme, proč a s kým je sdílíme.
        Náš web používá <strong>cookieless</strong> (anonymní) analytiku, nepoužíváme
        reklamní cookies, a proto na webu <strong>není potřeba souhlasná cookie lišta</strong>.
      </p>

      <h2 className="text-2xl font-bold text-black mt-10 mb-4">Správce údajů</h2>
      <p className="text-gray-700">
        [PLACEHOLDER — doplní Jana: jméno/firma, IČO, sídlo, kontaktní e-mail.]
        Kontakt: cestybezmapy@gmail.com.
      </p>

      <h2 className="text-2xl font-bold text-black mt-10 mb-4">Úložiště v prohlížeči</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2 pr-4">Klíč</th><th className="py-2 pr-4">Účel</th><th className="py-2">Kategorie</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b"><td className="py-2 pr-4">cbm_cart</td><td className="py-2 pr-4">obsah košíku</td><td className="py-2">nezbytné</td></tr>
          <tr className="border-b"><td className="py-2 pr-4">Supabase auth (sb-…-auth-token)</td><td className="py-2 pr-4">anonymní přihlášení k objednávce/formulářům</td><td className="py-2">nezbytné</td></tr>
        </tbody>
      </table>

      <h2 className="text-2xl font-bold text-black mt-10 mb-4">Služby třetích stran</h2>
      <p className="text-gray-700">
        Při některých akcích se načítají služby třetích stran, které mohou na svých
        doménách použít nezbytné cookies:
      </p>
      <ul className="text-gray-700">
        <li><strong>Stripe</strong> — platba (hostovaná platební brána).</li>
        <li><strong>Cloudflare Turnstile</strong> — ochrana formulářů proti spamu (bezpečnostní).</li>
        <li><strong>YouTube</strong> (režim bez cookies) — videa v blogu; cookies až po přehrání.</li>
      </ul>

      <h2 className="text-2xl font-bold text-black mt-10 mb-4">Analytika</h2>
      <p className="text-gray-700">
        <strong>Umami</strong> (server v EU) — anonymní statistika návštěvnosti.
        Cookieless, bez osobních údajů, neidentifikuje jednotlivce.
      </p>

      <h2 className="text-2xl font-bold text-black mt-10 mb-4">Zpracovatelé a lokace dat</h2>
      <p className="text-gray-700">
        V EU: Supabase (Frankfurt), Sentry (EU), Umami (EU), Ecomail (ČR), Fakturoid (ČR).
        Mimo EU (USA, zajištěno SCC/Data Privacy Framework): Stripe, YouTube, Resend.
      </p>

      <h2 className="text-2xl font-bold text-black mt-10 mb-4">Vaše práva</h2>
      <p className="text-gray-700">
        Máte právo na přístup, opravu, výmaz, omezení zpracování, přenositelnost a vznesení
        námitky. Žádosti směřujte na cestybezmapy@gmail.com. Můžete také podat stížnost
        u <a href="https://uoou.gov.cz" target="_blank" rel="noopener noreferrer">Úřadu pro ochranu osobních údajů (ÚOOÚ)</a>.
      </p>

      <p className="text-sm text-gray-500 mt-10">Účinnost: [PLACEHOLDER — datum].</p>
    </main>
  );
}

const Privacy = () => (
  <Layout>
    <PrivacyContent />
  </Layout>
);

Privacy.displayName = 'Privacy';

export default Privacy;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/pages/Privacy.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Register the route in `src/App.jsx`**

Add the import after line 24 (`import Contact from './pages/Contact';`):

```jsx
import Privacy from './pages/Privacy';
```

Add the route after the Contact route (line 108):

```jsx
            <Route path={ROUTES.CONTACT} element={<Contact />} />
            <Route path={ROUTES.PRIVACY} element={<Privacy />} />
```

- [ ] **Step 7: Wire the Footer link**

In `src/components/layout/Footer.jsx`, replace the `Ochrana údajů` anchor (the `<a href="#soukromi">…</a>` block) with a router Link (Footer already imports `Link` and `ROUTES`):

```jsx
              <Link
                to={ROUTES.PRIVACY}
                className="hover:text-green-400 transition-colors duration-300 motion-reduce:transition-none relative group focus-visible:text-green-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 rounded"
              >
                Ochrana údajů
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-green-400 transition-[width] duration-300 motion-reduce:transition-none group-hover:w-full"></span>
              </Link>
```

- [ ] **Step 8: Wire the NewsletterForm link**

In `src/components/layout/NewsletterForm.jsx`, add imports (after the analytics import added in Task 10):

```jsx
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants';
```

Replace the `<a href="#soukromi">Ochrana údajů</a>` (lines 164-169) with:

```jsx
          <Link
            to={ROUTES.PRIVACY}
            className="text-green-700 hover:text-green-800 underline transition-colors duration-300 motion-reduce:transition-none focus:outline-none"
          >
            Ochrana údajů
          </Link>
```

- [ ] **Step 9: Verify tests + lint + build**

Run: `npx vitest run && npm run lint && npm run build 2>&1 | tail -5`
Expected: all tests pass; no new lint errors; build succeeds.

- [ ] **Step 10: Commit**

```bash
git add src/pages/Privacy.jsx src/pages/Privacy.test.jsx src/constants/routes.js src/App.jsx src/components/layout/Footer.jsx src/components/layout/NewsletterForm.jsx
git commit -m "feat(analytics): privacy/cookies page + route + footer/newsletter links"
```

---

## Task 13: Documentation

**Files:**
- Create: `docs/MANUAL_SETUP_UMAMI.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Create `docs/MANUAL_SETUP_UMAMI.md`**

```markdown
# Manuální setup — Umami analytika

Cookieless analytika přes Umami Cloud (EU region). Aktivuje se až po nastavení env.

## 1. Účet a web
1. Registrace na https://cloud.umami.is/signup (plán **Hobby/Free**).
2. Při zakládání zvolit **EU region** (data v EU).
3. Settings → Websites → **Add website**: name `Cesty bez mapy`,
   domain `cestybezmapy.cz`.
4. Zkopírovat **Website ID** (UUID) a ověřit tracking host (očekáváme
   `https://cloud.umami.is/script.js`).

## 2. Env ve Vercelu (Production)
- `VITE_UMAMI_WEBSITE_ID` = zkopírované Website ID.
- `VITE_UMAMI_SRC` = jen pokud dashboard ukazuje jiný host než default.
- Redeploy. Pokud je host jiný, upravit i CSP ve `vercel.json`
  (`script-src` + `connect-src`).

## 3. Čeština + sdílení Janě
- Umami → Settings → Profile → **Language: Čeština**.
- Sdílet přístup Janě (Team member, nebo Website → Share URL pro jen-čtení).

## 4. Ověření
- Otevřít web, projít stránky → v Umami dashboardu naskočí pageviews.
- Vyvolat add-to-cart / begin-checkout / newsletter → eventy v sekci Events.
- Po testovacím nákupu zkontrolovat **Revenue** (CZK).
- Funnel: `/cestovni-pruvodci` → `add-to-cart` → `begin-checkout` → `purchase`.
```

- [ ] **Step 2: Add an "Analytika (Umami)" section to `CLAUDE.md`**

Append before the "## Deployment" section:

```markdown
## Analytika (Umami)

Cookieless analytika (bez consent banneru). Tracker se injektuje do `index.html`
přes Vite plugin [`vite/umami-plugin.js`](vite/umami-plugin.js) jen v produkci, když
je `VITE_UMAMI_WEBSITE_ID` nastavené. Custom e-commerce eventy přes
[`src/lib/analytics.js`](src/lib/analytics.js) (`trackEvent` + `ANALYTICS_EVENTS`).
URL se čistí v [`src/lib/umamiBeforeSend.js`](src/lib/umamiBeforeSend.js).
Setup: [`docs/MANUAL_SETUP_UMAMI.md`](docs/MANUAL_SETUP_UMAMI.md).

Env: `VITE_UMAMI_WEBSITE_ID` (povinné pro aktivaci), `VITE_UMAMI_SRC` (volitelné).
```

- [ ] **Step 3: Commit**

```bash
git add docs/MANUAL_SETUP_UMAMI.md CLAUDE.md
git commit -m "docs(analytics): manual setup guide + CLAUDE.md analytics section"
```

---

## Task 14: Full verification (after Umami account exists)

No code — a verification checklist run after the manual setup (Task 13 guide).

- [ ] **Step 1: Full test suite + build**

Run: `npx vitest run && npm run lint && npm run build`
Expected: all green.

- [ ] **Step 2: Confirm production injection (with env set)**

Run a production build with the env set, then check the output:
```bash
VITE_UMAMI_WEBSITE_ID=test-id npm run build && grep -o 'data-website-id="test-id"' dist/index.html
```
Expected: match found; also confirm `window.umamiBeforeSend=` and `data-domains` present in `dist/index.html`.

- [ ] **Step 3: Live dashboard verification (Vercel production)**

- Browse several pages → pageviews appear in Umami (Czech UI).
- Add to cart / begin checkout / submit newsletter → events appear under Events.
- Complete a test purchase → `purchase` event + Revenue in CZK; confirm only ONE `purchase` per session even after refreshing the confirmation page.
- Build the funnel `/cestovni-pruvodci → add-to-cart → begin-checkout → purchase`.
- DevTools console: **zero CSP violations**; confirm requests to `cloud.umami.is/api/send` succeed.
- Note: real Turnstile cannot be auto-clicked by Playwright — verify captcha-gated flows (contact, checkout) manually in a browser.

- [ ] **Step 4: Finish the branch**

Use superpowers:finishing-a-development-branch to merge/PR `feat/umami-analytics`.

---

## Self-Review

**Spec coverage:**
- Tool = Umami Cloud, cookieless, no banner → Tasks 3/4/12 (injection, CSP, privacy page). ✓
- Official method, no community package → Task 3 (script tag via plugin). ✓
- Events taxonomy (7 events, revenue/currency on purchase, kebab-case, JS for numerics) → Tasks 1, 6–11. ✓
- `data-domains` / `data-do-not-track` / `data-before-send` → Tasks 2, 3. ✓
- CSP script-src + connect-src → Task 4. ✓
- Env (`VITE_UMAMI_WEBSITE_ID`/`VITE_UMAMI_SRC`), prod-only activation → Tasks 3, 5. ✓
- Privacy page (factual inventory incl. cbm_cart + Supabase auth localStorage; Stripe hosted/no client.js; YouTube; ARES; EU data location), route, footer wiring, legal placeholders → Task 12. ✓
- Docs (MANUAL_SETUP_UMAMI, CLAUDE.md) → Task 13. ✓
- Testing (unit for pure modules + plugin + CSP + privacy; live verification incl. once-per-session purchase, CSP, funnel, revenue) → Tasks 1–4, 12, 14. ✓
- Prerender safety (data-domains stops localhost preview counting; injected script persists) → Task 3 build check + Task 14. ✓

**Placeholder scan:** Only intentional `[PLACEHOLDER]` markers in the Privacy page (legal wording = owner's responsibility, per spec scope). No TODO/TBD in code steps.

**Type/name consistency:** `trackEvent` / `ANALYTICS_EVENTS` (Task 1) used identically in Tasks 6–11. `sanitizeUmamiPayload` (Task 2) imported by `umami-plugin.js` (Task 3). `ROUTES.PRIVACY` defined (Task 12 Step 1) before use (Steps 6–8). `PrivacyContent` exported (Task 12 Step 4) and imported in its test (Step 2).

**Out of scope (per spec):** consent banner/CMP, marketing pixels, final legal text, Obchodní podmínky, script proxy/self-host, CSP Google-Fonts cleanup, admin analytics.
