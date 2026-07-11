import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Recenze mají column-level GRANT jen na těchto 6 sloupců pro anon —
 * `select('*')` by vrátil 42501. VŽDY používej explicitní výčet.
 */
export const REVIEW_COLUMNS = 'id, product_id, reviewer_name, rating, review_text, created_at';

export interface PublicReview {
  id: string;
  product_id: string;
  reviewer_name: string;
  rating: number;
  review_text: string;
  created_at: string;
  /** null = produkt už není přes RLS dostupný (deaktivovaný/smazaný) */
  products: { title: string; slug: string } | null;
}

export interface ReviewRequestProduct {
  product_id: string;
  title: string;
  image_url: string | null;
  already_reviewed: boolean;
}

export interface ReviewRequestContext {
  customer_name: string | null;
  products: ReviewRequestProduct[];
}

export async function fetchApprovedReviews(opts: {
  productId?: string;
  limit: number;
  offset: number;
}): Promise<{ reviews: PublicReview[]; total: number }> {
  let query = supabase
    .from('reviews')
    .select(`${REVIEW_COLUMNS}, products ( title, slug )`, { count: 'exact' })
    .order('created_at', { ascending: false });
  if (opts.productId) {
    query = query.eq('product_id', opts.productId);
  }
  const { data, count, error } = await query.range(opts.offset, opts.offset + opts.limit - 1);
  if (error) throw error;
  return { reviews: (data ?? []) as unknown as PublicReview[], total: count ?? 0 };
}

/** Celkový počet + průměr schválených recenzí (RLS pustí jen approved). Objem je malý — počítáme client-side. */
export async function fetchReviewStats(): Promise<{ count: number; average: number }> {
  const { data, error } = await supabase.from('reviews').select('rating');
  if (error) throw error;
  const ratings = (data ?? []).map((r) => r.rating);
  const count = ratings.length;
  const average = count === 0 ? 0 : Math.round((ratings.reduce((a, b) => a + b, 0) / count) * 10) / 10;
  return { count, average };
}

/**
 * Edge fns vracejí chybové kódy (`expired`, `already_reviewed`, `rate_limited`, …)
 * v JSON těle non-2xx odpovědi; supabase-js je hlásí jako FunctionsHttpError
 * s Response v error.context — kód je nutné vyčíst odtud, jinak by UI nikdy
 * neukázalo konkrétní hlášku.
 */
async function edgeErrorCode(error: unknown, data: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await (error.context as Response).json()) as { error?: string };
      if (typeof body?.error === 'string') return body.error;
    } catch {
      // tělo není JSON — spadne do fallbacku níže
    }
  }
  const inline = (data as { error?: string } | null)?.error;
  return inline ?? 'request_failed';
}

export async function getReviewRequest(
  token: string,
): Promise<{ ok: true; data: ReviewRequestContext } | { ok: false; error: string }> {
  const { data, error } = (await supabase.functions.invoke('get-review-request', { body: { token } })) as {
    data: unknown;
    error: unknown;
  };
  if (error || (data as { error?: string })?.error) {
    return { ok: false, error: await edgeErrorCode(error, data) };
  }
  return { ok: true, data: data as ReviewRequestContext };
}

export async function submitReview(payload: {
  token: string;
  product_id: string;
  rating: number;
  review_text: string;
  reviewer_name: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = (await supabase.functions.invoke('submit-review', { body: payload })) as {
    data: unknown;
    error: unknown;
  };
  if (error || (data as { error?: string })?.error) {
    return { ok: false, error: await edgeErrorCode(error, data) };
  }
  return { ok: true };
}
