import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { CartProvider } from '../contexts';

const fetchProductForReviewsMock = vi.fn<(...args: unknown[]) => unknown>();
const fetchApprovedReviewsMock = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('../lib/reviews', () => ({
  fetchProductForReviews: (...args: unknown[]) => fetchProductForReviewsMock(...args),
  fetchApprovedReviews: (...args: unknown[]) => fetchApprovedReviewsMock(...args),
}));
// Module-scope handle (ne inline `vi.fn()`), stejně jako ProductDetail.seo.test.tsx —
// jinak by nešlo ověřit, s jakými argumenty (tagy) se `captureException` volá.
const captureExceptionMock = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('@sentry/react', () => ({ captureException: (...args: unknown[]) => captureExceptionMock(...args) }));

import ProductReviewsPage from './ProductReviewsPage';

const product = {
  id: 'p1', title: 'Itálie', detail_title: 'Roadtrip po Itálii', hero_subtitle: '20 dní',
  slug: 'italie', image_url: null, average_rating: 5, review_count: 12,
};
const review = (id: string) => ({
  id, product_id: 'p1', reviewer_name: 'Jana N.', rating: 5,
  review_text: 'Skvělý průvodce.', created_at: '2026-07-01T10:00:00.000Z',
  products: { title: 'Itálie', slug: 'italie' },
});

/** Vypíše aktuální cestu, aby šlo ověřit přesměrování. */
const LocationSpy = () => {
  const location = useLocation();
  return <div data-testid="pathname">{location.pathname}</div>;
};

// `CartProvider` je povinný: stránka renderuje Layout → Navigation → CartButton,
// který volá `useCart()`. Bez providera to vyhodí a spadne to do NavigationErrorBoundary —
// testy sice projdou, ale testovaly by jiný strom, než jaký běží v produkci
// (a každý test by vypsal plný React error stack). Stejně to řeší ProductDetail.seo.test.tsx.
function renderAt(path: string) {
  return render(
    <CartProvider>
      <MemoryRouter initialEntries={[path]}>
        <LocationSpy />
        <Routes>
          <Route path="/cestovni-pruvodci/:slug/recenze" element={<ProductReviewsPage />} />
          <Route path="/cestovni-pruvodci/:slug/recenze/strana/:strana" element={<ProductReviewsPage />} />
          <Route path="/cestovni-pruvodci/:slug" element={<div>DETAIL PRODUKTU</div>} />
          <Route path="*" element={<div>NENALEZENO</div>} />
        </Routes>
      </MemoryRouter>
    </CartProvider>,
  );
}

describe('ProductReviewsPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('vykreslí povinný disclosure', async () => {
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze');
    await waitFor(() => expect(screen.getByText(/ověření zákazníci/)).toBeInTheDocument());
  });

  it('strana 1 načítá s nulovým offsetem', async () => {
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze');
    await waitFor(() =>
      expect(fetchApprovedReviewsMock).toHaveBeenCalledWith({ productId: 'p1', limit: 10, offset: 0 }),
    );
  });

  it('strana 2 načítá s offsetem 10', async () => {
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze/strana/2');
    await waitFor(() =>
      expect(fetchApprovedReviewsMock).toHaveBeenCalledWith({ productId: 'p1', limit: 10, offset: 10 }),
    );
  });

  it('stranu mimo rozsah přesměruje na poslední platnou a dotaz mimo rozsah NEODEŠLE', async () => {
    // PostgREST vrací na Range mimo rozsah HTTP 416 → count by se nedozvěděl,
    // proto se strana ořízne z review_count ještě před dotazem.
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze/strana/99');
    // 12 recenzí / 10 na stranu = 2 strany → poslední platná je 2.
    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent('/cestovni-pruvodci/italie/recenze/strana/2'),
    );
    await waitFor(() =>
      expect(fetchApprovedReviewsMock).toHaveBeenCalledWith({ productId: 'p1', limit: 10, offset: 10 }),
    );
    // Nikdy se neptáme na stranu 99 (offset 980).
    expect(fetchApprovedReviewsMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ offset: 980 }),
    );
  });

  it('nečíselnou stranu přesměruje na první', async () => {
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze/strana/abc');
    // Přesná shoda, ne `toHaveTextContent`: ten testuje podřetězec a
    // '/cestovni-pruvodci/italie/recenze' je podřetězcem i výchozí (nepřesměrované)
    // cesty '/cestovni-pruvodci/italie/recenze/strana/abc' — bez přesné shody by test
    // prošel, i kdyby k přesměrování vůbec nedošlo.
    await waitFor(() =>
      expect(screen.getByTestId('pathname').textContent).toBe('/cestovni-pruvodci/italie/recenze'),
    );
    await waitFor(() =>
      expect(fetchApprovedReviewsMock).toHaveBeenCalledWith({ productId: 'p1', limit: 10, offset: 0 }),
    );
  });

  it('/strana/1 přesměruje na adresu bez segmentu strany', async () => {
    // Jinak by tentýž obsah žil na dvou adresách.
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze/strana/1');
    // Přesná shoda, ne `toHaveTextContent`: ten testuje podřetězec a
    // '/cestovni-pruvodci/italie/recenze' je podřetězcem i výchozí (nepřesměrované)
    // cesty '/cestovni-pruvodci/italie/recenze/strana/1' — bez přesné shody by test
    // prošel, i kdyby k přesměrování vůbec nedošlo.
    await waitFor(() =>
      expect(screen.getByTestId('pathname').textContent).toBe('/cestovni-pruvodci/italie/recenze'),
    );
    await waitFor(() =>
      expect(fetchApprovedReviewsMock).toHaveBeenCalledWith({ productId: 'p1', limit: 10, offset: 0 }),
    );
  });

  it('platnou stranu 2 nepřesměrovává', async () => {
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze/strana/2');
    await waitFor(() => expect(fetchApprovedReviewsMock).toHaveBeenCalled());
    expect(screen.getByTestId('pathname')).toHaveTextContent('/cestovni-pruvodci/italie/recenze/strana/2');
  });

  it('neznámý produkt vede na NotFound', async () => {
    fetchProductForReviewsMock.mockResolvedValue(null);
    renderAt('/cestovni-pruvodci/neexistuje/recenze');
    await waitFor(() => expect(screen.getByText(/Stránka nenalezena|404/i)).toBeInTheDocument());
    expect(fetchApprovedReviewsMock).not.toHaveBeenCalled();
  });

  it('produkt bez recenzí ukáže prázdný stav a nedotazuje se', async () => {
    fetchProductForReviewsMock.mockResolvedValue({ ...product, review_count: 0, average_rating: 0 });
    renderAt('/cestovni-pruvodci/italie/recenze');
    await waitFor(() => expect(screen.getByText(/zatím recenzi nemá/)).toBeInTheDocument());
    expect(fetchApprovedReviewsMock).not.toHaveBeenCalled();
  });

  it('review_count > 0, ale dotaz na recenze vrátí prázdné pole → prázdný stav, ne prázdný seznam', async () => {
    // Závod: moderace mezi dotazem na produkt (review_count) a dotazem na recenze
    // schválenou recenzi smaže nebo odschválí. `product.review_count` pak lže — 12,
    // ale `fetchApprovedReviews` vrátí `[]`. Bez ochrany by stránka vykreslila
    // prázdný `<ul>` a stránkování a neřekla by uživateli vůbec nic.
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [], total: 12 });
    const { container } = renderAt('/cestovni-pruvodci/italie/recenze');
    await waitFor(() => expect(screen.getByText(/zatím recenzi nemá/)).toBeInTheDocument());
    // Cíleně na `container` a přesnou třídu/atribut, ne `getByRole('list')` —
    // Layout renderuje i navigační `<ul>`, který v jsdomu (na rozdíl od prohlížeče)
    // implicitní roli "list" neztrácí ani s `list-style: none`, takže by test byl
    // falešně nejednoznačný.
    expect(container.querySelector('ul.space-y-6')).toBeNull();
    expect(container.querySelector('nav[aria-label="Stránkování recenzí"]')).toBeNull();
  });

  it('selhání načtení ukáže chybu, ne prázdný stav', async () => {
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockRejectedValue(new Error('boom'));
    renderAt('/cestovni-pruvodci/italie/recenze');
    await waitFor(() => expect(screen.getByText(/nepodařilo načíst/)).toBeInTheDocument());
    expect(screen.queryByText(/zatím recenzi nemá/)).not.toBeInTheDocument();
    // Plán vyžaduje přesný tvar tagů — bez něj by se ztratila filtrovatelnost
    // podle oblasti/komponenty v Sentry dashboardu.
    expect(captureExceptionMock).toHaveBeenCalledWith(expect.any(Error), {
      tags: { area: 'reviews', component: 'ProductReviewsPage' },
    });
  });

  it('selhání načtení produktu vypíše holé „Recenze“, ne useknuté „Recenze —“', async () => {
    // Rozhodnutí ownera: bez názvu produktu se nadpis nezkracuje s pomlčkou navíc.
    fetchProductForReviewsMock.mockRejectedValue(new Error('boom'));
    renderAt('/cestovni-pruvodci/italie/recenze');
    await waitFor(() => expect(screen.getByText(/nepodařilo načíst/)).toBeInTheDocument());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Recenze');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Recenze');
  });

  it('po kliknutí na jinou stranu přesune fokus na nadpis', async () => {
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze');
    const heading = await screen.findByRole('heading', { level: 1 });
    expect(document.activeElement).not.toBe(heading);

    // Navigovat se MUSÍ uvnitř téhož routeru. `MemoryRouter` drží historii v `useRef`
    // a `initialEntries` čte jen při prvním renderu, takže `rerender()` s novým
    // routerem stejného typu na stejné pozici location vůbec nezmění — React ho
    // jen re-renderuje a nové `initialEntries` zahodí. (Ověřeno spuštěním.)
    fireEvent.click(await screen.findByRole('link', { name: 'Strana 2' }));
    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent('/cestovni-pruvodci/italie/recenze/strana/2'),
    );
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 })));
  });

  it('přesměrování z neplatné strany fokus NEsebere', async () => {
    // Regrese: guard nesmí viset na `location.key`. Po přesměrování je klíč náhodný
    // (ne 'default'), takže by fokus skočil uživateli, který přišel z Googlu.
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze/strana/99');
    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent('/cestovni-pruvodci/italie/recenze/strana/2'),
    );
    const heading = await screen.findByRole('heading', { level: 1 });
    expect(document.activeElement).not.toBe(heading);
  });

  it('přímý vstup na stranu 2 fokus NEsebere', async () => {
    // Regrese: guard nesmí viset na tom, že se `page` po načtení dat změní z 1 na 2 —
    // to nastane i při příchodu z Googlu nebo ze záložky a uživateli by to bez varování
    // přeskočilo fokus doprostřed stránky.
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze/strana/2');
    await waitFor(() => expect(fetchApprovedReviewsMock).toHaveBeenCalled());
    const heading = await screen.findByRole('heading', { level: 1 });
    expect(document.activeElement).not.toBe(heading);
  });

  it('příchod z detailu produktu (skutečný PUSH) fokus NEsebere', async () => {
    // Regrese pro strážce `isFirstRender`: příchod z odkazu na detailu produktu je
    // taky `PUSH` (na rozdíl od všech ostatních testů, které startují přes
    // `initialEntries`, což je `POP`). Bez tohohle strážce by fokus naskočil na
    // nadpis dřív, než doběhne `fetchProductForReviews`, a přeskočil by odkaz
    // „Zpět na průvodce", který je v DOMu nad nadpisem.
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    render(
      <CartProvider>
        <MemoryRouter initialEntries={['/cestovni-pruvodci/italie']}>
          <LocationSpy />
          <Routes>
            <Route path="/cestovni-pruvodci/:slug/recenze" element={<ProductReviewsPage />} />
            <Route
              path="/cestovni-pruvodci/:slug"
              element={<Link to="/cestovni-pruvodci/italie/recenze">Recenze</Link>}
            />
          </Routes>
        </MemoryRouter>
      </CartProvider>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Recenze' }));
    await waitFor(() =>
      expect(screen.getByTestId('pathname').textContent).toBe('/cestovni-pruvodci/italie/recenze'),
    );

    // Ihned po přepnutí trasy, ještě předtím, než doběhne `fetchProductForReviews`.
    const heading = screen.getByRole('heading', { level: 1 });
    expect(document.activeElement).not.toBe(heading);

    // I po doběhnutí načtení — strážce nesmí povolit fokus ani retroaktivně.
    await waitFor(() => expect(fetchApprovedReviewsMock).toHaveBeenCalled());
    expect(document.activeElement).not.toBe(heading);
  });

  it('odkazuje zpět na detail produktu', async () => {
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze');
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /zpět na průvodce/i })).toHaveAttribute(
        'href',
        '/cestovni-pruvodci/italie',
      ),
    );
  });

  it('vykreslí perex a obrázek, protože je posílá do JSON-LD', async () => {
    // Google zakazuje markovat obsah, který na stránce není. `description`
    // a `image` v JSON-LD proto musí mít na stránce protějšek.
    fetchProductForReviewsMock.mockResolvedValue({ ...product, image_url: 'https://cdn.example/i.jpg' });
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze');
    await waitFor(() => expect(screen.getByText('20 dní')).toBeInTheDocument());
    expect(screen.getByRole('img', { name: /Průvodce Roadtrip po Itálii/ })).toHaveAttribute(
      'src',
      'https://cdn.example/i.jpg',
    );
  });

  it('produkt bez vlastního obrázku bere placeholder relativní cestou', async () => {
    // Absolutní URL by u placeholderu mířila na produkční doménu, která je do launche
    // za Basic auth — obrázek by se v preview vůbec nenačetl. V JSON-LD absolutní
    // zůstává, tam ji Google potřebuje.
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze');
    await waitFor(() =>
      expect(screen.getByRole('img', { name: /Průvodce Roadtrip po Itálii/ })).toHaveAttribute(
        'src',
        '/images/placeholder-guide.jpg',
      ),
    );
  });

  it('JSON-LD datePublished počítá pražské datum, ne UTC řez', async () => {
    // 22:30 UTC je v Praze (léto, UTC+2) už 00:30 dalšího dne — `reviewDateIso`
    // s tím počítá, `created_at.slice(0, 10)` by vrátil o den dřív.
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({
      reviews: [{ ...review('r1'), created_at: '2026-06-30T22:30:00.000Z' }],
      total: 12,
    });
    const { container } = renderAt('/cestovni-pruvodci/italie/recenze');

    await waitFor(() => {
      const scripts = [...container.querySelectorAll('script[type="application/ld+json"]')];
      const hasProductJsonLd = scripts.some(
        (s) => (JSON.parse(s.textContent) as { '@type': string })['@type'] === 'Product',
      );
      expect(hasProductJsonLd).toBe(true);
    });

    // Footer vykresluje vlastní Organization JSON-LD vždy (SEO-08) — vybíráme
    // script podle @type, ne podle pořadí.
    const scripts = [...container.querySelectorAll('script[type="application/ld+json"]')];
    const productJsonLd = scripts
      .map((s) => JSON.parse(s.textContent) as { '@type': string; review?: { datePublished: string }[] })
      .find((j) => j['@type'] === 'Product');
    expect(productJsonLd?.review?.[0]?.datePublished).toBe('2026-07-01');
  });

  it('signalizuje prerenderu hotovo až po načtení dat', async () => {
    // Na tomhle markeru stojí celý prerender: `waitForSelector` na něj čeká
    // a build tvrdě spadne, když nepřijde. Zároveň nesmí přijít předčasně,
    // jinak by se uložilo statické HTML s načítacím stavem.
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    const { container } = renderAt('/cestovni-pruvodci/italie/recenze');
    expect(container.querySelector('[data-prerender-ready="true"]')).toBeNull();
    await waitFor(() =>
      expect(container.querySelector('[data-prerender-ready="true"]')).not.toBeNull(),
    );
  });

  it('při selhání načtení prerender-ready NEnastaví', async () => {
    // Záměr: build má spadnout hlasitě. Bez toho by výpadek Supabase během
    // prerenderu tiše nasadil HTML s textem „Recenze se nepodařilo načíst“,
    // které má <h1> i dost bajtů, takže by prošlo i validací.
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockRejectedValue(new Error('boom'));
    const { container } = renderAt('/cestovni-pruvodci/italie/recenze');
    await waitFor(() => expect(screen.getByText(/nepodařilo načíst/)).toBeInTheDocument());
    expect(container.querySelector('[data-prerender-ready="true"]')).toBeNull();
  });
});
