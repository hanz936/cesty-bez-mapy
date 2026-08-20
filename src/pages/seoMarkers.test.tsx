import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { CartProvider } from '../contexts';
import Privacy from './Privacy';
import FAQ from './FAQ';
import TravelInspiration from './TravelInspiration';
import Reviews from './Reviews';
import CustomItineraryDetail from './CustomItineraryDetail';
import { fetchPublishedPosts } from '../lib/blog';

// vi.mock je hoistovaný Vitestem nad importy, takže pořadí zápisu v souboru nevadí.
vi.mock('../lib/blog', () => ({
  fetchPublishedPosts: vi.fn().mockResolvedValue([]),
  fetchTags: vi.fn().mockResolvedValue([]),
  tagNameMap: vi.fn().mockReturnValue(new Map()),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { id: 'p1', average_rating: 0, review_count: 0 },
                error: null,
              }),
            }),
          }),
        }),
      }),
    }),
  },
}));

vi.mock('../lib/reviews', () => ({
  fetchApprovedReviews: vi.fn().mockResolvedValue({ reviews: [], total: 0 }),
  fetchReviewStats: vi.fn().mockResolvedValue({ count: 0, average: 0 }),
}));

const renderWithProviders = (children: ReactNode) =>
  render(
    <CartProvider>
      <MemoryRouter>{children}</MemoryRouter>
    </CartProvider>,
  );

describe('static page prerender marker + SEO (SEO-02/05/06)', () => {
  it('Privacy vykreslí marker připravenosti a titulek', () => {
    const { container } = renderWithProviders(<Privacy />);
    expect(container.querySelector('[data-prerender-ready="true"]')).not.toBeNull();
    expect(document.head.querySelector('title')).toHaveTextContent(/ochrana osobních údajů/i);
  });

  it('FAQ vykreslí marker připravenosti a titulek', () => {
    const { container } = renderWithProviders(<FAQ />);
    expect(container.querySelector('[data-prerender-ready="true"]')).not.toBeNull();
    expect(document.head.querySelector('title')).toHaveTextContent(/časté dotazy/i);
  });

  it('TravelInspiration (async) vykreslí marker připravenosti až po doběhnutí loadingu', async () => {
    const { container } = renderWithProviders(<TravelInspiration />);

    // Během loadingu marker není přítomný (Layout ready={false}).
    expect(container.querySelector('[data-prerender-ready="true"]')).toBeNull();

    await waitFor(() => {
      expect(container.querySelector('[data-prerender-ready="true"]')).not.toBeNull();
    });
    expect(document.head.querySelector('title')).toHaveTextContent(/inspirace na cesty/i);
  });

  it('Reviews vydá marker až po doběhnutí vnořené sekce recenzí (regrese P3-A)', async () => {
    // /recenze se předgenerovala jako prázdný skeleton, protože `<Layout ready>` bylo
    // natvrdo, zatímco data načítá až ReviewsSection. Marker teď drží ona.
    const { container } = renderWithProviders(<Reviews />);
    expect(container.querySelector('[data-prerender-ready="true"]')).toBeNull();
    await waitFor(() => {
      expect(container.querySelector('[data-prerender-ready="true"]')).not.toBeNull();
    });
    // A jakmile je marker venku, nesmí v HTML zůstat žádný loading stav.
    expect(container.querySelector('[data-loading="true"]')).toBeNull();
  });

  it('TravelInspiration při chybě načtení marker nevydá (regrese P3-B)', async () => {
    vi.mocked(fetchPublishedPosts).mockRejectedValueOnce(new Error('supabase down'));
    const { container } = renderWithProviders(<TravelInspiration />);
    await waitFor(() => {
      expect(container.querySelector('[data-loading="true"]')).toBeNull();
    });
    // Chybová stránka se nesmí předgenerovat jako platná — build má spadnout hlasitě.
    expect(container.querySelector('[data-prerender-ready="true"]')).toBeNull();
  });

  it('CustomItineraryDetail vydá marker až po doběhnutí recenzí', async () => {
    // Stránka měla `<Layout ready>` natvrdo, a protože ProductReviews při loadingu
    // vrací null, předgenerovala se úplně BEZ sekce recenzí — ne skeleton, rovnou díra.
    const { container } = renderWithProviders(<CustomItineraryDetail />);
    expect(container.querySelector('[data-prerender-ready="true"]')).toBeNull();
    await waitFor(() => {
      expect(container.querySelector('[data-prerender-ready="true"]')).not.toBeNull();
    });
  });
});
