import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { CartProvider } from '../contexts';
import FAQ from './FAQ';

// FAQ je obalený Layoutem, který renderuje Navigation -> CartButton (potřebuje CartProvider).
// Dotazujeme se jen v rámci <main role="main">, protože Navigation obsahuje vlastní
// mobile-menu-button s aria-controls (jiný a11y pattern, inert místo hidden) — bez scope
// by .find() vždy vrátil tlačítko mobilního menu, ne FAQ accordion.
describe('FAQ accordion a11y', () => {
  it('button má aria-controls ukazující na panel; zavřený panel je hidden', () => {
    render(
      <CartProvider>
        <MemoryRouter><FAQ /></MemoryRouter>
      </CartProvider>,
    );
    // Layout renderuje vlastní <main id="main-content"> a FAQ uvnitř něj svůj <main role="main">
    // (nested) — vezmeme ten vnitřní/poslední, abychom nezachytili Navigation mimo něj.
    const mains = screen.getAllByRole('main');
    const main = mains[mains.length - 1];
    const buttons = within(main).getAllByRole('button', { expanded: false });
    const first = buttons.find((b) => b.hasAttribute('aria-controls'));
    expect(first).toBeTruthy();
    const panelId = first!.getAttribute('aria-controls');
    const panel = document.getElementById(panelId!);
    expect(panel).toBeTruthy();
    expect(panel).toHaveAttribute('hidden');
  });
});
