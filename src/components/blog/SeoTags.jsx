import { serializeJsonLd } from '../../utils/blogSeo';

/**
 * SEO meta pro detail článku. React 19 hoistuje <title>/<meta>/<link> do <head>.
 * JSON-LD se vykreslí inline (Google čte strukturovaná data i v body).
 */
export default function SeoTags({ meta }) {
  return (
    <>
      <title>{`${meta.title} | Cesty bez mapy`}</title>
      <meta name="description" content={meta.description} />
      <link rel="canonical" href={meta.canonical} />
      <meta property="og:type" content="article" />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:image" content={meta.ogImage} />
      <meta property="og:url" content={meta.canonical} />
      <meta name="twitter:card" content="summary_large_image" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(meta.jsonLd) }}
      />
    </>
  );
}
