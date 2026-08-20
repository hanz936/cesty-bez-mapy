// @vitest-environment node
// Tento soubor testuje čisté helpery z prerender.mjs, který importuje `vite`
// (esbuild). esbuild má invariant `TextEncoder().encode() instanceof Uint8Array`,
// jenž v jsdom realmu selže → helpery testujeme v node prostředí.
import { describe, it, expect, vi } from 'vitest';
import { collectRoutes, outputPathForRoute, validateHtml } from './prerender.mjs';
import { MAX_PRERENDERED_REVIEW_PAGES } from '../src/constants/reviews.ts';

describe('collectRoutes', () => {
  it('složí veřejné statické routy + blog + produkty bez duplikátů', () => {
    const routes = collectRoutes([{ slug: 'a' }, { slug: 'a' }], [{ slug: 'tos', review_count: 0 }]);
    expect(routes).toContain('/');
    expect(routes).toContain('/kontakt');
    expect(routes).toContain('/inspirace/a');
    expect(routes).toContain('/cestovni-pruvodci/tos');
    expect(routes.filter((r) => r === '/inspirace/a')).toHaveLength(1);
  });
  it('bez obsahu vrátí jen statické veřejné routy (z PUBLIC_PAGES)', () => {
    const routes = collectRoutes([], []);
    expect(routes).toContain('/');
    expect(routes).toContain('/ochrana-osobnich-udaju');
    expect(routes).not.toContain('/cestovni-pruvodci/itinerar-na-miru/dotaznik');
  });
  it('přidá routu recenzí i produktu bez recenzí (kvůli canonicalu a noindex ve zdroji)', () => {
    const routes = collectRoutes([], [{ slug: 'tos', review_count: 0 }]);
    expect(routes).toContain('/cestovni-pruvodci/tos/recenze');
    expect(routes).not.toContain('/cestovni-pruvodci/tos/recenze/strana/2');
  });
  it('přidá další strany podle review_count (10 na stranu)', () => {
    const routes = collectRoutes([], [{ slug: 'italie', review_count: 25 }]);
    expect(routes).toContain('/cestovni-pruvodci/italie/recenze');
    expect(routes).toContain('/cestovni-pruvodci/italie/recenze/strana/2');
    expect(routes).toContain('/cestovni-pruvodci/italie/recenze/strana/3');
    expect(routes).not.toContain('/cestovni-pruvodci/italie/recenze/strana/4');
  });
  it('přesně 10 recenzí = jedna strana, žádné /strana/2', () => {
    const routes = collectRoutes([], [{ slug: 'x', review_count: 10 }]);
    expect(routes).toContain('/cestovni-pruvodci/x/recenze');
    expect(routes).not.toContain('/cestovni-pruvodci/x/recenze/strana/2');
  });
  it('chybějící review_count bere jako nulu', () => {
    const routes = collectRoutes([], [{ slug: 'x' }]);
    expect(routes).toContain('/cestovni-pruvodci/x/recenze');
    expect(routes).not.toContain('/cestovni-pruvodci/x/recenze/strana/2');
  });
  it('počet prerenderovaných stran má strop', () => {
    // 500 recenzí = 50 stran; předgenerujeme jen prvních MAX_PRERENDERED_REVIEW_PAGES.
    const routes = collectRoutes([], [{ slug: 'velky', review_count: 500 }]);
    expect(routes).toContain(`/cestovni-pruvodci/velky/recenze/strana/${MAX_PRERENDERED_REVIEW_PAGES}`);
    expect(routes).not.toContain(`/cestovni-pruvodci/velky/recenze/strana/${MAX_PRERENDERED_REVIEW_PAGES + 1}`);
  });
  it('nad stropem varuje do konzole a jmenuje produkt', () => {
    // Bez tohohle testu by smazání celého console.warn bloku nezčervenalo nic —
    // je to jediný signál, že strop byl překročen a odkazy vedou na nepredgenerované strany.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      collectRoutes([], [{ slug: 'velky', review_count: 500 }]);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('velky');
      expect(warn.mock.calls[0][0]).toContain('MAX_PRERENDERED_REVIEW_PAGES');
    } finally {
      warn.mockRestore();
    }
  });
  it('pod stropem nevaruje', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      collectRoutes([], [{ slug: 'italie', review_count: 25 }]);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
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
  it('selže u zachyceného loading stavu, i když má h1, značku i dost bajtů', () => {
    // Regrese P3-A: /recenze se předgenerovala jako skeleton — délka, <h1> i značka
    // seděly, protože stránka ohlásila připravenost natvrdo. Rozhoduje `data-loading`.
    const html =
      '<html><body><h1>Recenze</h1><p data-loading="true">Načítám recenze…</p>' +
      'x'.repeat(2000) +
      ' Cesty</body></html>';
    expect(() => validateHtml(html, { minBytes: 1024, requireH1: true, brand })).toThrow(/data-loading/);
  });
  it('nezamění atribut za podobně pojmenovanou třídu nebo text', () => {
    const html =
      '<html><body><h1>Recenze</h1><p class="data-loading-hint">Načítám…</p>' +
      'x'.repeat(2000) +
      ' Cesty</body></html>';
    expect(() => validateHtml(html, { minBytes: 1024, requireH1: true, brand })).not.toThrow();
  });
});
