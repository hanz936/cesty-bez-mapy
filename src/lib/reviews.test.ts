import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn<(...args: unknown[]) => unknown>();
const fromMock = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('./supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
  },
}));

import { FunctionsHttpError } from '@supabase/supabase-js';
import { fetchApprovedReviews, fetchReviewStats, getReviewRequest, submitReview, REVIEW_COLUMNS } from './reviews';

describe('reviews data layer', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('fetchApprovedReviews selects explicit columns with product embed and range', async () => {
    const range = vi.fn().mockResolvedValue({ data: [], count: 0, error: null });
    const order = vi.fn().mockReturnValue({ range });
    const select = vi.fn().mockReturnValue({ order });
    fromMock.mockReturnValue({ select });

    await fetchApprovedReviews({ limit: 9, offset: 0 });

    expect(fromMock).toHaveBeenCalledWith('reviews');
    expect(select).toHaveBeenCalledWith(`${REVIEW_COLUMNS}, products ( title, slug )`, { count: 'exact' });
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(range).toHaveBeenCalledWith(0, 8);
  });

  it('fetchApprovedReviews filters by productId when provided', async () => {
    const range = vi.fn().mockResolvedValue({ data: [], count: 0, error: null });
    const eq = vi.fn().mockReturnValue({ range });
    const order = vi.fn().mockReturnValue({ eq });
    const select = vi.fn().mockReturnValue({ order });
    fromMock.mockReturnValue({ select });

    await fetchApprovedReviews({ productId: 'p1', limit: 6, offset: 0 });
    expect(eq).toHaveBeenCalledWith('product_id', 'p1');
  });

  it('fetchReviewStats computes count and average client-side', async () => {
    const select = vi.fn().mockResolvedValue({ data: [{ rating: 4 }, { rating: 5 }], error: null });
    fromMock.mockReturnValue({ select });
    const stats = await fetchReviewStats();
    expect(stats).toEqual({ count: 2, average: 4.5 });
  });

  it('submitReview maps edge error payload', async () => {
    invokeMock.mockResolvedValue({ data: { error: 'already_reviewed' }, error: { message: 'x' } });
    const result = await submitReview({ token: 't', product_id: 'p', rating: 5, review_text: 'dlouhy text recenze', reviewer_name: 'J' });
    expect(result.ok).toBe(false);
  });

  it('submitReview returns { ok: true } on success and posts the full payload', async () => {
    invokeMock.mockResolvedValue({ data: { success: true }, error: null });
    const payload = { token: 't', product_id: 'p', rating: 5, review_text: 'dlouhy text recenze', reviewer_name: 'J' };
    const result = await submitReview(payload);
    expect(result).toEqual({ ok: true });
    expect(invokeMock).toHaveBeenCalledWith('submit-review', { body: payload });
  });

  it('submitReview falls back to request_failed when no code is extractable (plain Error, no data)', async () => {
    invokeMock.mockResolvedValue({ data: null, error: new Error('network down') });
    const result = await submitReview({ token: 't', product_id: 'p', rating: 5, review_text: 'dlouhy text recenze', reviewer_name: 'J' });
    expect(result).toEqual({ ok: false, error: 'request_failed' });
  });

  it('getReviewRequest returns data on success', async () => {
    invokeMock.mockResolvedValue({ data: { customer_name: 'Jana', products: [] }, error: null });
    const result = await getReviewRequest('token-1');
    expect(result).toEqual({ ok: true, data: { customer_name: 'Jana', products: [] } });
  });

  it('parses error code from FunctionsHttpError body (non-2xx edge response)', async () => {
    const response = new Response(JSON.stringify({ error: 'expired' }), { status: 410 });
    invokeMock.mockResolvedValue({ data: null, error: new FunctionsHttpError(response) });
    const result = await getReviewRequest('token-1');
    expect(result).toEqual({ ok: false, error: 'expired' });
  });
});
