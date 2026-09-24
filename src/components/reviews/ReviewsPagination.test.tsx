import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { productReviewsPath } from '../../constants/reviews';
import ReviewsPagination from './ReviewsPagination';
// Skutečný stavitel cesty, ne testovací dvojník: dvojník byl čtvrtou kopií pravidla
// „strana 1 je bez segmentu", navíc v zakázané formě `page <= 1` (u NaN se chová opačně
// než `isPagedPage`). S opravdovým builderem test ověřuje tu dvojici, která běží i v
// produkci — stránkování vždycky dostává `productReviewsPath`.
const buildHref = (page: number) => productReviewsPath('italie', page);
const base = productReviewsPath('italie');
const renderAt = (currentPage: number, totalPages: number) =>
  render(
    <MemoryRouter>
      <ReviewsPagination currentPage={currentPage} totalPages={totalPages} buildHref={buildHref} />
    </MemoryRouter>,
  );

describe('ReviewsPagination', () => {
  it('při jediné straně nevykreslí nic', () => {
    const { container } = renderAt(1, 1);
    expect(container).toBeEmptyDOMElement();
  });

  it('je to pojmenovaný orientační bod', () => {
    renderAt(2, 3);
    expect(screen.getByRole('navigation', { name: 'Stránkování recenzí' })).toBeInTheDocument();
  });

  it('aktuální strana zůstává odkazem a nese aria-current', () => {
    // W3C Design System: „it is fully linked so users of Assistive Technology
    // can find which is the currently active link."
    renderAt(2, 3);
    const current = screen.getByRole('link', { name: 'Strana 2' });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveAttribute('href', `${base}/strana/2`);
  });

  it('u krátké sekvence vypíše všechny strany', () => {
    renderAt(1, 7);
    expect(screen.getAllByRole('link', { name: /^Strana \d+$/ })).toHaveLength(7);
    expect(screen.queryByText('…')).not.toBeInTheDocument();
  });

  it('u dlouhé sekvence zkrátí prostředek výpustkami', () => {
    renderAt(10, 30);
    // Vždy první, poslední, aktuální a její sousedi.
    for (const page of ['1', '9', '10', '11', '30']) {
      expect(screen.getByRole('link', { name: `Strana ${page}` })).toBeInTheDocument();
    }
    expect(screen.queryByRole('link', { name: 'Strana 5' })).not.toBeInTheDocument();
    expect(screen.getAllByText('…')).toHaveLength(2);
  });

  it('každý odkaz má vlastní přístupný název', () => {
    renderAt(2, 3);
    expect(screen.getByRole('link', { name: 'Strana 1' })).toHaveAttribute('href', base);
    expect(screen.getByRole('link', { name: 'Strana 3' })).toHaveAttribute('href', `${base}/strana/3`);
    expect(screen.getByRole('link', { name: 'Předchozí strana' })).toHaveAttribute('href', base);
    expect(screen.getByRole('link', { name: 'Další strana' })).toHaveAttribute('href', `${base}/strana/3`);
  });

  it('na první straně chybí odkaz na předchozí', () => {
    renderAt(1, 3);
    expect(screen.queryByRole('link', { name: 'Předchozí strana' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Další strana' })).toBeInTheDocument();
  });

  it('na poslední straně chybí odkaz na další', () => {
    renderAt(3, 3);
    expect(screen.queryByRole('link', { name: 'Další strana' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Předchozí strana' })).toBeInTheDocument();
  });

  it('seznam nese explicitní role="list"', () => {
    const { container } = renderAt(2, 3);
    // Ne getByRole('list'): jsdom nenačítá Tailwind Preflight, takže implicitní roli má
    // <ul> i bez atributu a taková aserce projde vždycky. Ověřujeme proto atribut.
    expect(container.querySelector('ul')).toHaveAttribute('role', 'list');
  });

  it('className se dostane na nav', () => {
    const { container } = render(
      <MemoryRouter>
        <ReviewsPagination currentPage={1} totalPages={2} buildHref={buildHref} className="mt-10" />
      </MemoryRouter>,
    );
    const nav = container.querySelector('nav');
    expect(nav).toHaveClass('mt-10');
  });

  it('neaktuální odkaz nemá aria-current', () => {
    renderAt(2, 3);
    const link1 = screen.getByRole('link', { name: 'Strana 1' });
    const link3 = screen.getByRole('link', { name: 'Strana 3' });
    expect(link1).not.toHaveAttribute('aria-current');
    expect(link3).not.toHaveAttribute('aria-current');
  });

  it('necelá strana šipky nevykreslí', () => {
    // `paginationItems` má proti necelým číslům vlastní filtr, šipky si ale stranu
    // dopočítávají samy — bez guardu by odkazovaly na `/strana/1.5` a `/strana/3.5`.
    renderAt(2.5, 10);
    expect(screen.queryByRole('link', { name: 'Předchozí strana' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Další strana' })).not.toBeInTheDocument();
    // Zbytek stránkování zůstává — schovat celou navigaci by uživatele uvěznilo.
    expect(screen.getByRole('link', { name: 'Strana 1' })).toBeInTheDocument();
  });

  it('výpustka má aria-hidden', () => {
    renderAt(10, 30);
    const gaps = screen.getAllByText('…');
    gaps.forEach((gap) => {
      expect(gap.closest('li')).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('výpustka má čitelný kontrast (`gray-500`, ne `gray-400`)', () => {
    // `gray-400` má vůči bílé 2,60 : 1, `gray-500` 4,84 : 1 (audit A-10). Výpustka je
    // jediný vizuální signál, že se strany přeskakují. jsdom CSS nenačítá — třída.
    renderAt(10, 30);
    screen.getAllByText('…').forEach((gap) => {
      expect(gap.closest('li')).toHaveClass('text-gray-500');
      expect(gap.closest('li')).not.toHaveClass('text-gray-400');
    });
  });
});
