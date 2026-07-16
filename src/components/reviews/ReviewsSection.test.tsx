import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const fetchApprovedReviewsMock = vi.fn<(...args: unknown[]) => unknown>();
const fetchReviewStatsMock = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('../../lib/reviews', () => ({
  fetchApprovedReviews: (...args: unknown[]) => fetchApprovedReviewsMock(...args),
  fetchReviewStats: (...args: unknown[]) => fetchReviewStatsMock(...args),
}));
const captureExceptionMock = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('@sentry/react', () => ({ captureException: (...args: unknown[]) => captureExceptionMock(...args) }));

import ReviewsSection, { formatReviewDate } from './ReviewsSection';

const REVIEW = {
  id: 'r1',
  product_id: 'p1',
  reviewer_name: 'Jana N.',
  rating: 5,
  review_text: 'Skvělý průvodce, doporučuji.',
  created_at: '2026-07-01T10:00:00.000Z',
  products: { title: 'Salzburg na víkend', slug: 'salzburg' },
};

describe('ReviewsSection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('formatReviewDate renders Czech month + year', () => {
    expect(formatReviewDate('2026-07-01T10:00:00.000Z')).toBe('červenec 2026');
  });

  it('shows honest empty state with zero reviews', async () => {
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [], total: 0 });
    fetchReviewStatsMock.mockResolvedValue({ count: 0, average: 0 });
    render(<MemoryRouter><ReviewsSection /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/Zatím tu žádné recenze nejsou/)).toBeInTheDocument());
  });

  it('shows error message (not empty state) and reports to Sentry when the fetch fails', async () => {
    fetchApprovedReviewsMock.mockRejectedValue(new Error('network down'));
    fetchReviewStatsMock.mockResolvedValue({ count: 0, average: 0 });
    render(<MemoryRouter><ReviewsSection /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/nepodařilo načíst/)).toBeInTheDocument());
    expect(screen.queryByText(/Zatím tu žádné recenze nejsou/)).not.toBeInTheDocument();
    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tags: { area: 'reviews', component: 'ReviewsSection' } }),
    );
  });

  it('renders reviews with verified badge and disclosure, stats hidden under threshold', async () => {
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [REVIEW], total: 1 });
    fetchReviewStatsMock.mockResolvedValue({ count: 1, average: 5 });
    render(<MemoryRouter><ReviewsSection /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Jana N.')).toBeInTheDocument());
    expect(screen.getByText('Ověřeno nákupem')).toBeInTheDocument();
    expect(screen.getByText(/Zveřejňujeme pouze recenze zákazníků/)).toBeInTheDocument();
    expect(screen.queryByText('Průměrné hodnocení')).not.toBeInTheDocument();
  });

  it('shows stats from 3 reviews up', async () => {
    fetchApprovedReviewsMock.mockResolvedValue({
      reviews: [REVIEW, { ...REVIEW, id: 'r2' }, { ...REVIEW, id: 'r3' }],
      total: 3,
    });
    fetchReviewStatsMock.mockResolvedValue({ count: 3, average: 4.7 });
    render(<MemoryRouter><ReviewsSection /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Průměrné hodnocení')).toBeInTheDocument());
    expect(screen.getByText('4,7')).toBeInTheDocument();
  });
});
