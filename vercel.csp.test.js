// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url)));
const csp = cfg.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;
const directive = (name) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(name + ' '));

describe('CSP allows Umami', () => {
  // The tracker SCRIPT loads from the stable host cloud.umami.is (script-src).
  it('script-src includes cloud.umami.is', () => {
    expect(directive('script-src')).toContain('https://cloud.umami.is');
  });
  // Umami Cloud sends events to a CHANGING set of data-ingest hosts (gateway.umami.is,
  // eu.umami.is, api-gateway[-eu].umami.dev — see umami-software/umami discussion #2719
  // and issue #4326). Wildcards on Umami's own domains keep analytics from silently
  // breaking when they rotate the gateway again.
  it('connect-src allows Umami ingest hosts via wildcards', () => {
    expect(directive('connect-src')).toContain('https://*.umami.is');
    expect(directive('connect-src')).toContain('https://*.umami.dev');
  });
});
