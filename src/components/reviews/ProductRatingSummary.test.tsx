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
    // DB drží přesný průměr (třeba 4.6667). Uživatel musí vidět touž hodnotu,
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
    // Hvězdičky jsou aria-hidden a `·` taky, takže bez skrytého úvodu by
    // odečítač přečetl jen „5,0 z 5 12 recenzí“ — bez slova, že jde o hodnocení.
    // Varianta s href tenhle problém nemá, tam význam nese aria-label.
    renderIn(<ProductRatingSummary average={5} count={12} />);
    expect(screen.getByText('Hodnocení')).toBeInTheDocument();
    // Čárka za „z 5" je jen pro odečítač — oddělí měřítko od počtu recenzí.
    expect(screen.getByText('z 5').textContent).toBe('z 5,');
  });

  it('jmenovatel „z 5" je vidět i očima, v obou variantách', () => {
    // Bez něj by škálu nesly jen prázdné hvězdy s kontrastem 1,47 : 1 (audit A-9).
    // Hledá se viditelný text — `sr-only` fragmenty se vynechají.
    const visibleText = (root: HTMLElement) =>
      Array.from(root.querySelectorAll('span'))
        .filter((el) => !el.closest('.sr-only') && !el.closest('[aria-hidden="true"]'))
        .map((el) => Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join(''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    const { container, unmount } = renderIn(<ProductRatingSummary average={4.6} count={12} />);
    expect(visibleText(container)).toBe('4,6 z 5 12 recenzí');
    unmount();
    const linked = renderIn(<ProductRatingSummary average={4.6} count={12} href="/x/recenze" />);
    expect(visibleText(linked.container)).toBe('4,6 z 5 12 recenzí');
  });

  it('hvězdičky se kreslí ze zaokrouhlené hodnoty, ne ze syrového průměru', () => {
    // average=4.96 zaokrouhlí formatRatingCs na „5,0“. Kdyby hvězdičky kreslily
    // ze syrového průměru, Math.ceil(4.96)=5 a 4.96 % 1 !== 0 by dokreslily
    // půl hvězdu na páté pozici — text by tvrdil 5,0, hvězdičky by ukazovaly 4,5.
    renderIn(<ProductRatingSummary average={4.96} count={7} />);
    expect(screen.getByText(/5,0/)).toBeInTheDocument();
    expect(screen.queryByTestId('half-star')).not.toBeInTheDocument();
  });
});
