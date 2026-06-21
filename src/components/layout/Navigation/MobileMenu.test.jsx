import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CartProvider } from '../../../contexts';
import MobileMenu from './MobileMenu';

// MobileMenu renderuje <CartButton>, který volá useCart() → MUSÍ být uvnitř
// <CartProvider> (jinak hází "useCart musí být použit uvnitř CartProvider").
// useLocation() uvnitř MobileMenu vyžaduje router → <MemoryRouter>.
// Vzor převzat z ověřeného src/pages/ProductDetail.seo.test.jsx (tier D).
function renderMenu(isMenuOpen) {
  return render(
    <CartProvider>
      <MemoryRouter>
        <MobileMenu
          isMenuOpen={isMenuOpen}
          onClose={() => {}}
          firstMenuItemRef={{ current: null }}
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
