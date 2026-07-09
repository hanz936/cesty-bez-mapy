import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CartProvider } from '../../../contexts';
import MobileMenu from './MobileMenu';

// MobileMenu renderuje <CartButton>, který volá useCart() → MUSÍ být uvnitř
// <CartProvider> (jinak hází "useCart musí být použit uvnitř CartProvider").
// useLocation() uvnitř MobileMenu vyžaduje router → <MemoryRouter>.
// Vzor převzat z ověřeného src/pages/ProductDetail.seo.test.jsx (tier D).
function renderMenu(isMenuOpen: boolean) {
  return render(
    <CartProvider>
      <MemoryRouter>
        <MobileMenu
          isMenuOpen={isMenuOpen}
          // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional no-op callback; test does not exercise onClose here; byte-identical
          onClose={() => {}}
          firstMenuItemRef={{ current: null }}
          // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional no-op callback; test does not exercise onCartClick here; byte-identical
          onCartClick={() => {}}
        />
      </MemoryRouter>
    </CartProvider>,
  );
}

describe('MobileMenu — inert (A11Y-06)', () => {
  it('zavřené menu je inert (mimo tab order + accessibility tree)', () => {
    const { container } = renderMenu(false);
    expect(container.querySelector('#mobile-menu')).toHaveAttribute('inert');
  });

  it('otevřené menu inert NENÍ (interaktivní)', () => {
    const { container } = renderMenu(true);
    expect(container.querySelector('#mobile-menu')).not.toHaveAttribute('inert');
  });
});
