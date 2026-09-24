import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
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
/**
 * Náhledový obrázek pod nadpisem. Má `alt=""` (audit A-11 — popis by jen zopakoval
 * `<h1>`), takže roli `img` nemá a podle jména ho najít nejde. Je to jediný `<img>`
 * v hlavní oblasti; karty recenzí kreslí hvězdy jako SVG.
 */
function heroImage(): HTMLImageElement {
  const images = screen.getByRole('main').querySelectorAll('img');
  expect(images).toHaveLength(1);
  return images[0];
}

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

  it('disclosure u recenzí NEvykresluje — má vlastní stránku', async () => {
    // Do 2026-08-29 tu stál odstavec s povinným disclosure. User ho po průzkumu
    // české praxe přesunul na `/overovani-recenzi` s odkazem v patičce; text
    // u karet zůstat nesmí, jinak by se ta změna tiše vrátila.
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument());
    expect(screen.queryByText(/ověření zákazníci/)).not.toBeInTheDocument();
  });

  it('strana 1 načítá s nulovým offsetem', async () => {
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze');
    await waitFor(() =>
      expect(fetchApprovedReviewsMock).toHaveBeenCalledWith({ productId: 'p1', limit: 10, offset: 0, withProduct: false }),
    );
  });

  it('recenze jsou seznam s `role="list"` a každá karta je `<article>`', async () => {
    // Audit A-5. Atribut, ne `getByRole('list')`: jsdom CSS nenačítá, takže `<ul>` má roli
    // seznamu vždycky a test by prošel i bez `role="list"`, na kterém VoiceOver závisí.
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1'), review('r2')], total: 12 });
    const { container } = renderAt('/cestovni-pruvodci/italie/recenze');
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
    const list = container.querySelector('ul.space-y-6');
    expect(list).toHaveAttribute('role', 'list');
    expect(list!.querySelectorAll(':scope > li > article')).toHaveLength(2);
  });

  it('strana 2 načítá s offsetem 10', async () => {
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze/strana/2');
    await waitFor(() =>
      expect(fetchApprovedReviewsMock).toHaveBeenCalledWith({ productId: 'p1', limit: 10, offset: 10, withProduct: false }),
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
      expect(fetchApprovedReviewsMock).toHaveBeenCalledWith({ productId: 'p1', limit: 10, offset: 10, withProduct: false }),
    );
    // Nikdy se neptáme na stranu 99 (offset 980).
    expect(fetchApprovedReviewsMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ offset: 980 }),
    );
    // Klíč dotazu nese už ořezanou stranu → přesměrování ho nezmění a dotaz se neopakuje.
    expect(fetchApprovedReviewsMock).toHaveBeenCalledTimes(1);
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
      expect(fetchApprovedReviewsMock).toHaveBeenCalledWith({ productId: 'p1', limit: 10, offset: 0, withProduct: false }),
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
      expect(fetchApprovedReviewsMock).toHaveBeenCalledWith({ productId: 'p1', limit: 10, offset: 0, withProduct: false }),
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
    // A hlavně: nad prázdným stavem nesmí svítit souhrn „5,0 z 5 · 12 recenzí". Text
    // a souhrn by si protiřečily a `SeoTags` by tentýž rozpor poslal do JSON-LD.
    expect(screen.queryByText(/12 recenz/)).toBeNull();
    expect(screen.queryByText('5,0')).toBeNull();
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

  it('přepnutí strany znovu NEnačítá produkt — jen recenze', async () => {
    // Produkt a recenze mají každý svůj efekt; produkt závisí jen na `slug`.
    // Dřív jeden efekt se závislostí na straně stál 2 dotazy na každé přepnutí (audit T-7).
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze');
    fireEvent.click(await screen.findByRole('link', { name: 'Strana 2' }));
    await waitFor(() =>
      expect(fetchApprovedReviewsMock).toHaveBeenCalledWith({ productId: 'p1', limit: 10, offset: 10, withProduct: false }),
    );
    expect(fetchProductForReviewsMock).toHaveBeenCalledTimes(1);
    expect(fetchApprovedReviewsMock).toHaveBeenCalledTimes(2);
  });

  it('po kliku na jinou stranu popisují <title> i canonical novou stranu hned, ne až po dotazu', async () => {
    // Strana se odvozuje z adresy při renderu. Dřív ji nastavoval efekt až po
    // doběhnutí dotazu, takže během načítání ukazovaly titulek i canonical tu
    // předchozí, ačkoli adresní řádek už byl jinde (audit T-6).
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze/strana/2');
    // Na odkaz čekat zvlášť: titulek naskočí už s produktem, stránkování až s recenzemi.
    const strana1 = await screen.findByRole('link', { name: 'Strana 1' });
    expect(document.title).toBe('Recenze — Roadtrip po Itálii (strana 2) | Cesty bez mapy');

    // Další dotaz na recenze nikdy nedoběhne — všechno níž platí BĚHEM načítání.
    fetchApprovedReviewsMock.mockReturnValue(new Promise(() => undefined));
    fireEvent.click(strana1);
    await waitFor(() =>
      expect(screen.getByTestId('pathname').textContent).toBe('/cestovni-pruvodci/italie/recenze'),
    );
    expect(screen.getByText('Načítám recenze…')).toBeInTheDocument();
    expect(document.title).toBe('Recenze — Roadtrip po Itálii | Cesty bez mapy');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toMatch(
      /\/cestovni-pruvodci\/italie\/recenze$/,
    );
  });

  it('přechod na recenze jiného produktu neukáže, dokud se načítá, ten předchozí', async () => {
    // Výsledek dotazu nese svůj `slug`; stránka ho použije jen pro adresu, ke
    // které patří. Jinak by pod novou adresou chvíli stál nadpis i JSON-LD
    // předchozího průvodce.
    fetchProductForReviewsMock.mockImplementation((slug) =>
      slug === 'italie' ? Promise.resolve(product) : new Promise(() => undefined),
    );
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    render(
      <CartProvider>
        <MemoryRouter initialEntries={['/cestovni-pruvodci/italie/recenze']}>
          <Link to="/cestovni-pruvodci/salzburg/recenze">Salzburg</Link>
          <Routes>
            <Route path="/cestovni-pruvodci/:slug/recenze" element={<ProductReviewsPage />} />
          </Routes>
        </MemoryRouter>
      </CartProvider>,
    );
    await screen.findByRole('heading', { level: 1, name: 'Recenze — Roadtrip po Itálii' });

    fireEvent.click(screen.getByRole('link', { name: 'Salzburg' }));
    await waitFor(() => expect(fetchProductForReviewsMock).toHaveBeenLastCalledWith('salzburg'));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Recenze');
    // Celá stránka i hlavička — všechny bloky JSON-LD, titulek, drobečková navigace.
    expect(document.documentElement.textContent).not.toContain('Itálii');
  });

  it('recenze předchozího produktu se nepřenesou k novému, dokud se jeho recenze načítají', async () => {
    // Mezi stranami téhož produktu stránka nechává poslední načtené recenze (souhrn
    // hodnocení tak neproblikne). U JINÉHO produktu by tatáž úspora vydala JSON-LD
    // nového produktu s recenzemi toho starého — proto výsledek nese `productId`.
    const salzburg = { ...product, id: 'p2', slug: 'salzburg', title: 'Salzburg', detail_title: 'Salzburg na víkend' };
    fetchProductForReviewsMock.mockImplementation((slug) =>
      Promise.resolve(slug === 'italie' ? product : salzburg),
    );
    fetchApprovedReviewsMock.mockImplementation((opts) =>
      (opts as { productId: string }).productId === 'p1'
        ? Promise.resolve({ reviews: [{ ...review('r1'), reviewer_name: 'Autorka z Itálie' }], total: 12 })
        : new Promise(() => undefined),
    );
    render(
      <CartProvider>
        <MemoryRouter initialEntries={['/cestovni-pruvodci/italie/recenze']}>
          <Link to="/cestovni-pruvodci/salzburg/recenze">Salzburg</Link>
          <Routes>
            <Route path="/cestovni-pruvodci/:slug/recenze" element={<ProductReviewsPage />} />
          </Routes>
        </MemoryRouter>
      </CartProvider>,
    );
    await screen.findByText('Autorka z Itálie');

    fireEvent.click(screen.getByRole('link', { name: 'Salzburg' }));
    await screen.findByRole('heading', { level: 1, name: 'Recenze — Salzburg na víkend' });
    await waitFor(() => expect(fetchApprovedReviewsMock).toHaveBeenLastCalledWith(expect.objectContaining({ productId: 'p2' })));
    expect(document.documentElement.textContent).not.toContain('Autorka z Itálie');
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

  it('drobečková navigace odkazuje zpět na detail produktu i na výpis průvodců', async () => {
    // Nahradila odkaz „← Zpět na průvodce" (audit M-2). Cesta zpět na detail
    // musí zůstat zachovaná — jen ji teď nese položka s názvem průvodce.
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze');
    const nav = await screen.findByRole('navigation', { name: 'Drobečky' });
    await waitFor(() =>
      expect(within(nav).getByRole('link', { name: 'Roadtrip po Itálii' })).toHaveAttribute(
        'href',
        '/cestovni-pruvodci/italie',
      ),
    );
    expect(within(nav).getByRole('link', { name: 'Cestovní průvodci' })).toHaveAttribute(
      'href',
      '/cestovni-pruvodci',
    );
    // Poslední položka není odkaz — vedl by sám na sebe.
    expect(within(nav).queryByRole('link', { name: 'Recenze' })).not.toBeInTheDocument();
  });

  it('viditelná cesta nese PŘESNĚ to, co stránka pošle v BreadcrumbList', async () => {
    // Smysl celého nálezu M-2: Google zakazuje markovat obsah, který na stránce
    // vidět není. Kdyby se jedna ze dvou stran změnila, spadne to tady.
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    const { container } = renderAt('/cestovni-pruvodci/italie/recenze');
    const nav = await screen.findByRole('navigation', { name: 'Drobečky' });
    await waitFor(() => expect(within(nav).getAllByRole('listitem')).toHaveLength(3));

    const videt = within(nav)
      .getAllByRole('listitem')
      .map((li) => li.textContent?.replace(/^\s*\/\s*/, '').trim());
    // Blok hledáme podle typu, ne podle pořadí — stránka nese i Product a Organization.
    const breadcrumb = [...container.querySelectorAll('script[type="application/ld+json"]')]
      .map((s) => JSON.parse(s.textContent) as { '@type': string; itemListElement?: { name: string }[] })
      .find((n) => n['@type'] === 'BreadcrumbList');
    expect(breadcrumb?.itemListElement?.map((i) => i.name)).toEqual(videt);
  });

  it('dokud se produkt načítá, cesta nemá prázdnou položku', async () => {
    // `product` je null → položka s názvem průvodce se vynechá. Dvě položky jsou
    // pořád nad minimem Googlu a JSON-LD v tu chvíli neexistuje, takže se nemá
    // s čím rozejít.
    fetchProductForReviewsMock.mockReturnValue(new Promise(() => undefined));
    fetchApprovedReviewsMock.mockReturnValue(new Promise(() => undefined));
    renderAt('/cestovni-pruvodci/italie/recenze');
    const nav = await screen.findByRole('navigation', { name: 'Drobečky' });
    expect(within(nav).getAllByRole('listitem').map((li) => li.textContent?.replace(/^\s*\/\s*/, '').trim()))
      .toEqual(['Cestovní průvodci', 'Recenze']);
  });

  it('vykreslí perex a obrázek, protože je posílá do JSON-LD', async () => {
    // Google zakazuje markovat obsah, který na stránce není. `description`
    // a `image` v JSON-LD proto musí mít na stránce protějšek.
    fetchProductForReviewsMock.mockResolvedValue({ ...product, image_url: 'https://cdn.example/i.jpg' });
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze');
    await waitFor(() => expect(screen.getByText('20 dní')).toBeInTheDocument());
    expect(heroImage()).toHaveAttribute('src', 'https://cdn.example/i.jpg');
    // Prázdný `alt`, ne chybějící: bez atributu by čtečka přečetla název souboru.
    expect(heroImage()).toHaveAttribute('alt', '');
  });

  it.each([
    ['null', null],
    // Prázdný řetězec je důvod, proč stránka používá `||`, ne `??`: sloupec je
    // nullable text bez CHECKu a `<img src="">` by prohlížeč řešil novým
    // dotazem na samotnou stránku. Bez tohohle případu by „úklid" na `??`
    // prošel celou sadou (audit T-4, ověřeno mutací).
    ["'' (prázdný řetězec)", ''],
  ])('produkt s image_url = %s bere placeholder relativní cestou', async (_label, imageUrl) => {
    // Absolutní URL by u placeholderu mířila na produkční doménu, která je do launche
    // za Basic auth — obrázek by se v preview vůbec nenačetl. V JSON-LD absolutní
    // zůstává, tam ji Google potřebuje.
    fetchProductForReviewsMock.mockResolvedValue({ ...product, image_url: imageUrl });
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze');
    await waitFor(() =>
      expect(heroImage()).toHaveAttribute('src', '/images/placeholder-guide.jpg'),
    );
  });

  it.each([
    ['/cestovni-pruvodci/italie/recenze', ''],
    ['/cestovni-pruvodci/italie/recenze/strana/2', ' (strana 2)'],
  ])('<h1> a <title> na %s říkají totéž, <title> přidá jen číslo strany', async (path, suffix) => {
    // Oba řetězce skládá `productReviewsHeading`. Dřív měl každý vlastní
    // template literál a změna oddělovače v jednom z nich prošla celou sadou
    // (audit T-1, ověřeno mutací).
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt(path);
    const heading = await screen.findByRole('heading', { level: 1, name: /Roadtrip po Itálii/ });
    expect(heading.textContent).toBe('Recenze — Roadtrip po Itálii');
    await waitFor(() => expect(document.title).toBe(`${heading.textContent}${suffix} | Cesty bez mapy`));
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
