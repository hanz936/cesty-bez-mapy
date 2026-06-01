// Sentry browser init. MUST be imported first in main.jsx (before any app code).
import * as Sentry from "@sentry/react";

// Pure, testable PII scrubber used by beforeSend. Deliberately narrow: it only
// strips user.email / user.ip_address. Request headers and cookies are NOT the
// scrubber's job — `sendDefaultPii: false` (below) already prevents the SDK from
// attaching them. If code later calls Sentry.setExtra/setContext/setUser with PII,
// extend this function accordingly.
export function scrubPii(event) {
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
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
  });

  // Lazy-load Replay so it doesn't block first paint. Replay is NOT in init integrations.
  import("@sentry/react").then((LazySentry) => {
    Sentry.addIntegration(
      LazySentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
        maskAllInputs: true,
      }),
    );
  });
}
