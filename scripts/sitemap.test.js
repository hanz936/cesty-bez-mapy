// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildSitemap, xmlEscape } from './sitemap.mjs';

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
