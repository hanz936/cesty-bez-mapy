import { promises as fs } from 'node:fs';
import path from 'node:path';
import { preview } from 'vite';
import { PUBLIC_PAGES } from '../src/constants/publicRoutes.ts';
import { productReviewsPath, reviewPageRange } from '../src/constants/reviews.ts';
import { fetchBlogSlugs, fetchProductSlugs } from './contentSlugs.mjs';

/** @typedef {import('./contentSlugs.mjs').BlogSlugRow} BlogSlugRow */
/** @typedef {import('./contentSlugs.mjs').ProductSlugRow} ProductSlugRow */

const DIST = 'dist';
const BRAND = 'Cesty';
const STATIC_ROUTES = PUBLIC_PAGES.map((p) => p.path);

/**
 * Statické veřejné routy + /inspirace/:slug + /cestovni-pruvodci/:slug
 * + stránky recenzí (bez duplikátů).
 *
 * Routa recenzí se generuje i pro produkt bez recenzí: neprerenderovaná adresa
 * by dostala přes rewrite index.html, a než se stihne uplatnit klientský canonical,
 * je tam ten ze zdroje. Prázdná stránka navíc nese noindex už ve zdrojovém HTML.
 *
 * Hlubší strany mají strop — každá je jedna návštěva headless Chromia navíc
 * a prerender po každých osmi routách browser restartuje. Nad stropem strany
 * dál fungují, jen se nepředgenerují.
 *
 * @param {BlogSlugRow[] | null | undefined} blogPosts
 * @param {ProductSlugRow[] | null | undefined} productSlugs
 * @returns {string[]}
 */
export function collectRoutes(blogPosts, productSlugs = []) {
  const blog = (blogPosts || []).map((p) => `/inspirace/${p.slug}`);
  const products = [];
  for (const product of productSlugs || []) {
    products.push(`/cestovni-pruvodci/${product.slug}`);
    products.push(productReviewsPath(product.slug));
    const { totalPages, prerenderedPages } = reviewPageRange(product.review_count);
    if (totalPages > prerenderedPages) {
      // Stránkování na stránce odkazy neořezává (jinak by se uživatel na hlubší
      // strany nedostal), takže od téhle chvíle existují crawlovatelné odkazy
      // na strany bez statického HTML. Není to tichá vada — je to signál strop zvednout.
      console.warn(
        `⚠ ${product.slug}: ${totalPages} stran recenzí, prerenderuje se jen ${prerenderedPages}. Zvaž zvýšení MAX_PRERENDERED_REVIEW_PAGES.`,
      );
    }
    for (let page = 2; page <= prerenderedPages; page++) {
      products.push(productReviewsPath(product.slug, page));
    }
  }
  return [...new Set([...STATIC_ROUTES, ...blog, ...products])];
}

/**
 * Cesta k výstupnímu souboru pro routu (directory-index).
 * @param {string} distDir
 * @param {string} route
 * @returns {string}
 */
export function outputPathForRoute(distDir, route) {
  if (route === '/') return path.posix.join(distDir, 'index.html');
  return path.posix.join(distDir, route.replace(/^\//, ''), 'index.html');
}

/**
 * Ověří, že zachycené HTML je „opravdové" (ne loading shell). Jinak vyhodí.
 *
 * Marker `data-prerender-ready` sám nestačí: stránka ho může vydat natvrdo, zatímco
 * data načítá až vnořená komponenta — pak se předgeneruje loading stav a build ho
 * odbaví jako úspěch. Přesně tak skončila /recenze jako prázdný skeleton. Loading
 * stavy proto nesou `data-loading` a jejich přítomnost je tvrdá chyba. Kontrolujeme
 * atribut, ne text hlášky — texty se mění, atribut je záměr.
 *
 * @param {string | null | undefined} html
 * @param {{ minBytes: number, requireH1: boolean, brand: string }} limits
 * @returns {void}
 */
export function validateHtml(html, { minBytes, requireH1, brand }) {
  if (!html || html.length < minBytes) {
    throw new Error(`Prerender: HTML příliš krátké (${html?.length ?? 0} < ${minBytes} B)`);
  }
  if (/\sdata-loading[=\s>]/i.test(html)) {
    throw new Error(
      'Prerender: HTML nese loading stav (data-loading) — stránka ohlásila připravenost dřív, než doběhla data',
    );
  }
  if (requireH1 && !/<h1[\s>]/i.test(html)) {
    throw new Error('Prerender: chybí <h1> (pravděpodobně zachycen loading stav)');
  }
  if (brand && !html.includes(brand)) {
    throw new Error(`Prerender: chybí značka „${brand}" v HTML`);
  }
}

/**
 * Spustí headless Chromium pro prerender.
 * - Na Vercelu (build container bez systémových knihoven): @sparticuz/chromium
 *   + playwright-core. Plný `playwright` Chromium by se tam nespustil.
 * - Lokálně / CI: plný `playwright` s vlastním staženým Chromiem.
 */
async function launchBrowser() {
  if (process.env.VERCEL) {
    const sparticuz = (await import('@sparticuz/chromium')).default;
    const { chromium } = await import('playwright-core');
    return chromium.launch({
      args: sparticuz.args,
      executablePath: await sparticuz.executablePath(),
      headless: true,
    });
  }
  const { chromium } = await import('playwright');
  return chromium.launch();
}

async function run() {
  const [posts, products] = await Promise.all([fetchBlogSlugs(), fetchProductSlugs()]);
  const routes = collectRoutes(posts, products);

  const server = await preview({ appType: 'spa', preview: { port: 4173, strictPort: false, open: false } });
  const localUrl = server.resolvedUrls?.local[0];
  if (!localUrl) throw new Error('Prerender: vite preview nevrátil lokální URL');
  const base = localUrl.replace(/\/$/, '');
  // Sparticuz chromium na Vercelu běží --single-process → paměť se kumuluje přes
  // všechny routy v jednom procesu a po ~14 routách se browser zabije
  // („Target page, context or browser has been closed"). Periodický relaunch
  // drží spotřebu ploše; lokální plný Playwright tím není dotčen.
  const RELAUNCH_EVERY = 8;
  let browser = await launchBrowser();
  let page = await browser.newPage();

  try {
    for (const [i, route] of routes.entries()) {
      if (i > 0 && i % RELAUNCH_EVERY === 0) {
        await browser.close();
        browser = await launchBrowser();
        page = await browser.newPage();
      }
      await page.goto(base + route, { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('[data-prerender-ready]', { timeout: 20000 });
      // React 19 hoistuje per-route <meta>/<link> ZA statické defaulty z index.html
      // (nededupuje je) → v <head> by vznikly duplicitní og:title/description/canonical.
      // Necháme poslední výskyt každého klíče (= React per-route hodnotu).
      await page.evaluate(() => {
        /**
         * @param {string} selector
         * @param {string} keyAttr
         */
        const keepLast = (selector, keyAttr) => {
          const byKey = new Map();
          for (const el of document.querySelectorAll(selector)) {
            const key = el.getAttribute(keyAttr);
            if (key == null || key === '') continue; // nesloučit prvky bez klíče
            byKey.set(key, el); // poslední vyhrává
          }
          const keep = new Set(byKey.values());
          for (const el of document.querySelectorAll(selector)) {
            if (!keep.has(el)) el.remove();
          }
        };
        keepLast('head meta[name]', 'name');
        keepLast('head meta[property]', 'property');
        keepLast('head link[rel="canonical"]', 'rel');
      });
      const html = await page.content();
      // /cestovni-pruvodci (listing) a /cestovni-pruvodci/itinerar-na-miru (statická routa)
      // také odpovídají prefixu, ale nejsou detail → vyloučit přes STATIC_ROUTES.
      const isDetail =
        (route.startsWith('/inspirace/') || route.startsWith('/cestovni-pruvodci/')) &&
        !STATIC_ROUTES.includes(route);
      const requireH1 = isDetail; // detail má vždy h1
      validateHtml(html, { minBytes: 1024, requireH1, brand: BRAND });
      const out = outputPathForRoute(DIST, route);
      await fs.mkdir(path.dirname(out), { recursive: true });
      await fs.writeFile(out, html, 'utf8');
      console.log(`✓ prerendered ${route} → ${out} (${html.length} B)`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
  console.log(`Prerender hotovo: ${routes.length} rout.`);
}

// Spustit jen když je soubor volán přímo (ne při importu v testu).
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
