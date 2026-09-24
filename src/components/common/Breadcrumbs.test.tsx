import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Breadcrumbs from './Breadcrumbs';

const crumbs = [
  { name: 'Cestovní průvodci', path: '/cestovni-pruvodci' },
  { name: 'Toskánsko', path: '/cestovni-pruvodci/toskansko' },
  { name: 'Recenze' },
];

const renderCrumbs = () =>
  render(
    <MemoryRouter>
      <Breadcrumbs crumbs={crumbs} />
    </MemoryRouter>,
  );

describe('Breadcrumbs', () => {
  it('je pojmenovaný orientační bod se seznamem položek', () => {
    // Bez názvu by se v odečítači nedal odlišit od hlavní navigace v Layoutu.
    renderCrumbs();
    const nav = screen.getByRole('navigation', { name: 'Drobečky' });
    expect(within(nav).getAllByRole('listitem')).toHaveLength(3);
  });

  it('položky s cestou jsou odkazy, poslední je text s aria-current', () => {
    renderCrumbs();
    expect(screen.getByRole('link', { name: 'Cestovní průvodci' })).toHaveAttribute(
      'href',
      '/cestovni-pruvodci',
    );
    expect(screen.getByRole('link', { name: 'Toskánsko' })).toHaveAttribute(
      'href',
      '/cestovni-pruvodci/toskansko',
    );
    expect(screen.queryByRole('link', { name: 'Recenze' })).not.toBeInTheDocument();
    expect(screen.getByText('Recenze')).toHaveAttribute('aria-current', 'page');
  });

  it('oddělovač odečítač nečte', () => {
    // Hierarchii nese seznam; lomítko přečtené nahlas je jen šum.
    const { container } = renderCrumbs();
    const separators = container.querySelectorAll('[aria-hidden="true"]');
    expect(separators).toHaveLength(2);
    expect([...separators].every((s) => s.textContent?.trim() === '/')).toBe(true);
  });
});
