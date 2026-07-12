import { SITE_URL } from './blogSeo';

export interface ProductMetaProduct {
  detail_title: string | null;
  title: string;
  hero_subtitle: string | null;
  slug: string;
  image_url: string | null;
  price: number;
}

interface ProductOfferJsonLd {
  '@type': string;
  price: string;
  priceCurrency: string;
  availability: string;
  url: string;
}

// bestRating/worstRating vědomě vynecháno: Google je defaultuje na 5/1 (přesně naše
// škála) a docs je typují jako Number — stringy by byly doslovně mimo spec.
// ratingValue je dle docs „Number or Text" → String() je OK.
interface AggregateRatingJsonLd {
  '@type': 'AggregateRating';
  ratingValue: string;
  reviewCount: number;
}

interface ReviewJsonLd {
  '@type': 'Review';
  author: { '@type': 'Person'; name: string };
  reviewRating: { '@type': 'Rating'; ratingValue: string };
  reviewBody: string;
  datePublished: string;
}

export interface ProductMetaReviewOptions {
  rating?: { average: number; count: number };
  reviews?: { author: string; rating: number; text: string; datePublished: string }[];
}

interface ProductJsonLd {
  '@context': string;
  '@type': string;
  name: string;
  description: string;
  image: string[];
  offers: ProductOfferJsonLd;
  aggregateRating?: AggregateRatingJsonLd;
  review?: ReviewJsonLd[];
}

export interface ProductMeta {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
  jsonLd: ProductJsonLd;
}

/**
 * Per-route SEO meta + JSON-LD Product pro detail produktu.
 * `price` je celé CZK (string), `priceCurrency` "CZK" (audit SEO-03 / Google).
 */
export function buildProductMeta(
  product: ProductMetaProduct,
  options?: ProductMetaReviewOptions,
  siteUrl: string = SITE_URL,
): ProductMeta {
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string title must fall through to fallback (?? would change behavior)
  const title = product.detail_title?.trim() || product.title;
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string description must fall through to fallback (?? would change behavior)
  const description = product.hero_subtitle?.trim() || product.detail_title?.trim() || product.title;
  const canonical = `${siteUrl}/cestovni-pruvodci/${product.slug}`;
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string image_url must fall through to fallback (?? would change behavior)
  const image = product.image_url || `${siteUrl}/images/placeholder-guide.jpg`;

  const jsonLd: ProductJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description,
    image: [image],
    offers: {
      '@type': 'Offer',
      price: String(product.price),
      priceCurrency: 'CZK',
      availability: 'https://schema.org/InStock',
      url: canonical,
    },
  };

  if (options?.rating && options.rating.count > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: String(options.rating.average),
      reviewCount: options.rating.count,
    };
    if (options.reviews && options.reviews.length > 0) {
      jsonLd.review = options.reviews.map((r) => ({
        '@type': 'Review',
        author: { '@type': 'Person', name: r.author },
        reviewRating: { '@type': 'Rating', ratingValue: String(r.rating) },
        reviewBody: r.text,
        datePublished: r.datePublished,
      }));
    }
  }

  return { title, description, canonical, ogImage: image, jsonLd };
}
