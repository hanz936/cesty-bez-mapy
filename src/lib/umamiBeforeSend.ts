// Umami `data-before-send` handler. Pure and dependency-free: the Vite build
// inlines this into index.html via Function.prototype.toString(), so it MUST NOT
// import anything or reference outer scope.
// Contract (Umami v2.18+): (type, payload) => payload (to send) | false (to cancel).

// Umami has no published types for the before-send payload; this reflects the
// subset of the shape this module reads/mutates (`url`), plus arbitrary extra
// fields that are passed through untouched.
interface UmamiPayload {
  url?: string;
  [key: string]: unknown;
}

export function sanitizeUmamiPayload(
  _type: string,
  payload: UmamiPayload | null | undefined
): UmamiPayload | null | undefined {
  if (payload && typeof payload.url === 'string' && payload.url.includes('?')) {
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
