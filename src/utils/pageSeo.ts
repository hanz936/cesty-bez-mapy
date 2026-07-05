import { SITE_URL } from './blogSeo';
import { PUBLIC_PAGES } from '../constants/publicRoutes';

const DEFAULT_OG_IMAGE = '/images/logo.png';

export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
}

/**
 * Per-route SEO meta pro statickou veřejnou stránku (dle registru PUBLIC_PAGES).
 */
export function buildPageMeta(path: string, siteUrl: string = SITE_URL): PageMeta {
  const entry = PUBLIC_PAGES.find((p) => p.path === path);
  if (!entry) throw new Error(`buildPageMeta: neznámá routa „${path}" (chybí v PUBLIC_PAGES)`);
  return {
    title: entry.title,
    description: entry.description,
    canonical: `${siteUrl}${path}`,
    ogImage: `${siteUrl}${DEFAULT_OG_IMAGE}`,
  };
}
