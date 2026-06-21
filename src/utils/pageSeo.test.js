import { describe, it, expect } from 'vitest';
import { buildPageMeta } from './pageSeo';

describe('buildPageMeta', () => {
  it('skládá meta pro známou routu', () => {
    const m = buildPageMeta('/kontakt', 'https://x.cz');
    expect(m.title).toBe('Kontakt');
    expect(m.canonical).toBe('https://x.cz/kontakt');
    expect(m.ogImage).toBe('https://x.cz/images/logo.png');
    expect(m.description.length).toBeGreaterThan(0);
  });
  it('vyhodí u neznámé routy', () => {
    expect(() => buildPageMeta('/neexistuje', 'https://x.cz')).toThrow();
  });
});
