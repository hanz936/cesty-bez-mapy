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
    const m = buildProductMeta(product, 'https://x.cz');
    expect(m.title).toBe('Toskánsko: kompletní průvodce');
    expect(m.description).toBe('Vše, co potřebuješ pro cestu do Toskánska.');
    expect(m.canonical).toBe('https://x.cz/cestovni-pruvodci/toskansko');
    expect(m.ogImage).toBe('https://cdn.example/tos.jpg');
  });
  it('JSON-LD je validní Product s Offer (celé CZK, CZK měna)', () => {
    const m = buildProductMeta(product, 'https://x.cz');
    expect(m.jsonLd['@type']).toBe('Product');
    expect(m.jsonLd.name).toBe('Toskánsko průvodce');
    expect(m.jsonLd.image).toEqual(['https://cdn.example/tos.jpg']);
    expect(m.jsonLd.offers.price).toBe('349');
    expect(m.jsonLd.offers.priceCurrency).toBe('CZK');
    expect(m.jsonLd.offers.availability).toBe('https://schema.org/InStock');
    expect(m.jsonLd.offers.url).toBe('https://x.cz/cestovni-pruvodci/toskansko');
  });
  it('fallback obrázku, když image_url chybí', () => {
    const m = buildProductMeta({ ...product, image_url: null }, 'https://x.cz');
    expect(m.ogImage).toBe('https://x.cz/images/placeholder-guide.jpg');
  });
});
