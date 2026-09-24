import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CartProvider } from '../contexts';
import Privacy from './Privacy';
import FAQ from './FAQ';
import TravelInspiration from './TravelInspiration';
import Reviews from './Reviews';
import CustomItineraryDetail from './CustomItineraryDetail';
import BlogPostDetail from './BlogPostDetail';
import { fetchPostBySlug, fetchPreviewPost, fetchPublishedPosts } from '../lib/blog';

// Článek pro BlogPostDetail. `vi.hoisted` proto, že továrna `vi.mock` se vytahuje
// nad importy — obyčejná konstanta by v ní byla ještě neinicializovaná.
const BLOG_POST = vi.hoisted(() => ({
  id: 'b1',
  slug: 'testovaci-clanek',
  title: 'Testovací článek',
  excerpt: 'Perex testovacího článku.',
  content: '<p>Obsah testovacího článku.</p>',
  image_url: null,
  published_at: '2026-08-01T10:00:00.000Z',
  tag_ids: [],
  seo_title: null,
  seo_description: null,
}));

// vi.mock je hoistovaný Vitestem nad importy, takže pořadí zápisu v souboru nevadí.
vi.mock('../lib/blog', () => ({
  fetchPublishedPosts: vi.fn().mockResolvedValue([]),
  fetchTags: vi.fn().mockResolvedValue([]),
  tagNameMap: vi.fn().mockReturnValue(new Map()),
  fetchPostBySlug: vi.fn().mockResolvedValue(BLOG_POST),
  fetchPreviewPost: vi.fn().mockResolvedValue(BLOG_POST),
  fetchRelatedPosts: vi.fn().mockResolvedValue([]),
  fetchExistingProductSlugs: vi.fn().mockResolvedValue(new Set()),
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

  // BlogPostDetail marker nevydává přes `<Layout ready>` jako ostatní stránky, ale
  // atributem přímo na obalovém prvku článku. Build to dnes neprověří: routy
  // /inspirace/:slug vznikají z publikovaných článků a blog zatím žádný nemá,
  // takže prerender tuhle stránku nikdy nenavštíví. Bez těchhle dvou testů by
  // ztráta markeru vyplavala až prvním Janiným článkem — spadlým buildem.
  const renderBlogPost = (search = '') =>
    render(
      <CartProvider>
        <MemoryRouter initialEntries={[`/inspirace/${BLOG_POST.slug}${search}`]}>
          <Routes>
            <Route path="/inspirace/:slug" element={<BlogPostDetail />} />
          </Routes>
        </MemoryRouter>
      </CartProvider>,
    );

  it('BlogPostDetail vydá marker připravenosti až po načtení článku', async () => {
    const { container } = renderBlogPost();

    expect(container.querySelector('[data-prerender-ready="true"]')).toBeNull();
    await waitFor(() => {
      expect(container.querySelector('[data-prerender-ready="true"]')).not.toBeNull();
    });
    expect(container.querySelector('[data-loading="true"]')).toBeNull();
  });

  it('BlogPostDetail při chybě načtení marker nevydá', async () => {
    vi.mocked(fetchPostBySlug).mockRejectedValueOnce(new Error('supabase down'));
    const { container } = renderBlogPost();

    await waitFor(() => {
      expect(container.querySelector('[data-loading="true"]')).toBeNull();
    });
    expect(container.querySelector('[data-prerender-ready="true"]')).toBeNull();
    // Přechodná chyba: dosavadní chybové UI, vlastní titulek, ale BEZ noindex —
    // článek nejspíš existuje (I-2, N-F-1).
    expect(screen.getByRole('heading', { level: 1, name: 'Článek se nepodařilo načíst.' })).toBeInTheDocument();
    expect(document.title).toBe('Chyba načítání | Cesty bez mapy');
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
    expect(container.querySelector('[data-page="not-found"]')).toBeNull();
  });

  it('BlogPostDetail: neexistující/nepublikovaný článek vykreslí NotFound s noindex (I-2)', async () => {
    vi.mocked(fetchPostBySlug).mockResolvedValueOnce(null);
    const { container } = renderBlogPost();

    expect(await screen.findByRole('heading', { level: 1, name: 'Stránka nenalezena' })).toBeInTheDocument();
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
    expect(document.title).toBe('Stránka nenalezena | Cesty bez mapy');
    expect(container.querySelector('[data-page="not-found"]')).not.toBeNull();
    expect(container.querySelector('[data-prerender-ready="true"]')).toBeNull();
  });

  it('BlogPostDetail: náhled, kterému Edge funkce odpoví 500, ukáže chybu načtení, ne NotFound', async () => {
    // Skutečná `fetchPreviewPost` (ne mock modulu) nad `fetch`, který vrátí 500 — hlídá celé
    // spojení: lib vyhodí a stránka to vezme jako přechodnou chybu, bez noindexu.
    const actual = await vi.importActual<typeof import('../lib/blog')>('../lib/blog');
    vi.mocked(fetchPreviewPost).mockImplementationOnce(actual.fetchPreviewPost);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Server error' }), { status: 500 })),
    );
    try {
      const { container } = renderBlogPost('?preview=1&token=platny');

      expect(await screen.findByRole('heading', { level: 1, name: 'Článek se nepodařilo načíst.' })).toBeInTheDocument();
      expect(document.title).toBe('Chyba načítání | Cesty bez mapy');
      expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
      expect(container.querySelector('[data-page="not-found"]')).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('BlogPostDetail: náhled s neplatným tokenem vykreslí NotFound s noindex', async () => {
    vi.mocked(fetchPreviewPost).mockResolvedValueOnce(null);
    renderBlogPost('?preview=1&token=neplatny');

    expect(await screen.findByRole('heading', { level: 1, name: 'Stránka nenalezena' })).toBeInTheDocument();
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
    expect(vi.mocked(fetchPreviewPost)).toHaveBeenCalledWith(BLOG_POST.slug, 'neplatny');
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
