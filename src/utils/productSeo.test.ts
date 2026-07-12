import { describe, it, expect } from 'vitest';
import { buildProductMeta } from './productSeo';

const product = {
  title: 'Toskánsko průvodce',
  detail_title: 'Toskánsko: kompletní průvodce',
  hero_subtitle: 'Vše, co potřebuješ pro cestu do Toskánska.',
  slug: 'toskansko',
  price: 349,
  image_url: 'https://cdn.example/tos.jpg',
};

describe('buildProductMeta', () => {
  it('skládá title/description/canonical/ogImage', () => {
    const m = buildProductMeta(product, undefined, 'https://x.cz');
    expect(m.title).toBe('Toskánsko: kompletní průvodce');
    expect(m.description).toBe('Vše, co potřebuješ pro cestu do Toskánska.');
    expect(m.canonical).toBe('https://x.cz/cestovni-pruvodci/toskansko');
    expect(m.ogImage).toBe('https://cdn.example/tos.jpg');
  });
  it('JSON-LD je validní Product s Offer (celé CZK, CZK měna)', () => {
    const m = buildProductMeta(product, undefined, 'https://x.cz');
    expect(m.jsonLd['@type']).toBe('Product');
    expect(m.jsonLd.name).toBe('Toskánsko průvodce');
    expect(m.jsonLd.image).toEqual(['https://cdn.example/tos.jpg']);
    expect(m.jsonLd.offers.price).toBe('349');
    expect(m.jsonLd.offers.priceCurrency).toBe('CZK');
    expect(m.jsonLd.offers.availability).toBe('https://schema.org/InStock');
    expect(m.jsonLd.offers.url).toBe('https://x.cz/cestovni-pruvodci/toskansko');
  });
  it('fallback obrázku, když image_url chybí', () => {
    const m = buildProductMeta({ ...product, image_url: null }, undefined, 'https://x.cz');
    expect(m.ogImage).toBe('https://x.cz/images/placeholder-guide.jpg');
  });
});

const PRODUCT = {
  detail_title: 'Salzburg na víkend',
  title: 'Salzburg',
  hero_subtitle: 'Víkendový itinerář',
  slug: 'salzburg-vikend',
  image_url: null,
  price: 499,
};

describe('buildProductMeta aggregateRating', () => {
  it('bez recenzí JSON-LD neobsahuje aggregateRating ani review', () => {
    const meta = buildProductMeta(PRODUCT);
    expect('aggregateRating' in meta.jsonLd).toBe(false);
    expect('review' in meta.jsonLd).toBe(false);
  });

  it('s recenzemi přidá aggregateRating + review', () => {
    const meta = buildProductMeta(PRODUCT, {
      rating: { average: 4.5, count: 2 },
      reviews: [
        { author: 'Jana N.', rating: 5, text: 'Skvělý průvodce.', datePublished: '2026-07-01' },
        { author: 'Petr K.', rating: 4, text: 'Moc pomohl s plánem.', datePublished: '2026-06-15' },
      ],
    });
    expect(meta.jsonLd.aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: '4.5',
      reviewCount: 2,
    });
    expect(meta.jsonLd.review).toHaveLength(2);
    expect(meta.jsonLd.review?.[0]).toEqual({
      '@type': 'Review',
      author: { '@type': 'Person', name: 'Jana N.' },
      reviewRating: { '@type': 'Rating', ratingValue: '5' },
      reviewBody: 'Skvělý průvodce.',
      datePublished: '2026-07-01',
    });
  });

  it('rating.count === 0 markup nepřidá', () => {
    const meta = buildProductMeta(PRODUCT, { rating: { average: 0, count: 0 }, reviews: [] });
    expect('aggregateRating' in meta.jsonLd).toBe(false);
  });
});
