import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReviewsPagination from './ReviewsPagination';

const buildHref = (page: number) => (page <= 1 ? '/r' : `/r/strana/${page}`);
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
    expect(current).toHaveAttribute('href', '/r/strana/2');
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
    expect(screen.getByRole('link', { name: 'Strana 1' })).toHaveAttribute('href', '/r');
    expect(screen.getByRole('link', { name: 'Strana 3' })).toHaveAttribute('href', '/r/strana/3');
    expect(screen.getByRole('link', { name: 'Předchozí strana' })).toHaveAttribute('href', '/r');
    expect(screen.getByRole('link', { name: 'Další strana' })).toHaveAttribute('href', '/r/strana/3');
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

  it('výpustka má aria-hidden', () => {
    renderAt(10, 30);
    const gaps = screen.getAllByText('…');
    gaps.forEach((gap) => {
      expect(gap.closest('li')).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
