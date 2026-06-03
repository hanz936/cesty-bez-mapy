// Sentry browser init. MUST be imported first in main.jsx (before any app code).
import * as Sentry from "@sentry/react";

// Strip the query string from a URL. Our URLs can carry sensitive tokens
// (Stripe `session_id` on the order-confirmation page, `preview_token` for blog
// drafts), which would otherwise land in Sentry via request.url / breadcrumbs.
function stripQuery(url) {
  if (typeof url !== "string") return url;
  const i = url.indexOf("?");
  return i === -1 ? url : url.slice(0, i);
}

// Pure, testable PII scrubber used by beforeSend. It strips user.email /
// user.ip_address and removes query strings from request + navigation/fetch
// breadcrumb URLs. Request headers and cookies are NOT the scrubber's job —
// `sendDefaultPii: false` (below) already prevents the SDK from attaching them.
// If code later calls Sentry.setExtra/setContext/setUser with PII, extend this.
export function scrubPii(event) {
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
  }
  if (event.request) {
    delete event.request.query_string;
    if (event.request.url) event.request.url = stripQuery(event.request.url);
  }
  if (Array.isArray(event.breadcrumbs)) {
    for (const b of event.breadcrumbs) {
      if (!b || !b.data) continue;
      if (typeof b.data.url === "string") b.data.url = stripQuery(b.data.url);
      if (typeof b.data.to === "string") b.data.to = stripQuery(b.data.to);
      if (typeof b.data.from === "string") b.data.from = stripQuery(b.data.from);
    }
  }
  return event;
}

const dsn = import.meta.env.VITE_SENTRY_DSN;
const environment = import.meta.env.VITE_VERCEL_ENV ?? import.meta.env.MODE;
const release = import.meta.env.VITE_SENTRY_RELEASE;

// Do not run locally, without a DSN, or during the Playwright prerender (navigator.webdriver === true).
const isPrerender = typeof navigator !== "undefined" && navigator.webdriver;
const enabled = Boolean(dsn) && import.meta.env.PROD && !isPrerender;

if (enabled) {
  Sentry.init({
    dsn,
    environment,
    release,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    sendDefaultPii: false,
    beforeSend: scrubPii,
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications.",
      "Non-Error promise rejection captured",
    ],
    // Replay lives in init integrations (not lazy-loaded): @sentry/react is
    // statically imported above, so Replay is already in the main chunk — a
    // dynamic import would not code-split it. Initializing here also lets the
    // error-only buffer record from first paint.
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
        maskAllInputs: true,
      }),
    ],
  });
}
