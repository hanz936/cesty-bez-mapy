import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CartProvider } from '../../contexts';
import Cart from './Cart';

describe('Cart', () => {
  beforeEach(() => {
    // CartProvider si košík načítá z localStorage; položka tam musí být před renderem.
    localStorage.setItem(
      'cbm_cart',
      JSON.stringify([
        {
          id: 'p1', title: 'Toskánsko', price: 699, image: null, alt: 'Toskánsko',
          duration: '7 dní', slug: 'toskansko', quantity: 1, customItineraryRequestId: null,
        },
      ]),
    );
  });

  it('tlačítko pro odebrání položky má ikonu s kontrastem aspoň 3 : 1', async () => {
    // Tlačítko je jen ikona „×"; `gray-400` má vůči bílé 2,60 : 1, `gray-500` 4,84 : 1
    // (WCAG 2.2 SC 1.4.11, nález N-A10-4). jsdom CSS nenačítá — ověřuje se třída.
    render(
      <CartProvider>
        <MemoryRouter>
          <Cart isOpen onClose={() => undefined} />
        </MemoryRouter>
      </CartProvider>,
    );
    const remove = await screen.findByRole('button', { name: 'Odebrat Toskánsko z košíku' });
    expect(remove).toHaveClass('text-gray-500');
    expect(remove).not.toHaveClass('text-gray-400');
  });
});
