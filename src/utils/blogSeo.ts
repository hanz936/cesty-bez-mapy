// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string env value must fall through to fallback (?? would change behavior)
export const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://www.cestybezmapy.cz';
const AUTHOR_NAME = 'Jana — Cesty bez mapy';

export interface BlogMetaPost {
  seo_title: string | null;
  title: string;
  seo_description: string | null;
  excerpt: string | null;
  slug: string;
  image_url: string | null;
  published_at: string | null;
  updated_at: string;
}

interface BlogArticleJsonLd {
  '@context': string;
  '@type': string;
  headline: string;
  description: string;
  image?: string[];
  datePublished: string | null;
  dateModified: string | null;
  author: { '@type': string; name: string };
  publisher: { '@type': string; name: string };
  mainEntityOfPage: string;
}

export interface BlogMeta {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
  jsonLd: BlogArticleJsonLd;
}

/**
 * Sestaví SEO meta (title/description/canonical/og) + JSON-LD Article pro článek.
 */
export function buildBlogMeta(post: BlogMetaPost, siteUrl: string = SITE_URL): BlogMeta {
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string title must fall through to fallback (?? would change behavior)
  const title = post.seo_title?.trim() || post.title;
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string description must fall through to fallback (?? would change behavior)
  const description = post.seo_description?.trim() || post.excerpt || '';
  const canonical = `${siteUrl}/inspirace/${post.slug}`;
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string image_url must fall through to fallback (?? would change behavior)
  const ogImage = post.image_url || `${siteUrl}/images/blog-hero.jpg`;

  const jsonLd: BlogArticleJsonLd = {
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
 */
export function serializeJsonLd(jsonLd: Record<string, unknown>): string {
  return JSON.stringify(jsonLd)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}
