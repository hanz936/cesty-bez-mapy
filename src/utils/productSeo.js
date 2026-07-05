// @ts-check
import { SITE_URL } from './blogSeo';

/**
 * Per-route SEO meta + JSON-LD Product pro detail produktu.
 * `price` je celé CZK (string), `priceCurrency` "CZK" (audit SEO-03 / Google).
 * @param {{
 *   detail_title: string | null,
 *   title: string,
 *   hero_subtitle: string | null,
 *   slug: string,
 *   image_url: string | null,
 *   price: number,
 * }} product
 * @param {string} [siteUrl]
 */
export function buildProductMeta(product, siteUrl = SITE_URL) {
  const title = product.detail_title?.trim() || product.title;
  const description = product.hero_subtitle?.trim() || product.detail_title?.trim() || product.title;
  const canonical = `${siteUrl}/cestovni-pruvodci/${product.slug}`;
  const image = product.image_url || `${siteUrl}/images/placeholder-guide.jpg`;

  const jsonLd = {
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

  return { title, description, canonical, ogImage: image, jsonLd };
}
