// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it, expect } from 'vitest';
import { indexablePages, indexFiles, isNoindex, routeForFile } from './distPages.mjs';

describe('routeForFile', () => {
  it('mapuje soubor zpátky na routu (opak outputPathForRoute)', () => {
    expect(routeForFile('index.html')).toBe('/');
    expect(routeForFile('kontakt/index.html')).toBe('/kontakt');
    expect(routeForFile('cestovni-pruvodci/italie/recenze/index.html')).toBe('/cestovni-pruvodci/italie/recenze');
  });
});

describe('isNoindex', () => {
  it('pozná robots meta s noindex', () => {
    expect(isNoindex('<meta name="robots" content="noindex"/>')).toBe(true);
    expect(isNoindex('<meta name="robots" content="index,follow"/>')).toBe(false);
    expect(isNoindex('<html><head></head></html>')).toBe(false);
  });
});

describe('čtení vzorového dist/', () => {
  /** @type {string[]} */
  const dirs = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  /** @param {Record<string, string>} files relativní cesta → obsah */
  const makeDir = (files) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dist-pages-'));
    dirs.push(dir);
    for (const [rel, html] of Object.entries(files)) {
      const file = path.join(dir, rel);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, html);
    }
    return dir;
  };
  const INDEXABLE = '<html><head><title>Stránka</title></head><body></body></html>';
  const NOINDEX = '<html><head><title>Stránka</title><meta name="robots" content="noindex"/></head><body></body></html>';

  it('najde všechny index.html do hloubky; skořápka ani jiné soubory mezi ně nepatří', async () => {
    const dir = makeDir({
      'index.html': INDEXABLE,
      'app-shell.html': INDEXABLE,
      'sitemap.xml': '<urlset></urlset>',
      'assets/app.js': '',
      'kontakt/index.html': INDEXABLE,
      'cestovni-pruvodci/italie/recenze/strana/2/index.html': INDEXABLE,
    });

    expect((await indexFiles(dir)).sort()).toEqual([
      'cestovni-pruvodci/italie/recenze/strana/2/index.html',
      'index.html',
      'kontakt/index.html',
    ]);
  });

  it('indexovatelné stránky: bez noindex, seřazené bez ohledu na pořadí na disku', async () => {
    const dir = makeDir({
      'zeta/index.html': INDEXABLE,
      'index.html': INDEXABLE,
      'cestovni-pruvodci/italie/index.html': INDEXABLE,
      'cestovni-pruvodci/italie/recenze/index.html': INDEXABLE,
      'cestovni-pruvodci/rakousko/recenze/index.html': NOINDEX,
      'app-shell.html': INDEXABLE,
    });

    expect(await indexablePages(dir)).toEqual([
      '/',
      '/cestovni-pruvodci/italie',
      '/cestovni-pruvodci/italie/recenze',
      '/zeta',
    ]);
  });

  it('chybějící dist/ je chyba, ne prázdný výsledek', async () => {
    await expect(indexablePages(path.join(tmpdir(), 'neexistuje-dist-pages-xyz'))).rejects.toThrow(/ENOENT/);
  });
});
