import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
});
