// @ts-check
import { SITE_URL } from './blogSeo';
import { PUBLIC_PAGES } from '../constants/publicRoutes';

const DEFAULT_OG_IMAGE = '/images/logo.png';

/** Per-route SEO meta pro statickou veřejnou stránku (dle registru PUBLIC_PAGES). */
export function buildPageMeta(path, siteUrl = SITE_URL) {
  const entry = PUBLIC_PAGES.find((p) => p.path === path);
  if (!entry) throw new Error(`buildPageMeta: neznámá routa „${path}" (chybí v PUBLIC_PAGES)`);
  return {
    title: entry.title,
    description: entry.description,
    canonical: `${siteUrl}${path}`,
    ogImage: `${siteUrl}${DEFAULT_OG_IMAGE}`,
  };
}
