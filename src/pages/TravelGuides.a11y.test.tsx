import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CartProvider } from '../contexts';
import TravelGuides from './TravelGuides';

/**
 * Hodnocení na kartě průvodce nesly jen hvězdy — odečítač z něj přečetl
 * „4,7 závorka 12 závorka“. Test drží obě strany té opravy zároveň: skrytou
 * větu pro odečítač i viditelný tvar „4,7 z 5 (12)“. Kdyby se hlídala
 * jen jedna, dala by se druhá rozbít beze slova.
 */
const product = {
  id: 'p1',
  title: 'Toskánsko',
  description: 'Průvodce Toskánskem.',
  price: 699,
  duration: '7 dní',
  average_rating: 4.7,
  image_url: null,
  badge: null,
  category_ids: [],
  slug: 'toskansko',
  review_count: 12,
  total_sales: 0,
  created_at: '2026-07-01T00:00:00Z',
};

vi.mock('../lib/supabase', () => ({
  supabase: {
    // `products` končí řetěz na `.order()` po dvou `.eq()`, `categories` na `.order()`
    // rovnou — obě větve tedy musí být „thenable“ na stejném místě.
    from: (table: string) => {
      const rows = table === 'products' ? [product] : [];
      const result = Promise.resolve({ data: rows, error: null });
      const chain = {
        eq: () => chain,
        order: () => result,
      };
      return { select: () => chain };
    },
  },
}));

describe('karta průvodce — hodnocení pro odečítač', () => {
  it('vedle hvězd zní celá věta, vidět je „4,7 z 5 (12)“', async () => {
    const { container } = render(
      <CartProvider>
        <MemoryRouter>
          <TravelGuides />
        </MemoryRouter>
      </CartProvider>,
    );

    // `selector` je nutný: „Hodnocení“ je i nadpis filtru v postranním panelu.
    // Skrytý úvod na kartě je ten, který je pro oko neviditelný.
    const srPrefix = await screen.findByText('Hodnocení', { selector: '.sr-only' });
    const label = srPrefix.parentElement;
    expect(label).not.toBeNull();

    // Co uslyší odečítač: číslo dostane měřítko i jednotku.
    expect(label!.textContent).toBe('Hodnocení 4,7 z 5, 12 recenzí (12)');

    // Co uvidí oko: jmenovatel „z 5" viditelně (audit A-9 — hvězdy mají vůči bílé
    // 1,57 : 1 a 1,24 : 1, škálu by jinak nesly samy), jinak beze změny.
    const visible = Array.from(label!.childNodes)
      .filter((node) => !(node instanceof HTMLElement && node.className.includes('sr-only')))
      .map((node) => node.textContent)
      .join('');
    expect(visible).toBe('4,7 z 5 (12)');

    // Hvězdy samotné už význam nenesou, takže je odečítač musí přeskočit —
    // jinak by po větě následovalo deset bezejmenných obrázků.
    expect(label!.previousElementSibling?.getAttribute('aria-hidden')).toBe('true');

    // Pojistka, že se test dívá na kartu, a ne na prázdnou stránku.
    expect(container.textContent).toContain('Toskánsko');
  });

  it('tlačítko pro vymazání hledání má ikonu s kontrastem aspoň 3 : 1', async () => {
    // Tlačítko je jen ikona; `gray-400` má vůči bílé 2,60 : 1, `gray-500` 4,84 : 1
    // (WCAG 2.2 SC 1.4.11, nález N-A10-4). jsdom CSS nenačítá — ověřuje se třída.
    render(
      <CartProvider>
        <MemoryRouter>
          <TravelGuides />
        </MemoryRouter>
      </CartProvider>,
    );
    fireEvent.change(await screen.findByPlaceholderText(/Hledat průvodce/), { target: { value: 'Tosk' } });
    const clear = await screen.findByRole('button', { name: 'Vymazat vyhledávání' });
    expect(clear).toHaveClass('text-gray-500');
    expect(clear).not.toHaveClass('text-gray-400');
  });
});
