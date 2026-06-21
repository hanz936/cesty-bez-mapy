import { serializeJsonLd } from '../../utils/blogSeo';

/**
 * Sdílené SEO meta pro libovolnou routu. React 19 hoistuje <title>/<meta>/<link>
 * do <head>. `type` = og:type (default 'website'; blog 'article'). Produkty NEpoužívají
 * og:type='product' — to není standardní OGP globální typ (ogp.me: website/article/book/
 * profile/music/video varianty); produktovost nese JSON-LD Product, ne og:type → produkty
 * zůstávají na default 'website'.
 * JSON-LD se vykreslí jen když je v meta.jsonLd (Google čte strukturovaná data i v body).
 */
export default function SeoTags({ meta, type = 'website' }) {
  return (
    <>
      <title>{`${meta.title} | Cesty bez mapy`}</title>
      <meta name="description" content={meta.description} />
      <link rel="canonical" href={meta.canonical} />
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
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(meta.jsonLd) }}
        />
      )}
    </>
  );
}
