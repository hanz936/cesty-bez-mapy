export const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://www.cestybezmapy.cz';
const AUTHOR_NAME = 'Jana — Cesty bez mapy';

/** Sestaví SEO meta (title/description/canonical/og) + JSON-LD Article pro článek. */
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

// Znaky, jejichž neescapovaný výskyt v <script> by mohl předčasně uzavřít tag
// nebo (u U+2028/U+2029) rozbít starší parsery. Kódové body píšeme přes hex,
// aby ve zdroji nebyly žádné neviditelné znaky.
const JSONLD_ESCAPES = [
  ['<', '\\u003c'],
  ['>', '\\u003e'],
  ['&', '\\u0026'],
  [String.fromCharCode(0x2028), '\\u2028'],
  [String.fromCharCode(0x2029), '\\u2029'],
];

/**
 * Bezpečně serializuje JSON-LD pro vložení do <script>. Dekódovaná hodnota se nemění
 * (jen syntaktická reprezentace), takže strukturovaná data zůstávají platná.
 */
export function serializeJsonLd(jsonLd) {
  let out = JSON.stringify(jsonLd);
  for (const [from, to] of JSONLD_ESCAPES) out = out.replaceAll(from, to);
  return out;
}
