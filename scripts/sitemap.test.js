// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { buildSitemap, writeSitemap, xmlEscape } from './sitemap.mjs';

describe('xmlEscape', () => {
  it('escapuje & < > " \'', () => {
    expect(xmlEscape(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f');
  });
});

describe('buildSitemap', () => {
  it('vrátí validní urlset s absolutními loc bez duplikátů', () => {
    const xml = buildSitemap(['/', '/kontakt', '/kontakt'], 'https://x.cz');
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).toContain('<loc>https://x.cz/</loc>');
    expect(xml).toContain('<loc>https://x.cz/kontakt</loc>');
    expect(xml.match(/x\.cz\/kontakt/g)).toHaveLength(1);
  });
});

describe('writeSitemap — sitemapa z hotového dist/ (M-3)', () => {
  /** @type {string[]} */
  const dirs = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  /** @param {Record<string, string>} files relativní cesta → obsah */
  const makeDist = (files) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'sitemap-'));
    dirs.push(dir);
    for (const [rel, html] of Object.entries(files)) {
      const file = path.join(dir, rel);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, html);
    }
    return dir;
  };
  const INDEXABLE = '<html><head><title>Stránka</title></head><body></body></html>';
  const NOINDEX = '<html><head><title>Prázdné recenze</title><meta name="robots" content="noindex"/></head><body></body></html>';

  it('uvádí předgenerované stránky bez noindex, seřazené; noindex a skořápku vynechá', async () => {
    const dir = makeDist({
      'index.html': INDEXABLE,
      'kontakt/index.html': INDEXABLE,
      'cestovni-pruvodci/italie/index.html': INDEXABLE,
      'cestovni-pruvodci/italie/recenze/index.html': INDEXABLE,
      'cestovni-pruvodci/italie/recenze/strana/2/index.html': INDEXABLE,
      // produkt bez recenzí: stránka recenzí existuje, ale nese noindex
      'cestovni-pruvodci/rakousko/index.html': INDEXABLE,
      'cestovni-pruvodci/rakousko/recenze/index.html': NOINDEX,
      'app-shell.html': INDEXABLE,
    });

    const paths = await writeSitemap(dir, 'https://x.cz');

    expect(paths).toEqual([
      '/',
      '/cestovni-pruvodci/italie',
      '/cestovni-pruvodci/italie/recenze',
      '/cestovni-pruvodci/italie/recenze/strana/2',
      '/cestovni-pruvodci/rakousko',
      '/kontakt',
    ]);
    const xml = readFileSync(path.join(dir, 'sitemap.xml'), 'utf8');
    expect([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])).toEqual(paths.map((p) => `https://x.cz${p}`));
    expect(xml).not.toContain('rakousko/recenze');
    expect(xml).not.toContain('app-shell');
  });

  it('databázi nepotřebuje: projde i bez Supabase proměnných', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    try {
      const dir = makeDist({ 'index.html': INDEXABLE });
      await expect(writeSitemap(dir, 'https://x.cz')).resolves.toEqual(['/']);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('skript na databázi nesahá (žádný import contentSlugs)', () => {
    // Obě strany (prerender i sitemapa) dřív ptaly Supabase zvlášť, pár minut po sobě,
    // a verify-dist pak build shodil na jejich neshodě. Druhý dotaz se sem nesmí vrátit.
    const source = readFileSync('scripts/sitemap.mjs', 'utf8');
    const imports = source.match(/^import\b[^;]*;/gm) ?? [];
    expect(imports.length).toBeGreaterThan(0);
    expect(imports.filter((line) => /contentSlugs|supabase/i.test(line))).toEqual([]);
  });
});
