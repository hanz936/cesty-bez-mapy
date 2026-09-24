import { promises as fs } from 'node:fs';
import path from 'node:path';
import { indexablePages } from './distPages.mjs';

/**
 * `dist/sitemap.xml` z HOTOVÉHO buildu: uvádí přesně ty předgenerované stránky, které
 * nenesou noindex (rozhodnutí usera k nálezu M-3 z finální revize).
 *
 * Dřív se sitemapa skládala z vlastního dotazu do Supabase, pár minut po dotazu
 * prerenderu. Mezi nimi mohla přibýt první schválená recenze, aktivovat se produkt
 * nebo vyjít naplánovaný článek — a `verify-dist` pak build shodil, protože se obě
 * strany neshodly. Z `dist/` žádný závod není: sitemapa slibuje jen to, co opravdu
 * vzniklo. Stejně to dělá `@astrojs/sitemap` (skládá ji ze stránek, které se postavily).
 *
 * Databázi ani proměnné prostředí nepotřebuje (`VITE_SITE_URL` je volitelná), takže
 * `npm run sitemap` jde pustit nad existujícím `dist/`.
 */
const DIST = 'dist';
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
 * Zapíše `sitemap.xml` do `dir` ze stránek, které tam už leží.
 * Adresář je parametr kvůli testu nad malým vzorovým `dist/`.
 * @param {string} [dir]
 * @param {string} [siteUrl]
 * @returns {Promise<string[]>} cesty, které sitemapa uvádí
 */
export async function writeSitemap(dir = DIST, siteUrl = SITE_URL) {
  const paths = await indexablePages(dir);
  await fs.writeFile(path.posix.join(dir, 'sitemap.xml'), buildSitemap(paths, siteUrl), 'utf8');
  return paths;
}

async function run() {
  const paths = await writeSitemap();
  console.log(`✓ sitemap.xml: ${paths.length} URL z předgenerovaných stránek → ${path.posix.join(DIST, 'sitemap.xml')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
