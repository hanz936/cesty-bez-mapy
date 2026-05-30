import { describe, it, expect } from 'vitest';
import {
  sanitizeBlogHtml,
  extractYoutubeId,
  readingTimeMinutes,
  extractProductSlugs,
} from './blogContent';

const STORAGE = 'https://demo.supabase.co/storage/v1/object/public/';

describe('sanitizeBlogHtml', () => {
  it('zahodí <script> a onerror', () => {
    const dirty = '<p>ok</p><script>alert(1)</script><img src="x" onerror="alert(2)">';
    const clean = sanitizeBlogHtml(dirty, STORAGE);
    expect(clean).toContain('<p>ok</p>');
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('onerror');
  });

  it('zahodí cizí <iframe>', () => {
    const clean = sanitizeBlogHtml('<iframe src="https://evil.tld"></iframe>', STORAGE);
    expect(clean).not.toContain('<iframe');
  });

  it('ponechá povolené bloky + data-atributy + class', () => {
    const dirty =
      '<aside class="blog-callout"><p>tip</p></aside>' +
      '<div data-youtube-id="dQw4w9WgXcQ"></div>' +
      '<a data-product-slug="salzburg-vikend" class="blog-cta">Průvodce</a>';
    const clean = sanitizeBlogHtml(dirty, STORAGE);
    expect(clean).toContain('class="blog-callout"');
    expect(clean).toContain('data-youtube-id="dQw4w9WgXcQ"');
    expect(clean).toContain('data-product-slug="salzburg-vikend"');
  });

  it('ponechá <img> jen z úložiště, cizí zahodí', () => {
    const ok = `<img src="${STORAGE}blog-images/a.jpg" alt="a">`;
    const bad = '<img src="https://evil.tld/x.jpg" alt="b">';
    expect(sanitizeBlogHtml(ok, STORAGE)).toContain(STORAGE);
    expect(sanitizeBlogHtml(bad, STORAGE)).not.toContain('evil.tld');
  });
});

describe('extractYoutubeId', () => {
  it('vrátí ID z plné URL', () => {
    expect(extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('vrátí ID, když je vstup už ID', () => {
    expect(extractYoutubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('vrátí null pro nesmysl', () => {
    expect(extractYoutubeId('https://evil.tld/x')).toBeNull();
    expect(extractYoutubeId('"><script>')).toBeNull();
  });
});

describe('readingTimeMinutes', () => {
  it('počítá z holého textu (~200 slov/min), min 1', () => {
    expect(readingTimeMinutes('<p>krátký text</p>')).toBe(1);
    const long = '<p>' + 'slovo '.repeat(450) + '</p>';
    expect(readingTimeMinutes(long)).toBe(3);
  });
});

describe('extractProductSlugs', () => {
  it('vytáhne unikátní slugy z data-product-slug', () => {
    const html =
      '<a data-product-slug="a">x</a><a data-product-slug="b">y</a><a data-product-slug="a">z</a>';
    expect(extractProductSlugs(html).sort()).toEqual(['a', 'b']);
  });
  it('prázdné pole, když žádné CTA', () => {
    expect(extractProductSlugs('<p>nic</p>')).toEqual([]);
  });
});
