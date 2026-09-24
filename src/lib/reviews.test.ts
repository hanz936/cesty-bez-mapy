import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn<(...args: unknown[]) => unknown>();
const fromMock = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('./supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
  },
}));

// Průchozí obal kolem skutečné `roundRating` — test níže ověřuje, že průměr jde přes ni
// (jediný zdroj zaokrouhlení), ne přes vlastní `Math.round` se stejným výsledkem.
vi.mock('../utils/rating', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/rating')>();
  return { ...actual, roundRating: vi.fn(actual.roundRating) };
});

import { FunctionsHttpError } from '@supabase/supabase-js';
import { roundRating } from '../utils/rating';
import { fetchApprovedReviews, fetchReviewStats, getReviewRequest, submitReview, REVIEW_COLUMNS } from './reviews';

describe('reviews data layer', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('fetchApprovedReviews selects explicit columns with product embed and range', async () => {
    const range = vi.fn().mockResolvedValue({ data: [], count: 0, error: null });
    const orderById = vi.fn().mockReturnValue({ range });
    const order = vi.fn().mockReturnValue({ order: orderById });
    const select = vi.fn().mockReturnValue({ order });
    fromMock.mockReturnValue({ select });

    await fetchApprovedReviews({ limit: 9, offset: 0 });

    expect(fromMock).toHaveBeenCalledWith('reviews');
    // Bez `withCount` se `count` NEPOSÍLÁ — je to jediná příčina 416 (rozsah mimo
    // data vrací s ním 416, bez něj `200 []`), a 416 při prerenderu shodí build.
    expect(select).toHaveBeenCalledWith(`${REVIEW_COLUMNS}, products ( title, slug )`);
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    // `id` jako rozhodující druhý klíč — bez něj je pořadí při shodných časech
    // nedefinované a offsetové stránkování může řádek zopakovat nebo přeskočit.
    expect(orderById).toHaveBeenCalledWith('id', { ascending: false });
    expect(range).toHaveBeenCalledWith(0, 8);
  });

  it('fetchApprovedReviews asks for the exact count only when withCount is set', async () => {
    const range = vi.fn().mockResolvedValue({ data: [], count: 7, error: null });
    const orderById = vi.fn().mockReturnValue({ range });
    const order = vi.fn().mockReturnValue({ order: orderById });
    const select = vi.fn().mockReturnValue({ order });
    fromMock.mockReturnValue({ select });

    const result = await fetchApprovedReviews({ limit: 9, offset: 0, withCount: true });

    expect(select).toHaveBeenCalledWith(`${REVIEW_COLUMNS}, products ( title, slug )`, { count: 'exact' });
    expect(result.total).toBe(7);
  });

  it('fetchApprovedReviews turns a 416 range error into an empty page instead of throwing', async () => {
    // PostgREST vrací na rozsah mimo data 416 s PRÁZDNÝM tělem; postgrest-js z něj
    // udělá `error = { message: '' }` bez `code` a `count` vůbec nenaplní, takže se
    // to pozná jedině podle stavu. Ověřeno proti produkci i ve zdrojích postgrest-js.
    const range = vi
      .fn()
      .mockResolvedValue({ data: null, count: null, error: { message: '' }, status: 416 });
    const orderById = vi.fn().mockReturnValue({ range });
    const order = vi.fn().mockReturnValue({ order: orderById });
    const select = vi.fn().mockReturnValue({ order });
    fromMock.mockReturnValue({ select });

    const result = await fetchApprovedReviews({ limit: 12, offset: 5000, withCount: true });

    expect(result).toEqual({ reviews: [], total: 0 });
  });

  it('fetchApprovedReviews filters by productId when provided', async () => {
    const range = vi.fn().mockResolvedValue({ data: [], count: 0, error: null });
    const eq = vi.fn().mockReturnValue({ range });
    const orderById = vi.fn().mockReturnValue({ eq });
    const order = vi.fn().mockReturnValue({ order: orderById });
    const select = vi.fn().mockReturnValue({ order });
    fromMock.mockReturnValue({ select });

    await fetchApprovedReviews({ productId: 'p1', limit: 6, offset: 0 });
    expect(eq).toHaveBeenCalledWith('product_id', 'p1');
  });

  it('fetchApprovedReviews with withProduct: false drops the products embed', async () => {
    // Stránky jednoho produktu název produktu zahodí (`productTitle={null}`), embed
    // by jen navíc spustil join a RLS `products` (audit T-11). Bez přepínače zůstává
    // embed zapnutý — `/recenze` ho potřebuje, viz první test.
    const range = vi.fn().mockResolvedValue({ data: [], count: 0, error: null });
    const eq = vi.fn().mockReturnValue({ range });
    const orderById = vi.fn().mockReturnValue({ eq });
    const order = vi.fn().mockReturnValue({ order: orderById });
    const select = vi.fn().mockReturnValue({ order });
    fromMock.mockReturnValue({ select });

    await fetchApprovedReviews({ productId: 'p1', limit: 3, offset: 0, withProduct: false });
    expect(select).toHaveBeenCalledWith(REVIEW_COLUMNS);
  });

  it('fetchReviewStats computes count and average client-side', async () => {
    const select = vi.fn().mockResolvedValue({ data: [{ rating: 4 }, { rating: 5 }], error: null });
    fromMock.mockReturnValue({ select });
    const stats = await fetchReviewStats();
    expect(stats).toEqual({ count: 2, average: 4.5 });
  });

  it('fetchReviewStats zaokrouhluje průměr sdílenou roundRating (M-8)', async () => {
    // 11 recenzí se součtem 50 → přesně 4,5454… → zobrazeno 4,5 (ne 4,6 z dvojího zaokrouhlení)
    const ratings = [5, 5, 5, 5, 5, 5, 4, 4, 4, 4, 4].map((rating) => ({ rating }));
    const select = vi.fn().mockResolvedValue({ data: ratings, error: null });
    fromMock.mockReturnValue({ select });

    const stats = await fetchReviewStats();

    expect(stats).toEqual({ count: 11, average: 4.5 });
    expect(vi.mocked(roundRating)).toHaveBeenCalledWith(50 / 11);
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
