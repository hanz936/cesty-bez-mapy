import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ReviewCard from '../ui/ReviewCard';
import { fetchApprovedReviews } from '../../lib/reviews';
import type { PublicReview } from '../../lib/reviews';
import { REVIEWS_DISCLOSURE } from './disclosure';
import { formatReviewDate } from './ReviewsSection';
import { supabase } from '../../lib/supabase';
import { ROUTES } from '../../constants';

const PRODUCT_REVIEWS_LIMIT = 6;

interface ProductReviewsProps {
  productSlug: string;
  className?: string;
}

interface ProductRatingRow {
  id: string;
  average_rating: number | null;
  review_count: number | null;
}

/**
 * Recenze jednoho produktu (resolvuje produkt podle slugu). Používá se na
 * ProductDetail a CustomItineraryDetail. S nulou recenzí ukazuje poctivý
 * empty state (sekce zůstává — disclosure je viditelný vždy).
 */
const ProductReviews = ({ productSlug, className = '' }: ProductReviewsProps) => {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const { data: product } = await supabase
          .from('products')
          .select('id, average_rating, review_count')
          .eq('slug', productSlug)
          .eq('is_active', true)
          .eq('is_deleted', false)
          .single<ProductRatingRow>();
        if (!isMounted || !product) return;
        setReviewCount(product.review_count ?? 0);
        if ((product.review_count ?? 0) > 0) {
          const page = await fetchApprovedReviews({ productId: product.id, limit: PRODUCT_REVIEWS_LIMIT, offset: 0 });
          if (isMounted) setReviews(page.reviews);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- fire-and-forget load v useEffect
    load();
    return () => {
      isMounted = false;
    };
  }, [productSlug]);

  if (loading) return null;

  return (
    <section aria-label="Recenze produktu" className={`py-16 ${className}`.trim()}>
      <div className="max-w-7xl mx-auto px-5">
        <h2 className="text-2xl sm:text-3xl font-bold text-green-800 mb-4 text-center">Recenze</h2>
        <p className="text-sm text-gray-500 max-w-3xl mx-auto mb-10 text-center">{REVIEWS_DISCLOSURE}</p>

        {reviewCount === 0 ? (
          <p className="text-center text-gray-600">
            Tento průvodce zatím nemá recenze — buď první, kdo se podělí o zkušenost!
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  name={review.reviewer_name}
                  rating={review.rating}
                  text={review.review_text}
                  productTitle={null}
                  date={formatReviewDate(review.created_at)}
                  verified
                  className="h-full shadow-md"
                />
              ))}
            </div>
            {reviewCount > PRODUCT_REVIEWS_LIMIT && (
              <div className="text-center mt-8">
                <Link to={ROUTES.REVIEWS} className="text-green-800 font-medium underline">
                  Všechny recenze ({reviewCount})
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default ProductReviews;
