import { serializeJsonLd } from '../../utils/blogSeo';
import type { BlogMeta } from '../../utils/blogSeo';
import type { ProductMeta, ProductReviewsMeta } from '../../utils/productSeo';
import type { BreadcrumbListJsonLd } from '../../utils/breadcrumbs';

// Structural shape covering PageMeta | BlogMeta | ProductMeta | ProductReviewsMeta (src/utils/{pageSeo,blogSeo,productSeo}.ts):
// the four differ in how they declare `jsonLd` — PageMeta not at all, BlogMeta/ProductMeta as
// required, ProductReviewsMeta as optional (a product with no reviews emits none). A plain
// union of those exported interfaces can't be used here because TS won't allow accessing
// `.jsonLd` on a union where one member lacks the property at all — this local structural type
// (jsonLd optional, typed via indexed access so all four metas stay assignable)
// is what they actually satisfy.
interface SeoTagsMeta {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
  /** Např. 'noindex' pro stránky, které nemají do indexu. */
  robots?: string;
  jsonLd?: BlogMeta['jsonLd'] | ProductMeta['jsonLd'] | ProductReviewsMeta['jsonLd'];
  /**
   * Vlastní `<script>`, ne další klíč v `jsonLd`: `BreadcrumbList` je samostatná
   * položka stránky, ne vlastnost produktu, a Google čte víc bloků na stránce
   * bez problému (dělá to tak i Datart). Zároveň tím zůstává `Product` uzel
   * bajt po bajtu takový, jaký byl — breadcrumb do něj nesahá.
   */
  breadcrumbJsonLd?: BreadcrumbListJsonLd;
}

interface SeoTagsProps {
  meta: SeoTagsMeta;
  type?: 'website' | 'article';
}

/**
 * Sdílené SEO meta pro libovolnou routu. React 19 hoistuje <title>/<meta>/<link>
 * do <head>. `type` = og:type (default 'website'; blog 'article'). Produkty NEpoužívají
 * og:type='product' — to není standardní OGP globální typ (ogp.me: website/article/book/
 * profile/music/video varianty); produktovost nese JSON-LD Product, ne og:type → produkty
 * zůstávají na default 'website'.
 * JSON-LD se vykreslí jen když je v meta.jsonLd (Google čte strukturovaná data i v body).
 */
export default function SeoTags({ meta, type = 'website' }: SeoTagsProps) {
  return (
    <>
      <title>{`${meta.title} | Cesty bez mapy`}</title>
      <meta name="description" content={meta.description} />
      <link rel="canonical" href={meta.canonical} />
      {meta.robots && <meta name="robots" content={meta.robots} />}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:image" content={meta.ogImage} />
      <meta property="og:url" content={meta.canonical} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
      {meta.jsonLd && (
        <script
          type="application/ld+json"
          // Type assertion: BlogArticleJsonLd/ProductJsonLd are interfaces, which get no
          // implicit index signature and thus don't satisfy serializeJsonLd's
          // Record<string, unknown> param — structurally they are plain JSON objects,
          // so the assertion is sound; no runtime change.
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(meta.jsonLd as unknown as Record<string, unknown>) }}
        />
      )}
      {meta.breadcrumbJsonLd && (
        <script
          type="application/ld+json"
          // Stejná type assertion a ze stejného důvodu jako o blok výš.
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(meta.breadcrumbJsonLd as unknown as Record<string, unknown>),
          }}
        />
      )}
    </>
  );
}
