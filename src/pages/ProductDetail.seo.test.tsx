import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from '../contexts';

// vi.mock je hoistovaný Vitestem nad importy, takže pořadí zápisu v souboru nevadí.
// Chainovatelný mock query builderu mirroruje řetězec použitý v ProductDetail:
// supabase.from('products').select(...).eq('slug', slug).eq('is_active', true).eq('is_deleted', false).single()
function makeBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

const fromMock = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('../lib/supabase', () => ({ supabase: { from: (...a: unknown[]) => fromMock(...a) } }));

// fetchApprovedReviews mock — umožňuje simulovat výpadek recenzí nezávisle na product fetchi.
// (fetchReviewStats jen doplňuje tvar modulu pro ostatní importéry; na této stránce se nevolá.)
const fetchApprovedReviewsMock = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('../lib/reviews', () => ({
  fetchApprovedReviews: (...args: unknown[]) => fetchApprovedReviewsMock(...args),
  fetchReviewStats: vi.fn(),
}));

import ProductDetail from './ProductDetail';

const fixtureProduct = {
  id: 'prod-1',
  title: 'Itinerář Toskánsko',
  description: 'Detailní popis',
  price: 490,
  slug: 'toskansko',
  image_url: 'https://example.com/toskansko.jpg',
  detail_title: 'Toskánsko na 7 dní',
  hero_subtitle: 'Kompletní itinerář pro samostatné cestování',
  hero_line_1: null,
  hero_line_2: null,
  hero_line_3: null,
  hero_line_4: null,
  budget_level: 2,
  spring_description: null,
  summer_description: 'Ideální období',
  autumn_description: null,
  winter_description: null,
  gallery_images: null,
  average_rating: 0,
  review_count: 0,
};

const renderProductDetail = (slug = 'toskansko') =>
  render(
    <CartProvider>
      <MemoryRouter initialEntries={[`/cestovni-pruvodci/${slug}`]}>
        <Routes>
          <Route path="/cestovni-pruvodci/:slug" element={<ProductDetail />} />
        </Routes>
      </MemoryRouter>
    </CartProvider>,
  );

describe('ProductDetail per-route SEO + Product JSON-LD + marker (SEO-03)', () => {
  beforeEach(() => {
    fromMock.mockReset();
    fetchApprovedReviewsMock.mockReset();
  });

  it('po načtení produktu vykreslí prerender marker a Product JSON-LD v CZK', async () => {
    const builder = makeBuilder({ data: fixtureProduct, error: null });
    fromMock.mockReturnValue(builder);

    const { container } = renderProductDetail();

    await waitFor(() => {
      expect(container.querySelector('[data-prerender-ready="true"]')).not.toBeNull();
    });

    expect(fromMock).toHaveBeenCalledWith('products');
    expect(builder.eq).toHaveBeenCalledWith('slug', 'toskansko');
    expect(builder.eq).toHaveBeenCalledWith('is_active', true);
    expect(builder.eq).toHaveBeenCalledWith('is_deleted', false);
    expect(builder.single).toHaveBeenCalled();

    await waitFor(() => {
      expect(container.querySelector('script[type="application/ld+json"]')).not.toBeNull();
    });
    const script = container.querySelector('script[type="application/ld+json"]');
    const jsonLd = JSON.parse(script!.textContent) as { '@type': string; offers: { priceCurrency: string; price: string } };
    expect(jsonLd['@type']).toBe('Product');
    expect(jsonLd.offers.priceCurrency).toBe('CZK');
    expect(jsonLd.offers.price).toBe('490');

    expect(document.head.querySelector('title')).toHaveTextContent('Toskánsko na 7 dní');
  });

  it('při chybě/nenalezení produktu marker NEvykreslí (žádné prerendrování 404)', async () => {
    const builder = makeBuilder({ data: null, error: { code: 'PGRST116' } });
    fromMock.mockReturnValue(builder);

    const { container } = renderProductDetail('neexistujici');

    await waitFor(() => {
      expect(container.querySelector('h1')).toHaveTextContent('Produkt nebyl nalezen');
    });

    expect(container.querySelector('[data-prerender-ready="true"]')).toBeNull();
    // Footer vykresluje vlastní Organization JSON-LD vždy (SEO-08) — ověřujeme jen,
    // že žádný script neobsahuje Product JSON-LD (to renderuje SeoTags jen pro načtený produkt).
    const scripts = [...container.querySelectorAll('script[type="application/ld+json"]')];
    const hasProductJsonLd = scripts.some((s) => (JSON.parse(s.textContent) as { '@type': string })['@type'] === 'Product');
    expect(hasProductJsonLd).toBe(false);
  });

  it('výpadek recenzí neshodí stránku — produkt se vykreslí a JSON-LD nese aggregateRating bez review', async () => {
    const builder = makeBuilder({ data: { ...fixtureProduct, average_rating: 4.5, review_count: 2 }, error: null });
    fromMock.mockReturnValue(builder);
    fetchApprovedReviewsMock.mockRejectedValue(new Error('reviews down'));

    const { container } = renderProductDetail();

    await waitFor(() => {
      expect(container.querySelector('[data-prerender-ready="true"]')).not.toBeNull();
    });

    // Stránka NENÍ v error stavu — h1 je titulek produktu, ne „Nepodařilo se načíst produkt"
    expect(container.querySelector('h1')).toHaveTextContent('Toskánsko na 7 dní');

    const scripts = [...container.querySelectorAll('script[type="application/ld+json"]')];
    const productJsonLd = scripts
      .map((s) => JSON.parse(s.textContent) as Record<string, unknown>)
      .find((j) => j['@type'] === 'Product');
    expect(productJsonLd).toBeDefined();
    expect(productJsonLd?.aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: '4.5',
      reviewCount: 2,
    });
    // review pole chybí — seoReviews zůstalo prázdné a buildProductMeta prázdné pole nepřidává
    expect(productJsonLd).not.toHaveProperty('review');
  });
});
