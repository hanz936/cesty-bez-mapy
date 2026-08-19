import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProductRatingSummary from './ProductRatingSummary';

const renderIn = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('ProductRatingSummary', () => {
  it('při nule recenzí nevykreslí nic', () => {
    const { container } = renderIn(<ProductRatingSummary average={0} count={0} href="/x" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('s href je odkaz s přístupným názvem', () => {
    renderIn(<ProductRatingSummary average={4.5} count={12} href="/cestovni-pruvodci/italie/recenze" />);
    const link = screen.getByRole('link', { name: 'Hodnocení 4,5 z 5, 12 recenzí — zobrazit všechny recenze' });
    expect(link).toHaveAttribute('href', '/cestovni-pruvodci/italie/recenze');
  });

  it('bez href je statický text, ne odkaz', () => {
    renderIn(<ProductRatingSummary average={5} count={1} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/1 recenze/)).toBeInTheDocument();
  });

  it('průměr formátuje s desetinnou čárkou', () => {
    renderIn(<ProductRatingSummary average={5} count={3} />);
    expect(screen.getByText(/5,0/)).toBeInTheDocument();
  });

  it('průměr z DB zaokrouhlí na jedno desetinné místo', () => {
    // DB ukládá round(avg, 2) → 4.67. Uživatel musí vidět touž hodnotu,
    // jakou pošleme do JSON-LD, jinak markujeme obsah, který na stránce není.
    renderIn(<ProductRatingSummary average={4.67} count={3} />);
    expect(screen.getByText(/4,7/)).toBeInTheDocument();
  });

  it('skloňuje počet recenzí', () => {
    const { rerender } = renderIn(<ProductRatingSummary average={5} count={3} />);
    expect(screen.getByText(/3 recenze/)).toBeInTheDocument();
    rerender(<MemoryRouter><ProductRatingSummary average={5} count={9} /></MemoryRouter>);
    expect(screen.getByText(/9 recenzí/)).toBeInTheDocument();
  });

  it('bez href je souhrn srozumitelný i bez hvězdiček', () => {
    // Hvězdičky jsou aria-hidden a `·` taky, takže bez skrytých fragmentů by
    // odečítač přečetl jen „5,0 12 recenzí“ — bez informace, že jde o hodnocení
    // z pěti. Varianta s href tenhle problém nemá, tam význam nese aria-label.
    renderIn(<ProductRatingSummary average={5} count={12} />);
    expect(screen.getByText('Hodnocení')).toBeInTheDocument();
    expect(screen.getByText('z 5,')).toBeInTheDocument();
  });
});
