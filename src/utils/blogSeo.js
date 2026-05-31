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

/**
 * Bezpečně serializuje JSON-LD pro vložení do <script>: escapuje znaky, které by
 * jinak mohly předčasně uzavřít <script> tag nebo rozbít strukturovaná data
 * (`<`, `>`, `&`) i řádkové separátory U+2028/U+2029. Dekódovaná hodnota se nemění.
 */
export function serializeJsonLd(jsonLd) {
  // Používáme new RegExp, aby řetězec \\u2028/\\u2029 zůstal účinkem escape sekvencí.
  const ls = new RegExp(' ', 'g'); // U+2028 Line Separator
  const ps = new RegExp(' ', 'g'); // U+2029 Paragraph Separator
  return JSON.stringify(jsonLd)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(ls, '\\u2028')
    .replace(ps, '\\u2029');
}
