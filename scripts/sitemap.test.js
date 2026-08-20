// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildSitemap, xmlEscape, collectSitemapPaths } from './sitemap.mjs';
import { MAX_PRERENDERED_REVIEW_PAGES } from '../src/constants/reviews.ts';

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

describe('collectSitemapPaths', () => {
  it('obsahuje produkty i jejich routy recenzí včetně dalších stran', () => {
    const paths = collectSitemapPaths([], [{ slug: 'italie', review_count: 25 }]);
    expect(paths).toContain('/cestovni-pruvodci/italie');
    expect(paths).toContain('/cestovni-pruvodci/italie/recenze');
    expect(paths).toContain('/cestovni-pruvodci/italie/recenze/strana/3');
  });
  it('produkt bez recenzí do sitemapy stránku recenzí nedává (nese noindex)', () => {
    const paths = collectSitemapPaths([], [{ slug: 'x', review_count: 0 }]);
    expect(paths).toContain('/cestovni-pruvodci/x');
    expect(paths).not.toContain('/cestovni-pruvodci/x/recenze');
  });
  it('neslibuje strany nad stropem prerenderu', () => {
    const paths = collectSitemapPaths([], [{ slug: 'velky', review_count: 500 }]);
    expect(paths).not.toContain(`/cestovni-pruvodci/velky/recenze/strana/${MAX_PRERENDERED_REVIEW_PAGES + 1}`);
  });
});
