import { describe, it, expect } from 'vitest';
import { buildBlogMeta } from './blogSeo';

const post = {
  title: 'Lago di Garda mimo sezónu',
  slug: 'lago-di-garda-mimo-sezonu',
  excerpt: 'Ticho a světlo.',
  image_url: 'https://cdn.example/lago.jpg',
  seo_title: '',
  seo_description: '',
  published_at: '2026-05-30T10:00:00Z',
  updated_at: '2026-05-30T12:00:00Z',
};

describe('buildBlogMeta', () => {
  it('skládá title/description s fallbacky', () => {
    const m = buildBlogMeta(post, 'https://cestybezmapy.cz');
    expect(m.title).toBe('Lago di Garda mimo sezónu'); // fallback z title
    expect(m.description).toBe('Ticho a světlo.'); // fallback z excerpt
    expect(m.canonical).toBe('https://cestybezmapy.cz/inspirace/lago-di-garda-mimo-sezonu');
    expect(m.ogImage).toBe('https://cdn.example/lago.jpg');
  });

  it('preferuje seo_title/seo_description, jsou-li vyplněné', () => {
    const m = buildBlogMeta({ ...post, seo_title: 'SEO T', seo_description: 'SEO D' }, 'https://x');
    expect(m.title).toBe('SEO T');
    expect(m.description).toBe('SEO D');
  });

  it('JSON-LD je validní Article s datem', () => {
    const m = buildBlogMeta(post, 'https://cestybezmapy.cz');
    expect(m.jsonLd['@type']).toBe('Article');
    expect(m.jsonLd.headline).toBe('Lago di Garda mimo sezónu');
    expect(m.jsonLd.datePublished).toBe('2026-05-30T10:00:00Z');
    expect(m.jsonLd.mainEntityOfPage).toContain('/inspirace/lago-di-garda-mimo-sezonu');
  });
});
