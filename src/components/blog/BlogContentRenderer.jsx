import parse, { Element } from 'html-react-parser';
import { sanitizeBlogHtml } from '../../utils/blogContent';
import YoutubeEmbed from './YoutubeEmbed';
import ProductCtaLink from './ProductCtaLink';

/**
 * Vykreslí HTML tělo článku: nejdřív DOMPurify sanitizace, pak hydratace
 * YouTube (data-youtube-id) a CTA (data-product-slug) na React komponenty.
 * Callout a galerie zůstávají jako (osanitizované) HTML stylované přes CSS.
 */
export default function BlogContentRenderer({ html, validProductSlugs }) {
  const clean = sanitizeBlogHtml(html);

  const options = {
    replace(node) {
      // Robustní typový guard (html-react-parser doporučený vzor): jen prvky s atributy.
      if (!(node instanceof Element) || !node.attribs) return undefined;
      if (node.name === 'div' && node.attribs['data-youtube-id']) {
        return <YoutubeEmbed videoId={node.attribs['data-youtube-id']} />;
      }
      if (node.name === 'a' && node.attribs['data-product-slug']) {
        const slug = node.attribs['data-product-slug'];
        const label = node.children?.[0]?.data ?? 'Zobrazit průvodce';
        return (
          <ProductCtaLink
            slug={slug}
            label={label}
            exists={validProductSlugs?.has(slug) ?? false}
          />
        );
      }
      return undefined;
    },
  };

  return <div className="blog-content prose prose-lg max-w-none">{parse(clean, options)}</div>;
}
