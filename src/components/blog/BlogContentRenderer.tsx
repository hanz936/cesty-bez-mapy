import parse, { Element, domToReact } from 'html-react-parser';
import type { DOMNode, HTMLReactParserOptions } from 'html-react-parser';
import { sanitizeBlogHtml } from '../../utils/blogContent';
import YoutubeEmbed from './YoutubeEmbed';
import ProductCtaLink from './ProductCtaLink';

interface BlogContentRendererProps {
  html: string;
  validProductSlugs?: Set<string>;
}

/**
 * Vykreslí HTML tělo článku: nejdřív DOMPurify sanitizace, pak hydratace
 * YouTube (data-youtube-id) a CTA (data-product-slug) na React komponenty.
 * Callout a galerie zůstávají jako (osanitizované) HTML stylované přes CSS.
 */
export default function BlogContentRenderer({ html, validProductSlugs }: BlogContentRendererProps) {
  const clean = sanitizeBlogHtml(html);

  const options: HTMLReactParserOptions = {
    replace(node: DOMNode) {
      // Robustní typový guard (html-react-parser doporučený vzor): jen prvky s atributy.
      if (!(node instanceof Element) || !node.attribs) return undefined;
      if (node.name === 'div' && node.attribs['data-youtube-id']) {
        return <YoutubeEmbed videoId={node.attribs['data-youtube-id']} />;
      }
      if (node.name === 'a' && node.attribs['data-product-slug']) {
        const slug = node.attribs['data-product-slug'];
        // Type assertion: domhandler's `Element.children` is typed `ChildNode[]` (includes
        // CDATA/Document), but html-react-parser's `domToReact` narrows its param to `DOMNode[]`
        // (excludes those two) — an upstream typing gap between the two packages, not a runtime
        // concern (parsed HTML element children are never CDATA/Document nodes here).
        const label = node.children?.length
          ? domToReact(node.children as DOMNode[], options)
          : 'Zobrazit průvodce';
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
