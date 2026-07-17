import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import ReviewCard from '../ui/ReviewCard';
import { fetchApprovedReviews, fetchReviewStats } from '../../lib/reviews';
import type { PublicReview } from '../../lib/reviews';
import { REVIEWS_DISCLOSURE } from './disclosure';
import { ROUTES } from '../../constants';

const PAGE_SIZE = 9;
/** Souhrnné statistiky ukazujeme až od 3 schválených recenzí (do té doby by průměr byl zavádějící). */
const STATS_THRESHOLD = 3;

export function formatReviewDate(iso: string): string {
  return new Intl.DateTimeFormat('cs-CZ', { month: 'long', year: 'numeric' }).format(new Date(iso));
}

interface ReviewsSectionProps {
  className?: string;
}

const ReviewsSection = ({ className = '' }: ReviewsSectionProps) => {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<{ count: number; average: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const [page, s] = await Promise.all([
          fetchApprovedReviews({ limit: PAGE_SIZE, offset: 0 }),
          fetchReviewStats(),
        ]);
        if (!isMounted) return;
        setReviews(page.reviews);
        setTotal(page.total);
        setStats(s);
      } catch (err) {
        if (isMounted) setError(true);
        Sentry.captureException(err, { tags: { area: 'reviews', component: 'ReviewsSection' } });
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- fire-and-forget load v useEffect
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const page = await fetchApprovedReviews({ limit: PAGE_SIZE, offset: reviews.length });
      setReviews((prev) => [...prev, ...page.reviews]);
      setTotal(page.total);
    } catch (err) {
      setError(true);
      Sentry.captureException(err, { tags: { area: 'reviews', component: 'ReviewsSection' } });
    } finally {
      setLoadingMore(false);
    }
  }, [reviews.length]);

  return (
    <div className={`py-20 ${className}`.trim()}>
      <div className="text-center mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-green-800 mb-6">Co říkají cestovatelé</h2>
        <p className="text-sm text-gray-500 max-w-3xl mx-auto mb-4">{REVIEWS_DISCLOSURE}</p>
        <div className="w-24 h-0.5 bg-gradient-to-r from-green-600 to-green-800 mx-auto"></div>
      </div>

      {loading && <p className="text-center text-gray-500">Načítám recenze…</p>}

      {!loading && error && (
        <p className="text-center text-gray-500">Recenze se nepodařilo načíst. Zkus to prosím později.</p>
      )}

      {!loading && !error && reviews.length === 0 && (
        <div className="text-center bg-white rounded-3xl p-12 shadow-sm border border-gray-100 max-w-2xl mx-auto">
          <p className="text-lg text-gray-700 mb-6">
            Zatím tu žádné recenze nejsou. Buď první, kdo se podělí o zkušenost!
          </p>
          <Link
            to={ROUTES.TRAVEL_GUIDES}
            className="inline-block bg-green-800 hover:bg-green-900 text-white px-8 py-3 rounded-2xl font-medium transition-all duration-300"
          >
            Prohlédnout průvodce
          </Link>
        </div>
      )}

      {!loading && !error && reviews.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                name={review.reviewer_name}
                rating={review.rating}
                text={review.review_text}
                productTitle={review.products?.title ?? null}
                date={formatReviewDate(review.created_at)}
                verified
                className="h-full shadow-md hover:shadow-lg"
              />
            ))}
          </div>

          {reviews.length < total && (
            <div className="text-center mt-10">
              <button
                type="button"
                onClick={() => {
                  // eslint-disable-next-line @typescript-eslint/no-floating-promises -- fire-and-forget click handler
                  handleLoadMore();
                }}
                disabled={loadingMore}
                className="bg-white hover:bg-gray-50 text-green-800 px-8 py-3 rounded-2xl font-medium border-2 border-green-800 transition-all duration-300 disabled:opacity-50"
              >
                {loadingMore ? 'Načítám…' : 'Načíst další recenze'}
              </button>
            </div>
          )}

          {stats && stats.count >= STATS_THRESHOLD && (
            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 text-center max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                <div className="text-3xl font-bold text-green-800 mb-2">{stats.average.toFixed(1).replace('.', ',')}</div>
                <div className="text-sm text-gray-500 uppercase tracking-wider">Průměrné hodnocení</div>
              </div>
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                <div className="text-3xl font-bold text-gray-800 mb-2">{stats.count}</div>
                <div className="text-sm text-gray-500 uppercase tracking-wider">
                  {stats.count === 1 ? 'Recenze' : stats.count < 5 ? 'Recenze' : 'Recenzí'}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReviewsSection;
