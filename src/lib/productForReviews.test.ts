import { describe, it, expect, vi, beforeEach } from 'vitest';

const singleMock = vi.fn<(...args: unknown[]) => unknown>();
const selectSpy = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      select: (...args: unknown[]) => {
        selectSpy(...args);
        return { eq: () => ({ eq: () => ({ eq: () => ({ single: singleMock }) }) }) };
      },
    }),
  },
}));

import { fetchProductForReviews } from './reviews';

describe('fetchProductForReviews', () => {
  beforeEach(() => vi.clearAllMocks());

  it('vrátí produkt, když existuje', async () => {
    singleMock.mockResolvedValue({
      data: {
        id: 'p1', title: 'Itálie', detail_title: 'Roadtrip po Itálii', hero_subtitle: '20 dní',
        slug: 'italie', image_url: null, average_rating: 5, review_count: 12,
      },
      error: null,
    });
    const product = await fetchProductForReviews('italie');
    expect(product?.id).toBe('p1');
    expect(product?.review_count).toBe(12);
  });

  it('vrátí null, když produkt neexistuje (PGRST116)', async () => {
    singleMock.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'no rows' } });
    await expect(fetchProductForReviews('neexistuje')).resolves.toBeNull();
  });

  it('u skutečné chyby vyhodí, aby se nevydávala za prázdno', async () => {
    singleMock.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'boom' } });
    await expect(fetchProductForReviews('italie')).rejects.toBeTruthy();
  });
});
