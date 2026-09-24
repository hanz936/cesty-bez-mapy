import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { CartProvider } from '../contexts';
import { PRODUCT_REVIEWS_LIMIT } from '../constants/reviews';

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
const captureExceptionMock = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('@sentry/react', () => ({ captureException: (...args: unknown[]) => captureExceptionMock(...args) }));

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
    captureExceptionMock.mockReset();
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

  it('vedle Product vydá i BreadcrumbList, jehož poslední položka sedí na <h1> (audit M-2)', async () => {
    const builder = makeBuilder({ data: fixtureProduct, error: null });
    fromMock.mockReturnValue(builder);

    const { container } = renderProductDetail();
    await waitFor(() => {
      expect(container.querySelector('[data-prerender-ready="true"]')).not.toBeNull();
    });

    // Blok si hledáme podle typu, ne podle pořadí: stránka jich nese víc
    // (Product ze `SeoTags`, Organization z patičky) a index by se posunul
    // s každým dalším.
    const nodes = [...container.querySelectorAll('script[type="application/ld+json"]')].map(
      (s) => JSON.parse(s.textContent) as { '@type': string },
    );
    expect(nodes.map((n) => n['@type'])).toContain('BreadcrumbList');
    const breadcrumb = nodes.find((n) => n['@type'] === 'BreadcrumbList') as unknown as {
      '@type': string;
      itemListElement: { position: number; name: string; item?: string }[];
    };
    // Obě položky musí být na stránce vidět, jinak by je markup nesměl nést:
    // „Cestovní průvodci" je tlačítko v hlavičce a druhá položka je nadpis stránky.
    expect(screen.getByRole('button', { name: /cestovní průvodci/i })).toBeInTheDocument();
    expect(breadcrumb.itemListElement[0].name).toBe('Cestovní průvodci');
    expect(breadcrumb.itemListElement[1].name).toBe('Toskánsko na 7 dní');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Toskánsko na 7 dní');
    // Poslední položka bez `item` = Google dosadí adresu samotné stránky.
    expect(breadcrumb.itemListElement[1]).not.toHaveProperty('item');
  });

  it('nenalezený produkt (PGRST116) vykreslí NotFound s noindex a bez markeru (I-2)', async () => {
    const builder = makeBuilder({ data: null, error: { code: 'PGRST116' } });
    fromMock.mockReturnValue(builder);

    const { container } = renderProductDetail('neexistujici');

    // Deaktivovaný nebo smazaný produkt: jeho dřív indexovaná adresa musí dostat
    // noindex, jinak z ní Google (a Seznam, který zná jen meta robots) udělá soft 404.
    expect(await screen.findByRole('heading', { level: 1, name: 'Stránka nenalezena' })).toBeInTheDocument();
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
    expect(document.title).toBe('Stránka nenalezena | Cesty bez mapy');
    expect(container.querySelector('[data-page="not-found"]')).not.toBeNull();

    expect(container.querySelector('[data-prerender-ready="true"]')).toBeNull();
    // Footer vykresluje vlastní Organization JSON-LD vždy (SEO-08) — ověřujeme jen,
    // že žádný script neobsahuje Product JSON-LD (to renderuje SeoTags jen pro načtený produkt).
    const scripts = [...container.querySelectorAll('script[type="application/ld+json"]')];
    const hasProductJsonLd = scripts.some((s) => (JSON.parse(s.textContent) as { '@type': string })['@type'] === 'Product');
    expect(hasProductJsonLd).toBe(false);
    // PGRST116 není chyba: žádný catch se nespustí, do Sentry se nic nehlásí
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('přechodná chyba načtení: dosavadní chybové UI, titulek „Chyba načítání", BEZ noindex', async () => {
    const builder = makeBuilder({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } });
    fromMock.mockReturnValue(builder);

    const { container } = renderProductDetail();

    await waitFor(() => {
      expect(container.querySelector('h1')).toHaveTextContent('canceling statement due to statement timeout');
    });
    // Produkt nejspíš existuje — noindex by ho mohl vyřadit z indexu.
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
    expect(document.title).toBe('Chyba načítání | Cesty bez mapy');
    expect(container.querySelector('[data-page="not-found"]')).toBeNull();
    expect(container.querySelector('[data-prerender-ready="true"]')).toBeNull();
  });

  it('SPA navigace z nenalezeného produktu na existující: NotFound nepřežije', async () => {
    fromMock
      .mockReturnValueOnce(makeBuilder({ data: null, error: { code: 'PGRST116' } }))
      .mockReturnValue(makeBuilder({ data: fixtureProduct, error: null }));

    function GoTo() {
      const navigate = useNavigate();
      return (
        <button type="button" onClick={() => void navigate('/cestovni-pruvodci/toskansko')}>
          jinam
        </button>
      );
    }
    const { container } = render(
      <CartProvider>
        <MemoryRouter initialEntries={['/cestovni-pruvodci/neexistujici']}>
          <GoTo />
          <Routes>
            <Route path="/cestovni-pruvodci/:slug" element={<ProductDetail />} />
          </Routes>
        </MemoryRouter>
      </CartProvider>,
    );
    await screen.findByRole('heading', { level: 1, name: 'Stránka nenalezena' });

    fireEvent.click(screen.getByRole('button', { name: 'jinam' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Toskánsko na 7 dní' })).toBeInTheDocument();
    expect(container.querySelector('[data-page="not-found"]')).toBeNull();
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('výpadek recenzí neshodí stránku — produkt se vykreslí a JSON-LD nese aggregateRating bez review', async () => {
    const builder = makeBuilder({ data: { ...fixtureProduct, average_rating: 4.5, review_count: 2 }, error: null });
    fromMock.mockReturnValue(builder);
    // Selže jen preload; vlastní fetch ProductReviews (druhé volání) projde — jinak by
    // stránka připravenost neohlásila vůbec (viz testy M-6 níže).
    fetchApprovedReviewsMock
      .mockRejectedValueOnce(new Error('reviews down'))
      .mockResolvedValue({ reviews: [], total: 2 });

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

    // Výpadek recenzí se hlásí do Sentry (tags.area = reviews), i když stránku neshodí
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tags: { area: 'reviews', component: 'ProductDetail' } }),
    );
  });

  describe('připravenost pro prerender čeká na sekci recenzí (M-6)', () => {
    const reviewedProduct = { ...fixtureProduct, average_rating: 4.5, review_count: 1 };
    const review = {
      id: 'r1',
      rating: 5,
      review_text: 'Skvělý itinerář, prošli jsme ho celý.',
      reviewer_name: 'Petra',
      created_at: '2026-08-01T10:00:00.000Z',
    };

    it('preload selže a vlastní fetch sekce ještě běží → marker NENÍ; doběhne → marker je', async () => {
      fromMock.mockReturnValue(makeBuilder({ data: reviewedProduct, error: null }));
      let resolveOwnFetch: (value: unknown) => void = () => undefined;
      fetchApprovedReviewsMock
        .mockRejectedValueOnce(new Error('preload down'))
        .mockReturnValueOnce(new Promise((resolve) => { resolveOwnFetch = resolve; }));

      const { container } = renderProductDetail();

      // Stránka produktu už je vykreslená (h1), sekce recenzí se teprve načítá.
      await screen.findByRole('heading', { level: 1, name: 'Toskánsko na 7 dní' });
      await waitFor(() => expect(fetchApprovedReviewsMock).toHaveBeenCalledTimes(2));
      expect(container.querySelector('[data-prerender-ready="true"]')).toBeNull();
      expect(screen.queryByRole('region', { name: 'Recenze produktu' })).toBeNull();

      resolveOwnFetch({ reviews: [review], total: 1 });

      await waitFor(() => {
        expect(container.querySelector('[data-prerender-ready="true"]')).not.toBeNull();
      });
      expect(screen.getByRole('region', { name: 'Recenze produktu' })).toHaveTextContent('Skvělý itinerář');
    });

    it('preload selže a selže i vlastní fetch sekce → marker nikdy (build spadne nahlas)', async () => {
      fromMock.mockReturnValue(makeBuilder({ data: reviewedProduct, error: null }));
      fetchApprovedReviewsMock.mockRejectedValue(new Error('reviews down'));

      const { container } = renderProductDetail();

      expect(await screen.findByText('Recenze se nepodařilo načíst. Zkus to prosím později.')).toBeInTheDocument();
      expect(container.querySelector('[data-prerender-ready="true"]')).toBeNull();
    });

    it('preload projde → marker je, sekce recenzí je ve stránce, žádný druhý fetch', async () => {
      fromMock.mockReturnValue(makeBuilder({ data: reviewedProduct, error: null }));
      fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review], total: 1 });

      const { container } = renderProductDetail();

      await waitFor(() => {
        expect(container.querySelector('[data-prerender-ready="true"]')).not.toBeNull();
      });
      expect(screen.getByRole('region', { name: 'Recenze produktu' })).toHaveTextContent('Skvělý itinerář');
      expect(fetchApprovedReviewsMock).toHaveBeenCalledTimes(1);
    });
  });

  it('prázdný detail_title vypíše v <h1> interní název produktu', async () => {
    const builder = makeBuilder({ data: { ...fixtureProduct, detail_title: '   ' }, error: null });
    fromMock.mockReturnValue(builder);

    const { container } = renderProductDetail();

    await waitFor(() => {
      expect(container.querySelector('[data-prerender-ready="true"]')).not.toBeNull();
    });

    // Nadpis prochází stejným pravidlem jako JSON-LD `name` (productDisplayName), aby
    // stránka a strukturovaná data neříkaly každá něco jiného — a hlavně aby <h1>
    // nezůstal prázdný.
    expect(container.querySelector('h1')).toHaveTextContent('Itinerář Toskánsko');
    expect(document.head.querySelector('title')).toHaveTextContent('Itinerář Toskánsko');
  });

  it('souhrn hodnocení pod nadpisem je odkaz na stránku recenzí a preload čte sdílenou konstantu', async () => {
    const builder = makeBuilder({ data: { ...fixtureProduct, average_rating: 4.5, review_count: 2 }, error: null });
    fromMock.mockReturnValue(builder);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [], total: 2 });

    const { container } = renderProductDetail();

    await waitFor(() => {
      expect(container.querySelector('[data-prerender-ready="true"]')).not.toBeNull();
    });

    // Souhrn hodnocení (F-1): musí to být skutečný odkaz na stránku recenzí tohoto
    // produktu s korektně poskládaným přístupným názvem — ne jen vizuální text.
    const summaryLink = container.querySelector('a[href="/cestovni-pruvodci/toskansko/recenze"]');
    expect(summaryLink).not.toBeNull();
    expect(summaryLink).toHaveAccessibleName('Hodnocení 4,5 z 5, 2 recenze — zobrazit všechny recenze');

    // Preload (F-2): volání fetchApprovedReviews musí nést sdílenou konstantu, ne
    // jakékoli jiné číslo — jinak by JSON-LD a viditelné karty mohly nést jiný počet.
    expect(fetchApprovedReviewsMock).toHaveBeenCalledWith({
      productId: 'prod-1',
      limit: PRODUCT_REVIEWS_LIMIT,
      offset: 0,
      // Detail název produktu z embedu nepotřebuje (audit T-11).
      withProduct: false,
    });
  });

  it('bez recenzí (výchozí fixtura) se souhrn hodnocení nevykreslí a recenze se nefetchují', async () => {
    const builder = makeBuilder({ data: fixtureProduct, error: null });
    fromMock.mockReturnValue(builder);

    const { container } = renderProductDetail();

    await waitFor(() => {
      expect(container.querySelector('[data-prerender-ready="true"]')).not.toBeNull();
    });

    expect(container.querySelector('a[href="/cestovni-pruvodci/toskansko/recenze"]')).toBeNull();
    expect(fetchApprovedReviewsMock).not.toHaveBeenCalled();
  });

  it('preload recenzí používá sdílenou konstantu, ne vlastní číslo', () => {
    expect(PRODUCT_REVIEWS_LIMIT).toBe(3);
    // Regrese: ProductDetail měl limit napevno, takže změna konstanty se neprojevila.
    //
    // Čteme cestou relativní ke kořeni projektu (cwd Vitestu). NEPOUŽÍVAT
    // `new URL('./ProductDetail.tsx', import.meta.url)`: Vite ten literál přepisuje
    // svým assetImportMetaUrl transformem na `http://localhost:3000/src/...`, takže
    // `readFileSync` spadne na ERR_INVALID_URL_SCHEME. (Ověřeno spuštěním.)
    const source = readFileSync('src/pages/ProductDetail.tsx', 'utf8');
    expect(source).not.toMatch(/limit:\s*6/);
    expect(source).toContain('PRODUCT_REVIEWS_LIMIT');
  });
});
