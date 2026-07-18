import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeProfile } from '../lib/quizTestUtils';

const selectResult = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => selectResult()),
        })),
      })),
    })),
  },
}));
vi.mock('../utils/logger', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { useQuizProducts } from './useQuizProducts';
import logger from '../utils/logger';

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'id-1', slug: 'italie', title: 'Itálie', description: 'Popis', price: 699,
  duration: '20 dní', image_url: null, average_rating: null,
  spring_description: null, summer_description: null, autumn_description: null, winter_description: null,
  quiz_data: { version: 1, enabled: true, profile: makeProfile(2) },
  ...overrides,
});

describe('useQuizProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('vrátí jen produkty s validním a zapnutým quiz_data; nevalidní loguje a přeskočí', async () => {
    selectResult.mockResolvedValue({
      data: [
        row(),
        row({ id: 'id-2', slug: 'vypnuty', quiz_data: { version: 1, enabled: false, profile: makeProfile(2) } }),
        row({ id: 'id-3', slug: 'rozbity', quiz_data: { spatne: true } }),
        row({ id: 'id-4', slug: 'prazdny', quiz_data: {} }),
      ],
      error: null,
    });
    const { result } = renderHook(() => useQuizProducts());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.products.map((p) => p.slug)).toEqual(['italie']);
    expect(result.current.products[0].quizData.profile.season.summer).toBe(2);
    expect(logger.warn).toHaveBeenCalledTimes(2); // rozbity + prazdny
  });

  it('chyba fetche → status error; retry zkusí znovu a uspěje', async () => {
    selectResult
      .mockResolvedValueOnce({ data: null, error: { message: 'network' } })
      .mockResolvedValueOnce({ data: [row()], error: null });
    const { result } = renderHook(() => useQuizProducts());
    await waitFor(() => expect(result.current.status).toBe('error'));
    act(() => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.products).toHaveLength(1);
  });
});
