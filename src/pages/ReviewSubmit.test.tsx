import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const getReviewRequestMock = vi.fn<(...args: unknown[]) => unknown>();
const submitReviewMock = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('../lib/reviews', () => ({
  getReviewRequest: (...args: unknown[]) => getReviewRequestMock(...args),
  submitReview: (...args: unknown[]) => submitReviewMock(...args),
}));
vi.mock('../components/layout/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import ReviewSubmit from './ReviewSubmit';

const renderPage = (search: string) =>
  render(
    <MemoryRouter initialEntries={[`/recenze/pridat${search}`]}>
      <ReviewSubmit />
    </MemoryRouter>,
  );

describe('ReviewSubmit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows error state without token', async () => {
    renderPage('');
    await waitFor(() =>
      expect(screen.getByText(/Odkaz není platný/)).toBeInTheDocument(),
    );
    expect(getReviewRequestMock).not.toHaveBeenCalled();
  });

  it('shows expired message', async () => {
    getReviewRequestMock.mockResolvedValue({ ok: false, error: 'expired' });
    renderPage('?token=123e4567-e89b-42d3-a456-426614174000');
    await waitFor(() =>
      expect(screen.getByText(/Platnost odkazu už bohužel vypršela/)).toBeInTheDocument(),
    );
  });

  it('renders product form with prefilled name and disclosure', async () => {
    getReviewRequestMock.mockResolvedValue({
      ok: true,
      data: {
        customer_name: 'Jana Nováková',
        products: [{ product_id: 'p1', title: 'Salzburg na víkend', image_url: null, already_reviewed: false }],
      },
    });
    renderPage('?token=123e4567-e89b-42d3-a456-426614174000');
    await waitFor(() => expect(screen.getByText('Salzburg na víkend')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Jana Nováková')).toBeInTheDocument();
    expect(screen.getByText(/Zveřejňujeme pouze recenze zákazníků/)).toBeInTheDocument();
  });

  it('marks already reviewed product as submitted', async () => {
    getReviewRequestMock.mockResolvedValue({
      ok: true,
      data: {
        customer_name: null,
        products: [{ product_id: 'p1', title: 'Salzburg', image_url: null, already_reviewed: true }],
      },
    });
    renderPage('?token=123e4567-e89b-42d3-a456-426614174000');
    await waitFor(() => expect(screen.getByText(/Recenze odeslána/)).toBeInTheDocument());
  });
});
