import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { CartProvider } from '../contexts';
import ReviewsVerification from './ReviewsVerification';
import Footer from '../components/layout/Footer';
import { ROUTES } from '../constants';
import { REVIEWS_DISCLOSURE } from '../components/reviews/disclosure';

// Povinnost dle § 5a odst. 5 zákona č. 634/1992 Sb.: uvést, ZDA a JAK recenze
// ověřujeme. Od 2026-08-29 to nese tahle stránka a odkaz z patičky — obojí je
// nosné, takže obojí má vlastní test. Bez odkazu by informace na webu existovala,
// ale zákazník by ji musel aktivně hledat, což je přesně to, co se nesmí stát.
describe('Ověřování recenzí', () => {
  const renderPage = () =>
    render(
      <CartProvider>
        <MemoryRouter><ReviewsVerification /></MemoryRouter>
      </CartProvider>,
    );

  it('vysvětluje ZDA i JAK recenze ověřujeme', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: /jak ověřujeme recenze/i })).toBeInTheDocument();
    expect(screen.getByText(REVIEWS_DISCLOSURE)).toBeInTheDocument();
    // „jak“ = konkrétní mechanismus, ne obecné ujištění
    expect(screen.getByText(/21 dní po zaplacení/)).toBeInTheDocument();
    expect(screen.getByText(/žádný veřejný formulář/)).toBeInTheDocument();
  });

  // Audit P-9: absolutní slib „kritickou recenzi nesmažeme“ kód nedrží (admin má DELETE
  // i změnu stavu). Stránka má pojmenovat úzkou výjimku, ne slibovat nemožné.
  it('neslibuje, že recenzi nikdy nesmaže, ale říká, kdy ji nezveřejní', () => {
    renderPage();
    expect(screen.queryByText(/kritickou recenzi nesmažeme/)).not.toBeInTheDocument();
    expect(screen.getByText(/nikdy ne proto, že je kritická/)).toBeInTheDocument();
    expect(screen.getByText(/Za recenze neplatíme/)).toBeInTheDocument();
  });

  // Audit P-8: pokyny Komise chtějí i „jak se vypočítává průměrné hodnocení“.
  it('vysvětluje, jak se počítá průměr a co do něj nevstupuje', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 2, name: /jak počítáme hodnocení/i })).toBeInTheDocument();
    expect(screen.getByText(/zaokrouhlený na jedno desetinné místo/)).toBeInTheDocument();
    expect(screen.getByText(/dobré i špatné/)).toBeInTheDocument();
    expect(screen.getByText(/započítá až ve chvíli, kdy ji zveřejníme/)).toBeInTheDocument();
  });

  it('odkazuje na ustanovení, podle kterého se informace uvádí', () => {
    renderPage();
    expect(screen.getByText(/§ 5a odst\. 5/)).toBeInTheDocument();
  });

  it('patička na stránku odkazuje textem, ze kterého je zřejmé, kam vede', () => {
    render(
      <CartProvider>
        <MemoryRouter><Footer /></MemoryRouter>
      </CartProvider>,
    );
    const link = screen.getByRole('link', { name: /ověřování recenzí/i });
    expect(link).toHaveAttribute('href', ROUTES.REVIEWS_VERIFICATION);
  });
});
