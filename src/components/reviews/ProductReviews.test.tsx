import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const fetchApprovedReviewsMock = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('../../lib/reviews', () => ({
  fetchApprovedReviews: (...args: unknown[]) => fetchApprovedReviewsMock(...args),
}));
const singleMock = vi.fn<(...args: unknown[]) => unknown>();
const fromMock = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => {
      fromMock(...args);
      return {
        select: () => ({
          eq: () => ({ eq: () => ({ eq: () => ({ single: singleMock }) }) }),
        }),
      };
    },
  },
}));
const captureExceptionMock = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('@sentry/react', () => ({ captureException: (...args: unknown[]) => captureExceptionMock(...args) }));

import ProductReviews from './ProductReviews';

describe('ProductReviews', () => {
  beforeEach(() => vi.clearAllMocks());

  it('empty state when product has no reviews', async () => {
    singleMock.mockResolvedValue({ data: { id: 'p1', average_rating: 0, review_count: 0 }, error: null });
    render(<MemoryRouter><ProductReviews productSlug="salzburg" /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/zatím recenzi nemá/)).toBeInTheDocument());
    expect(fetchApprovedReviewsMock).not.toHaveBeenCalled();
  });

  it('renders reviews when they exist', async () => {
    singleMock.mockResolvedValue({ data: { id: 'p1', average_rating: 5, review_count: 1 }, error: null });
    fetchApprovedReviewsMock.mockResolvedValue({
      reviews: [{
        id: 'r1', product_id: 'p1', reviewer_name: 'Jana N.', rating: 5,
        review_text: 'Skvělý průvodce.', created_at: '2026-07-01T10:00:00.000Z',
        products: { title: 'Salzburg', slug: 'salzburg' },
      }],
      total: 1,
    });
    render(<MemoryRouter><ProductReviews productSlug="salzburg" /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Jana N.')).toBeInTheDocument());
    expect(fetchApprovedReviewsMock).toHaveBeenCalledWith({ productId: 'p1', limit: 6, offset: 0 });
  });

  it('shows error message (not fake empty state) when product lookup fails', async () => {
    singleMock.mockResolvedValue({ data: null, error: { message: 'boom', code: 'XX000' } });
    render(<MemoryRouter><ProductReviews productSlug="salzburg" /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/nepodařilo načíst/)).toBeInTheDocument());
    expect(screen.queryByText(/zatím recenzi nemá/)).not.toBeInTheDocument();
    expect(fetchApprovedReviewsMock).not.toHaveBeenCalled();
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tags: { area: 'reviews', component: 'ProductReviews' } }),
    );
  });

  it('shows error message when the reviews fetch fails', async () => {
    singleMock.mockResolvedValue({ data: { id: 'p1', average_rating: 5, review_count: 1 }, error: null });
    fetchApprovedReviewsMock.mockRejectedValue(new Error('network down'));
    render(<MemoryRouter><ProductReviews productSlug="salzburg" /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/nepodařilo načíst/)).toBeInTheDocument());
    expect(screen.queryByText(/zatím recenzi nemá/)).not.toBeInTheDocument();
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tags: { area: 'reviews', component: 'ProductReviews' } }),
    );
  });

  it('hides the section entirely when the product is not found (PGRST116)', async () => {
    // Deterministický deferred resolve: jediný pevný flush by při případném dalším
    // await v load() nechal loading=true, které TAKY renderuje null → negativní
    // asserty by prošly vakuózně. Resolve až po renderu zaručuje dokončený fetch.
    let resolveSingle!: (value: { data: unknown; error: unknown }) => void;
    singleMock.mockReturnValue(new Promise((resolve) => { resolveSingle = resolve; }));
    const { container } = render(<MemoryRouter><ProductReviews productSlug="neexistuje" /></MemoryRouter>);
    await act(async () => {
      resolveSingle({ data: null, error: { message: 'No rows', code: 'PGRST116' } });
      await Promise.resolve();
    });
    expect(singleMock).toHaveBeenCalled();
    expect(container.querySelector('section')).toBeNull();
    expect(screen.queryByText(/nepodařilo načíst/)).not.toBeInTheDocument();
    expect(screen.queryByText(/zatím recenzi nemá/)).not.toBeInTheDocument();
    // PGRST116 = notFound, ne chyba: fetch recenzí nesmí vystřelit a nic se nehlásí do Sentry
    expect(fetchApprovedReviewsMock).not.toHaveBeenCalled();
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  describe('preloaded (F3 — bez duplicitního fetche)', () => {
    it('renders reviews from preloaded without calling supabase or fetchApprovedReviews', async () => {
      const preloaded = {
        productId: 'p1',
        reviewCount: 1,
        reviews: [{
          id: 'r1', product_id: 'p1', reviewer_name: 'Jana N.', rating: 5,
          review_text: 'Skvělý průvodce.', created_at: '2026-07-01T10:00:00.000Z',
          products: { title: 'Salzburg', slug: 'salzburg' },
        }],
      };
      render(
        <MemoryRouter>
          <ProductReviews productSlug="salzburg" preloaded={preloaded} />
        </MemoryRouter>,
      );
      // preloaded → žádný loading flicker, obsah je hned na prvním renderu
      expect(screen.getByText('Jana N.')).toBeInTheDocument();
      await act(async () => { await Promise.resolve(); });
      expect(fromMock).not.toHaveBeenCalled();
      expect(singleMock).not.toHaveBeenCalled();
      expect(fetchApprovedReviewsMock).not.toHaveBeenCalled();
    });

    it('renders honest empty state from preloaded with zero reviews (no fetch)', async () => {
      render(
        <MemoryRouter>
          <ProductReviews productSlug="salzburg" preloaded={{ productId: 'p1', reviewCount: 0, reviews: [] }} />
        </MemoryRouter>,
      );
      expect(screen.getByText(/zatím recenzi nemá/)).toBeInTheDocument();
      await act(async () => { await Promise.resolve(); });
      expect(fromMock).not.toHaveBeenCalled();
      expect(fetchApprovedReviewsMock).not.toHaveBeenCalled();
    });
  });
});
