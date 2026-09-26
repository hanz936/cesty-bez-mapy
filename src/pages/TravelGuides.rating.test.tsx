import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CartProvider } from '../contexts';
import TravelGuides from './TravelGuides';
import { hasAnyReviews, matchesRatingRange, visibleSortOptions } from './travelGuidesFilters';

describe('hasAnyReviews', () => {
  it('false when no product has reviews', () => {
    expect(hasAnyReviews([{ reviewCount: 0 }, { reviewCount: 0 }])).toBe(false);
  });
  it('true when at least one product has a review', () => {
    expect(hasAnyReviews([{ reviewCount: 0 }, { reviewCount: 2 }])).toBe(true);
  });
  it('false for an empty list', () => {
    expect(hasAnyReviews([])).toBe(false);
  });
});

describe('visibleSortOptions', () => {
  it('nabízí „Dle hodnocení" (v plném pořadí), když recenze existují', () => {
    expect(visibleSortOptions(true)).toEqual([
      'Nejprodávanější',
      'Nejdražší',
      'Nejlevnější',
      'Dle hodnocení',
      'Nejnovější',
    ]);
  });
  it('bez recenzí vynechá přesně „Dle hodnocení", ostatní zachová v pořadí', () => {
    expect(visibleSortOptions(false)).toEqual([
      'Nejprodávanější',
      'Nejdražší',
      'Nejlevnější',
      'Nejnovější',
    ]);
  });
});

// Rozsahy tak, jak je má katalog (`ratingRanges` v TravelGuides.tsx).
const FIVE = { minRating: 5.0, exact: true };
const FOUR_HALF = { minRating: 4.5 };
const FOUR = { minRating: 4.0 };
const THREE_HALF = { minRating: 3.5 };

describe('matchesRatingRange — filtr porovnává totéž číslo, jaké ukazuje karta', () => {
  it('11 recenzí se součtem 49 (4,4545…) karta ukáže jako „4,5" → patří do „4.5+"', () => {
    expect(matchesRatingRange(49 / 11, FOUR_HALF)).toBe(true);
  });
  it('20 recenzí se součtem 99 (4,95) karta ukáže jako „5,0" → patří do „5 hvězdiček"', () => {
    expect(matchesRatingRange(99 / 20, FIVE)).toBe(true);
  });
  it('20 recenzí se součtem 79 (3,95) karta ukáže jako „4,0" → patří do „4+"', () => {
    expect(matchesRatingRange(79 / 20, FOUR)).toBe(true);
  });
  it('4,44 karta ukáže jako „4,4" → do „4.5+" nepatří (zaokrouhluje se, ne zvedá)', () => {
    expect(matchesRatingRange(4.44, FOUR_HALF)).toBe(false);
  });
  it('„5 hvězdiček" je přesná shoda: 4,94 („4,9") tam nepatří', () => {
    expect(matchesRatingRange(4.94, FIVE)).toBe(false);
  });
  it('null, undefined a 0 (bez recenzí) nepatří do žádného rozsahu', () => {
    for (const rating of [null, undefined, 0]) {
      for (const range of [FIVE, FOUR_HALF, FOUR, THREE_HALF]) {
        expect(matchesRatingRange(rating, range)).toBe(false);
      }
    }
  });
});

// Katalog se třemi průvodci, jejichž průměr z DB (12 desetinných míst) se liší od toho, co ukazuje karta.
const catalogProducts = [
  { title: 'Alfa', average_rating: 4.454545454545, review_count: 11 }, // 49/11, karta „4,5"
  { title: 'Beta', average_rating: 4.44, review_count: 25 }, // karta „4,4"
  { title: 'Gama', average_rating: 99 / 20, review_count: 20 }, // karta „5,0"
].map((p, i) => ({
  id: `p${i}`,
  description: 'Popis.',
  price: 699,
  duration: '7 dní',
  image_url: null,
  badge: null,
  category_ids: [],
  slug: p.title.toLowerCase(),
  total_sales: 0,
  created_at: '2026-07-01T00:00:00Z',
  ...p,
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    // Stejný tvar řetězu jako v TravelGuides.a11y.test.tsx: `products` i `categories` končí na `.order()`.
    from: (table: string) => {
      const rows = table === 'products' ? catalogProducts : [];
      const result = Promise.resolve({ data: rows, error: null });
      const chain = {
        eq: () => chain,
        order: () => result,
      };
      return { select: () => chain };
    },
  },
}));

describe('katalog — filtr hodnocení a jeho počty podle zaokrouhleného hodnocení', () => {
  it('počty u rozsahů i výsledek filtru „4.5+" odpovídají číslům na kartách', async () => {
    render(
      <CartProvider>
        <MemoryRouter>
          <TravelGuides />
        </MemoryRouter>
      </CartProvider>,
    );
    await screen.findByRole('button', { name: 'Cestovní průvodce: Alfa' });

    const rangeLabel = (label: RegExp) => screen.getByLabelText(label).closest('label')?.textContent;
    expect(rangeLabel(/^5 hvězdiček/)).toBe('5 hvězdiček(1)'); // Gama
    expect(rangeLabel(/^4\.5\+ hvězdiček/)).toBe('4.5+ hvězdiček(2)'); // Alfa, Gama
    expect(rangeLabel(/^4\+ hvězdiček/)).toBe('4+ hvězdiček(3)');

    fireEvent.click(screen.getByLabelText(/^4\.5\+ hvězdiček/));

    expect(screen.getByRole('button', { name: 'Cestovní průvodce: Alfa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cestovní průvodce: Gama' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cestovní průvodce: Beta' })).toBeNull();
  });
});
