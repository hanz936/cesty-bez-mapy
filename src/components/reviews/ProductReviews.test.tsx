import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const fetchApprovedReviewsMock = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('../../lib/reviews', () => ({
  fetchApprovedReviews: (...args: unknown[]) => fetchApprovedReviewsMock(...args),
}));
const singleMock = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ eq: () => ({ eq: () => ({ single: singleMock }) }) }),
      }),
    }),
  },
}));

import ProductReviews from './ProductReviews';

describe('ProductReviews', () => {
  beforeEach(() => vi.clearAllMocks());

  it('empty state when product has no reviews', async () => {
    singleMock.mockResolvedValue({ data: { id: 'p1', average_rating: 0, review_count: 0 }, error: null });
    render(<MemoryRouter><ProductReviews productSlug="salzburg" /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/zatím nemá recenze/)).toBeInTheDocument());
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
    expect(screen.queryByText(/zatím nemá recenze/)).not.toBeInTheDocument();
    expect(fetchApprovedReviewsMock).not.toHaveBeenCalled();
  });

  it('shows error message when the reviews fetch fails', async () => {
    singleMock.mockResolvedValue({ data: { id: 'p1', average_rating: 5, review_count: 1 }, error: null });
    fetchApprovedReviewsMock.mockRejectedValue(new Error('network down'));
    render(<MemoryRouter><ProductReviews productSlug="salzburg" /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/nepodařilo načíst/)).toBeInTheDocument());
    expect(screen.queryByText(/zatím nemá recenze/)).not.toBeInTheDocument();
  });

  it('hides the section entirely when the product is not found (PGRST116)', async () => {
    singleMock.mockResolvedValue({ data: null, error: { message: 'No rows', code: 'PGRST116' } });
    const { container } = render(<MemoryRouter><ProductReviews productSlug="neexistuje" /></MemoryRouter>);
    // flush load() — po dokončení nesmí být vidět sekce, error ani empty state
    await act(async () => { await Promise.resolve(); });
    expect(singleMock).toHaveBeenCalled();
    expect(container.querySelector('section')).toBeNull();
    expect(screen.queryByText(/nepodařilo načíst/)).not.toBeInTheDocument();
    expect(screen.queryByText(/zatím nemá recenze/)).not.toBeInTheDocument();
  });
});
