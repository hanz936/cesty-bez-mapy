// @vitest-environment node
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
