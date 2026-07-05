// @ts-check
export const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://www.cestybezmapy.cz';
const AUTHOR_NAME = 'Jana — Cesty bez mapy';

/**
 * Sestaví SEO meta (title/description/canonical/og) + JSON-LD Article pro článek.
 * @param {{
 *   seo_title: string | null,
 *   title: string,
 *   seo_description: string | null,
 *   excerpt: string | null,
 *   slug: string,
 *   image_url: string | null,
 *   published_at: string | null,
 *   updated_at: string,
 * }} post
 * @param {string} [siteUrl]
 */
export function buildBlogMeta(post, siteUrl = SITE_URL) {
  const title = post.seo_title?.trim() || post.title;
  const description = post.seo_description?.trim() || post.excerpt || '';
  const canonical = `${siteUrl}/inspirace/${post.slug}`;
  const ogImage = post.image_url || `${siteUrl}/images/blog-hero.jpg`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description,
    image: post.image_url ? [post.image_url] : undefined,
    datePublished: post.published_at,
    dateModified: post.updated_at || post.published_at,
    author: { '@type': 'Person', name: AUTHOR_NAME },
    publisher: { '@type': 'Organization', name: 'Cesty bez mapy' },
    mainEntityOfPage: canonical,
  };

  return { title, description, canonical, ogImage, jsonLd };
}

/**
 * Bezpečně serializuje JSON-LD pro vložení do <script type="application/ld+json">.
 * Escapujeme `<`, `>`, `&` na unicode escape sekvence — to zabrání předčasnému
 * uzavření/vložení tagu (`</script>`, `<!--`, `<script`). Obsah se NEspouští jako JS
 * (jen parsuje jako JSON), takže U+2028/U+2029 escapovat netřeba (v JSON jsou platné).
 * Dekódovaná hodnota se nemění — strukturovaná data zůstávají platná.
 * @param {Record<string, unknown>} jsonLd
 */
export function serializeJsonLd(jsonLd) {
  return JSON.stringify(jsonLd)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}
