import { SITE_URL } from './blogSeo';
import { ratingValueJsonLd } from './rating';
import type { ProductForReviews } from '../lib/reviews';

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
  '@id': string;
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
 * Jméno produktu tak, jak ho uživatel VIDÍ — `detail_title` je to, co vypisuje
 * `<h1>` na detailu i nadpis stránky recenzí. Sdílené schválně: oba `Product`
 * uzly musí mít shodné `name`, jinak je Google nemá jak spárovat, a `product.title`
 * je interní pojmenování, které se nikde nevykresluje.
 */
export function productDisplayName(product: { detail_title: string | null; title: string }): string {
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string detail_title must fall through to fallback
  return product.detail_title?.trim() || product.title;
}

/**
 * Stabilní identita produktu napříč stránkami. Detail i stránka recenzí vydávají
 * `Product` uzel; bez shodného `@id` je Google vidí jako dva různé produkty.
 * Míří na detail, protože ten je kanonickou stránkou produktu.
 */
export function productJsonLdId(slug: string, siteUrl: string = SITE_URL): string {
  return `${siteUrl}/cestovni-pruvodci/${slug}#product`;
}

function toReviewJsonLd(
  reviews: { author: string; rating: number; text: string; datePublished: string }[],
): ReviewJsonLd[] {
  return reviews.map((r) => ({
    '@type': 'Review',
    author: { '@type': 'Person', name: r.author },
    reviewRating: { '@type': 'Rating', ratingValue: String(r.rating) },
    reviewBody: r.text,
    datePublished: r.datePublished,
  }));
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
    '@id': productJsonLdId(product.slug, siteUrl),
    name: productDisplayName(product),
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
      ratingValue: ratingValueJsonLd(options.rating.average),
      reviewCount: options.rating.count,
    };
    if (options.reviews && options.reviews.length > 0) {
      jsonLd.review = toReviewJsonLd(options.reviews);
    }
  }

  return { title, description, canonical, ogImage: image, jsonLd };
}

/**
 * JSON-LD pro stránku recenzí. Google tenhle typ stránky nazývá „product snippet"
 * (na rozdíl od „merchant listing" na detailu produktu). `offers` je v jeho tabulce
 * vlastností uvedené jako **Recommended, ne Required**, a Googlův vlastní příklad
 * „Product review page" ho neobsahuje. Vynecháváme ho záměrně:
 * koupit se tu nedá a stránka tak nekonkuruje detailu produktu o roli prodejní stránky.
 *
 * Pozor: `Product` musí nést **aspoň jedno** z `review` / `aggregateRating` / `offers`.
 * Když produkt nemá recenze, nevydáváme JSON-LD vůbec — proto je v `ProductReviewsMeta`
 * volitelné.
 */
export interface ProductReviewsJsonLd {
  '@context': string;
  '@type': 'Product';
  /** Shodné s uzlem na detailu produktu — jinak jsou to pro Google dva různé produkty. */
  '@id': string;
  name: string;
  /** Perex produktu. Chybí, když ho produkt nemá — stránka by ho pak nevykreslila. */
  description?: string;
  image: string[];
  aggregateRating?: AggregateRatingJsonLd;
  review?: ReviewJsonLd[];
}

export interface ProductReviewsMeta {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
  /** Nastaveno jen když produkt nemá recenze — jinak nedefinováno. */
  robots?: string;
  /** Chybí, když produkt nemá recenze — `Product` bez review/aggregateRating/offers je neplatný. */
  jsonLd?: ProductReviewsJsonLd;
}

/** Cesta stránky recenzí produktu (strana 1 je bez segmentu `/strana`). */
export function productReviewsPath(slug: string, page = 1): string {
  const base = `/cestovni-pruvodci/${slug}/recenze`;
  return page <= 1 ? base : `${base}/strana/${page}`;
}

export function buildProductReviewsMeta(
  product: ProductForReviews,
  options: {
    page: number;
    reviews: { author: string; rating: number; text: string; datePublished: string }[];
  },
  siteUrl: string = SITE_URL,
): ProductReviewsMeta {
  // Tentýž helper jako buildProductMeta → obě stránky pošlou shodné `name`.
  const productTitle = productDisplayName(product);
  const count = product.review_count ?? 0;
  const suffix = options.page > 1 ? ` (strana ${options.page})` : '';
  const title = `Recenze — ${productTitle}${suffix}`;
  const description = count > 0
    ? `Recenze od ověřených zákazníků k průvodci ${productTitle}. Přečti si, co říkají ti, kteří s ním už cestovali.`
    : `Průvodce ${productTitle} zatím nemá recenzi. Buď první, kdo se podělí o zkušenost.`;
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string image_url must fall through to fallback
  const image = product.image_url || `${siteUrl}/images/placeholder-guide.jpg`;

  // `Product` musí nést aspoň jedno z review/aggregateRating/offers. Bez recenzí
  // by žádné z nich nebylo → radši nevydáme JSON-LD vůbec, než neplatný markup.
  let jsonLd: ProductReviewsJsonLd | undefined;
  if (count > 0) {
    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      // Shodné s uzlem na detailu produktu — bez toho Google nemá jak poznat,
      // že obě stránky mluví o tomtéž produktu.
      '@id': productJsonLdId(product.slug, siteUrl),
      // `name`, `description` i `image` musí odpovídat tomu, co je na stránce
      // VIDĚT: nadpis nese `productTitle`, perex je `hero_subtitle` a náhledový
      // obrázek je `image_url` — Task 8 všechny tři vykresluje. Kdyby je stránka
      // přestala zobrazovat, musí zmizet i odsud.
      name: productTitle,
      image: [image],
      aggregateRating: {
        '@type': 'AggregateRating',
        // Tatáž funkce jako ProductRatingSummary → zobrazená hodnota == ratingValue.
        ratingValue: ratingValueJsonLd(product.average_rating ?? 0),
        reviewCount: count,
      },
    };
    // `description` jen když perex existuje. NEPOUŽÍVAT jako fallback `description`
    // z meta tagu: ta věta je marketingový text pro výsledky vyhledávání a na
    // stránce nikde není — markovali bychom obsah, který uživatel nevidí.
    const perex = product.hero_subtitle?.trim();
    if (perex) {
      jsonLd.description = perex;
    }
    if (options.reviews.length > 0) {
      jsonLd.review = toReviewJsonLd(options.reviews);
    }
  }

  return {
    title,
    description,
    canonical: `${siteUrl}${productReviewsPath(product.slug, options.page)}`,
    ogImage: image,
    // Jen `noindex`. Google `follow` mezi platnými pravidly neuvádí — následování
    // odkazů je výchozí chování, takže `noindex, follow` je pro něj totéž co `noindex`.
    robots: count === 0 ? 'noindex' : undefined,
    jsonLd,
  };
}
