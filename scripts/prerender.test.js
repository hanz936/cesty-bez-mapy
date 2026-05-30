// @vitest-environment node
// Tento soubor testuje čisté helpery z prerender.mjs, který importuje `vite`
// (esbuild). esbuild má invariant `TextEncoder().encode() instanceof Uint8Array`,
// jenž v jsdom realmu selže → helpery testujeme v node prostředí.
import { describe, it, expect } from 'vitest';
import { collectRoutes, outputPathForRoute, validateHtml } from './prerender.mjs';

describe('collectRoutes', () => {
  it('složí statické routy + detail z publikovaných slugů, bez duplikátů', () => {
    const routes = collectRoutes([{ slug: 'a' }, { slug: 'b' }, { slug: 'a' }]);
    expect(routes).toContain('/');
    expect(routes).toContain('/inspirace');
    expect(routes).toContain('/inspirace/a');
    expect(routes).toContain('/inspirace/b');
    expect(routes.filter((r) => r === '/inspirace/a')).toHaveLength(1);
  });
  it('bez článků vrátí jen statické routy', () => {
    expect(collectRoutes([])).toEqual(['/', '/inspirace']);
  });
});

describe('outputPathForRoute', () => {
  it('mapuje routu na soubor index.html', () => {
    expect(outputPathForRoute('dist', '/')).toBe('dist/index.html');
    expect(outputPathForRoute('dist', '/inspirace')).toBe('dist/inspirace/index.html');
    expect(outputPathForRoute('dist', '/inspirace/lago')).toBe('dist/inspirace/lago/index.html');
  });
});

describe('validateHtml', () => {
  const brand = 'Cesty';
  it('projde u plného HTML s h1 a značkou', () => {
    const html = '<html><body><h1>Nadpis</h1>' + 'x'.repeat(2000) + ' Cesty</body></html>';
    expect(() => validateHtml(html, { minBytes: 1024, requireH1: true, brand })).not.toThrow();
  });
  it('selže u prázdného/loading shellu (krátké, bez h1)', () => {
    expect(() => validateHtml('<html><body>Načítám…</body></html>', { minBytes: 1024, requireH1: true, brand })).toThrow();
  });
  it('selže, když chybí značka', () => {
    const html = '<h1>x</h1>' + 'y'.repeat(2000);
    expect(() => validateHtml(html, { minBytes: 1024, requireH1: true, brand })).toThrow();
  });
});
