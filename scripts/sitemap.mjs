import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PUBLIC_PAGES } from '../src/constants/publicRoutes.ts';
import { fetchBlogSlugs, fetchProductSlugs } from './contentSlugs.mjs';

const SITE_URL = process.env.VITE_SITE_URL || 'https://www.cestybezmapy.cz';

/** XML entity-escape (sitemaps.org: & < > " '). */
export function xmlEscape(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/** Sestaví validní sitemap.xml z relativních cest (bez duplikátů). */
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

async function run() {
  const [posts, products] = await Promise.all([fetchBlogSlugs(), fetchProductSlugs()]);
  const paths = [
    ...PUBLIC_PAGES.map((p) => p.path),
    ...posts.map((p) => `/inspirace/${p.slug}`),
    ...products.map((p) => `/cestovni-pruvodci/${p.slug}`),
  ];
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
