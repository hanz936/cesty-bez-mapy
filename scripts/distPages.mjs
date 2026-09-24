import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Čtení hotového `dist/` — sdílí ho `sitemap.mjs` (sitemapa se z něj skládá)
 * a `verify-dist.mjs` (kontroluje ho). Bez prohlížeče, bez databáze a bez `vite`,
 * takže to jde pustit nad existujícím `dist/` i bez plného buildu.
 */

/**
 * Všechny `index.html` pod adresářem, relativně k němu. Skořápka `app-shell.html`
 * mezi ně nepatří — není to stránka, jen fallback rewritu.
 * @param {string} dir
 * @param {string} [prefix]
 * @returns {Promise<string[]>}
 */
export async function indexFiles(dir, prefix = '') {
  const found = [];
  for (const entry of await fs.readdir(path.posix.join(dir, prefix), { withFileTypes: true })) {
    const rel = prefix ? path.posix.join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) found.push(...(await indexFiles(dir, rel)));
    else if (entry.name === 'index.html') found.push(rel);
  }
  return found;
}

/**
 * Routa, pod kterou se soubor servíruje. Opak `outputPathForRoute` v `prerender.mjs`.
 * @param {string} relPath napr. 'kontakt/index.html'
 * @returns {string}
 */
export function routeForFile(relPath) {
  const dir = path.posix.dirname(relPath.replaceAll(path.sep, '/'));
  return dir === '.' ? '/' : `/${dir}`;
}

/**
 * Má stránka `<meta name="robots">` s noindex?
 * @param {string} html
 * @returns {boolean}
 */
export function isNoindex(html) {
  const tag = html.match(/<meta\b[^>]*\bname="robots"[^>]*>/i)?.[0];
  return /noindex/i.test(tag ?? '');
}

/**
 * Routy předgenerovaných stránek, které chceme ve vyhledávání: každý `index.html`
 * v `dist/`, který nenese noindex. Seřazené, aby byl výstup deterministický
 * (pořadí `readdir` závisí na souborovém systému).
 *
 * Google: „Include the URLs in your sitemap that you want to see in Google's search
 * results" — tedy kanonické adresy. Každá předgenerovaná stránka je kanonická sama
 * na sebe (vynucuje `validateHtml` v prerenderu a znovu `verify-dist`).
 *
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
export async function indexablePages(dir) {
  const routes = [];
  for (const rel of await indexFiles(dir)) {
    const html = await fs.readFile(path.posix.join(dir, rel), 'utf8');
    if (!isNoindex(html)) routes.push(routeForFile(rel));
  }
  return routes.sort();
}
