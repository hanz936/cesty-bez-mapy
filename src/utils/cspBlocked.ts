// Registers once at module load. The `securitypolicyviolation` event fires on
// the document that initiated the request; we need it because fetch() rejects
// with an opaque TypeError on CSP block, so this is the only authoritative
// signal that a fetch was killed by CSP (not DNS, CORS, mixed-content, etc.).

const cspBlockedUrls = new Set<string>();
let registered = false;

function register(): void {
  if (registered || typeof document === 'undefined') return;
  registered = true;
  document.addEventListener('securitypolicyviolation', (e) => {
    if (e.blockedURI) cspBlockedUrls.add(e.blockedURI);
    if (import.meta.env.DEV) {
      console.warn('[CSP block]', e.effectiveDirective, '→', e.blockedURI);
    }
  });
}

register();

export function wasBlockedByCsp(url: string): boolean {
  // CSP reports `blockedURI` as the absolute URL; callers must pass an
  // already-resolved URL string (use new URL(rel, location.href).href).
  return cspBlockedUrls.has(url);
}
