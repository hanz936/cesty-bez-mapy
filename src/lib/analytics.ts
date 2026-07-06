// Thin wrapper around the Umami tracker (loaded via index.html in production).
// Safe to call anywhere: no-ops if the tracker is absent (dev, prerender, adblock)
// and never throws — analytics must not break the app.

// window.umami has no official types (loaded via <script> in index.html, not an
// npm package) — ambient augmentation reflects the subset of the API this file uses.
declare global {
  interface Window {
    umami?: {
      track: (name: string, data?: Record<string, unknown>) => void
    }
  }
}

export const ANALYTICS_EVENTS = {
  ADD_TO_CART: 'add-to-cart',
  BEGIN_CHECKOUT: 'begin-checkout',
  PURCHASE: 'purchase',
  ITINERARY_START: 'itinerary-start',
  ITINERARY_SUBMIT: 'itinerary-submit',
  NEWSLETTER_SIGNUP: 'newsletter-signup',
  CONTACT_SUBMIT: 'contact-submit',
};

export function trackEvent(name: string, data?: Record<string, unknown>): void {
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
