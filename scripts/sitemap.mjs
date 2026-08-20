import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PUBLIC_PAGES } from '../src/constants/publicRoutes.ts';
import { productDetailPath } from '../src/constants/routes.ts';
import { productReviewsPath, reviewPageRange } from '../src/constants/reviews.ts';
import { fetchBlogSlugs, fetchProductSlugs } from './contentSlugs.mjs';

/** @typedef {import('./contentSlugs.mjs').BlogSlugRow} BlogSlugRow */
/** @typedef {import('./contentSlugs.mjs').ProductSlugRow} ProductSlugRow */

const SITE_URL = process.env.VITE_SITE_URL || 'https://www.cestybezmapy.cz';

/**
 * XML entity-escape (sitemaps.org: & < > " ').
 * @param {string} s
 * @returns {string}
 */
export function xmlEscape(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/**
 * Sestaví validní sitemap.xml z relativních cest (bez duplikátů).
 * @param {string[]} paths
 * @param {string} [siteUrl]
 * @returns {string}
 */
export function buildSitemap(paths, siteUrl = SITE_URL) {
  const urls = [...new Set(paths)]
    .map((p) => `  <url>\n    <loc>${xmlEscape(`${siteUrl}${p}`)}</loc>\n  </url>`)
    .join('\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `${urls}\n` +
    '</urlset>\n'
  );
}

/**
 * Cesty do sitemapy. Stránka recenzí se uvádí jen u produktů, které recenzi mají —
 * prázdná nese noindex, a do sitemapy patří jen adresy, které chceme ve výsledcích.
 * Hlubší strany mají stejný strop jako prerender, aby sitemapa neslibovala adresy,
 * které nemají statické HTML.
 *
 * @param {BlogSlugRow[] | null | undefined} posts
 * @param {ProductSlugRow[] | null | undefined} products
 * @returns {string[]}
 */
export function collectSitemapPaths(posts, products) {
  const paths = [
    ...PUBLIC_PAGES.map((p) => p.path),
    ...(posts || []).map((p) => `/inspirace/${p.slug}`),
  ];
  for (const product of products || []) {
    paths.push(productDetailPath(product.slug));
    const { totalPages, prerenderedPages } = reviewPageRange(product.review_count);
    if (totalPages === 0) continue;
    paths.push(productReviewsPath(product.slug));
    for (let page = 2; page <= prerenderedPages; page++) {
      paths.push(productReviewsPath(product.slug, page));
    }
  }
  return paths;
}

async function run() {
  const [posts, products] = await Promise.all([fetchBlogSlugs(), fetchProductSlugs()]);
  const paths = collectSitemapPaths(posts, products);
  const xml = buildSitemap(paths);
  const out = path.posix.join('dist', 'sitemap.xml');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, xml, 'utf8');
  console.log(`✓ sitemap.xml: ${new Set(paths).size} URL → ${out}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
