import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CartProvider, useCart } from '../contexts';
import Checkout from './Checkout';
import OrderConfirmation from './OrderConfirmation';
import Stahnout from './Stahnout';
import ReviewSubmit from './ReviewSubmit';
import CustomItineraryPreview from './CustomItineraryPreview';
import CustomItineraryForm from './CustomItineraryForm';

/**
 * Skořápka (`index.html`) žádný statický `<title>` nemá a React 19 při odchodu ze stránky
 * odebere jen svůj vlastní. Stránka bez vlastního titulku proto po navigaci v aplikaci nese
 * titulek té předchozí — třeba „Roadtrip po Itálii" v pokladně (nález M-1 z finální revize).
 */

// Dotazy, které stránky pouští po mountu, ve výchozím stavu visí: test se dívá na první
// render (načítací větev), ne na data. Řetěz `from(…)…` je „thenable" — když test nastaví
// `db.result`, doběhne s ním (chybové větve), jinak nikdy.
const db = vi.hoisted(() => ({ result: null as null | { data: unknown; error: unknown } }));
vi.mock('../lib/supabase', () => {
  const pending = new Promise<never>(() => undefined);
  const chain: Record<string, unknown> = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop !== 'then') return () => chain;
        const settled = db.result ? Promise.resolve(db.result) : pending;
        return settled.then.bind(settled);
      },
    },
  );
  return {
    supabase: {
      from: () => chain,
      functions: { invoke: () => pending },
      auth: {
        getUser: () => pending,
        getSession: () => pending,
        signInAnonymously: () => pending,
      },
    },
  };
});
vi.mock('../lib/reviews', () => ({
  getReviewRequest: () => new Promise<never>(() => undefined),
  submitReview: () => new Promise<never>(() => undefined),
}));

const CART_STORAGE_KEY = 'cbm_cart';

/**
 * Bez `routePath` se stránka vykreslí přímo, bez `<Routes>` — přesměrování (pokladna
 * s prázdným košíkem) ji pak neodmontuje a test vidí větev, kterou vykreslila.
 */
function renderAt(path: string, page: ReactElement, routePath?: string) {
  render(
    <CartProvider>
      <MemoryRouter initialEntries={[path]}>
        {routePath ? (
          <Routes>
            <Route path={routePath} element={page} />
          </Routes>
        ) : (
          page
        )}
      </MemoryRouter>
    </CartProvider>,
  );
}

/**
 * Košík se z localStorage načítá až v efektu providera — pokladna by do té doby viděla
 * prázdný košík a přesměrovala. V aplikaci je provider namontovaný dávno předtím.
 */
function WhenCartLoaded({ children }: { children: ReactElement }) {
  const { itemCount } = useCart();
  return itemCount > 0 ? children : null;
}

function titles(): string[] {
  return Array.from(document.head.querySelectorAll('title')).map((t) => t.textContent ?? '');
}

function robots(): string | null {
  return document.head.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null;
}

afterEach(() => {
  localStorage.clear();
  db.result = null;
});

describe('stránky bez SeoTags mají vlastní titulek', () => {
  it('pokladna s položkou v košíku: „Dokončení objednávky", noindex', () => {
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'p1',
          title: 'Toskánsko',
          price: 699,
          image: null,
          alt: '',
          duration: '7 dní',
          slug: 'toskansko',
          quantity: 1,
          customItineraryRequestId: null,
        },
      ]),
    );
    renderAt(
      '/objednavka',
      <WhenCartLoaded>
        <Checkout />
      </WhenCartLoaded>,
    );

    expect(screen.getByText('Toskánsko')).toBeInTheDocument();
    expect(titles()).toEqual(['Dokončení objednávky | Cesty bez mapy']);
    expect(robots()).toBe('noindex');
  });

  it('pokladna s prázdným košíkem (větev „Přesměrovávám…"): stejný titulek, noindex', () => {
    renderAt('/objednavka', <Checkout />);

    expect(screen.getByText('Přesměrovávám...')).toBeInTheDocument();
    expect(titles()).toEqual(['Dokončení objednávky | Cesty bez mapy']);
    expect(robots()).toBe('noindex');
  });

  it('potvrzení objednávky (načítací větev): „Potvrzení objednávky", noindex', () => {
    renderAt('/potvrzeni?session_id=cs_test_1', <OrderConfirmation />);

    expect(screen.getByText('Ověřujeme platbu...')).toBeInTheDocument();
    expect(titles()).toEqual(['Potvrzení objednávky | Cesty bez mapy']);
    expect(robots()).toBe('noindex');
  });

  it('potvrzení objednávky (chybová větev): stejný titulek, noindex', async () => {
    renderAt('/potvrzeni', <OrderConfirmation />);

    expect(await screen.findByText('Chybí identifikátor platby. Zkontrolujte URL.')).toBeInTheDocument();
    expect(titles()).toEqual(['Potvrzení objednávky | Cesty bez mapy']);
    expect(robots()).toBe('noindex');
  });

  it('stažení: „Ke stažení", noindex', () => {
    renderAt('/stahnout?token=abc', <Stahnout />);

    expect(titles()).toEqual(['Ke stažení | Cesty bez mapy']);
    expect(robots()).toBe('noindex');
  });

  it('formulář recenze: „Napsat recenzi", noindex', () => {
    renderAt('/recenze/pridat?token=abc', <ReviewSubmit />);

    expect(titles()).toEqual(['Napsat recenzi | Cesty bez mapy']);
    expect(robots()).toBe('noindex');
  });

  it('náhled dotazníku (načítací větev): „Tvůj cestovní profil", noindex', () => {
    renderAt('/nahled/abc', <CustomItineraryPreview />, '/nahled/:id');

    expect(screen.getByText('Načítám tvůj dotazník...')).toBeInTheDocument();
    expect(titles()).toEqual(['Tvůj cestovní profil | Cesty bez mapy']);
    expect(robots()).toBe('noindex');
  });

  it('náhled dotazníku (chybová větev): stejný titulek, noindex', async () => {
    db.result = { data: null, error: { code: 'PGRST116', message: 'no rows' } };
    renderAt('/nahled/abc', <CustomItineraryPreview />, '/nahled/:id');

    expect(await screen.findByText('Požadavek nebyl nalezen.')).toBeInTheDocument();
    expect(titles()).toEqual(['Tvůj cestovní profil | Cesty bez mapy']);
    expect(robots()).toBe('noindex');
  });

  it('dotazník k itineráři: „Dotazník k itineráři na míru", BEZ noindex', () => {
    renderAt('/dotaznik', <CustomItineraryForm />);

    expect(titles()).toEqual(['Dotazník k itineráři na míru | Cesty bez mapy']);
    expect(robots()).toBeNull();
  });
});

/**
 * Strážce: každá stránka v `src/pages/` vydává titulek. Grepuje zdroják, nerenderuje —
 * stejný přístup jako `layoutLandmarks.test.ts` a `focusOutline.test.ts`. Hlídá, že nová
 * stránka titulek nezapomene; že ho má KAŽDÁ návratová větev, hlídají render testy výš
 * (a revize).
 *
 * Cesty jsou relativní ke kořeni projektu — tam Vitest běží.
 */
const PAGES = 'src/pages';

/** Čím stránka titulek vydává: plné SEO, jen titulek, holý `<title>`, nebo stránka 404. */
const TITLE_SOURCE = /<SeoTags\b|<PageTitle\b|<title>|<NotFound\b/;

/**
 * Stránky, které titulek vědomě nevydávají (např. čisté přesměrování), s důvodem.
 * Dnes žádná.
 */
const WITHOUT_TITLE: Record<string, string> = {};

function pageFiles(): string[] {
  return readdirSync(PAGES, { encoding: 'utf8' })
    .filter((file) => file.endsWith('.tsx') && !file.includes('.test.'))
    .filter((file) => /^export default\b/m.test(readFileSync(`${PAGES}/${file}`, 'utf8')))
    .sort();
}

describe('strážce titulků stránek', () => {
  it('každá stránka vydává titulek (SeoTags, PageTitle, <title> nebo NotFound)', () => {
    const offenders = pageFiles()
      .filter((file) => !(file in WITHOUT_TITLE))
      .filter((file) => !TITLE_SOURCE.test(readFileSync(`${PAGES}/${file}`, 'utf8')));

    expect(offenders).toEqual([]);
  });

  it('strážce opravdu vidí stránky', () => {
    // Dolní mez, ne přesný počet: chrání před regulárním výrazem nebo cestou, které
    // nenajdou nic (a nechaly by test výš zelený navždy), a přitom nepadá na každé nové
    // stránce. Dnes jich je 24.
    expect(pageFiles().length).toBeGreaterThanOrEqual(24);
  });
});
