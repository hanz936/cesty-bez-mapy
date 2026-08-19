import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { CartProvider } from '../contexts';

const fetchProductForReviewsMock = vi.fn<(...args: unknown[]) => unknown>();
const fetchApprovedReviewsMock = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('../lib/reviews', () => ({
  fetchProductForReviews: (...args: unknown[]) => fetchProductForReviewsMock(...args),
  fetchApprovedReviews: (...args: unknown[]) => fetchApprovedReviewsMock(...args),
}));
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

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
    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent('/cestovni-pruvodci/italie/recenze'),
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
    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent('/cestovni-pruvodci/italie/recenze'),
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

  it('selhání načtení ukáže chybu, ne prázdný stav', async () => {
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockRejectedValue(new Error('boom'));
    renderAt('/cestovni-pruvodci/italie/recenze');
    await waitFor(() => expect(screen.getByText(/nepodařilo načíst/)).toBeInTheDocument());
    expect(screen.queryByText(/zatím recenzi nemá/)).not.toBeInTheDocument();
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
