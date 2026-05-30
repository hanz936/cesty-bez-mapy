import { promises as fs } from 'node:fs';
import path from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';

const DIST = 'dist';
const BRAND = 'Cesty';
const STATIC_ROUTES = ['/', '/inspirace'];

/** Statické routy + /inspirace/:slug ze seznamu publikovaných článků (bez duplikátů). */
export function collectRoutes(posts) {
  const detail = (posts || []).map((p) => `/inspirace/${p.slug}`);
  return [...new Set([...STATIC_ROUTES, ...detail])];
}

/** Cesta k výstupnímu souboru pro routu (directory-index). */
export function outputPathForRoute(distDir, route) {
  if (route === '/') return path.posix.join(distDir, 'index.html');
  return path.posix.join(distDir, route.replace(/^\//, ''), 'index.html');
}

/** Ověří, že zachycené HTML je „opravdové" (ne loading shell). Jinak vyhodí. */
export function validateHtml(html, { minBytes, requireH1, brand }) {
  if (!html || html.length < minBytes) {
    throw new Error(`Prerender: HTML příliš krátké (${html?.length ?? 0} < ${minBytes} B)`);
  }
  if (requireH1 && !/<h1[\s>]/i.test(html)) {
    throw new Error('Prerender: chybí <h1> (pravděpodobně zachycen loading stav)');
  }
  if (brand && !html.includes(brand)) {
    throw new Error(`Prerender: chybí značka „${brand}" v HTML`);
  }
}

async function fetchPublishedSlugs() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Prerender: chybí VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
  const res = await fetch(
    `${url}/rest/v1/blog_posts?select=slug&published_at=not.is.null&published_at=lte.${new Date().toISOString()}`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) throw new Error(`Prerender: Supabase ${res.status}`);
  return res.json();
}

async function run() {
  const posts = await fetchPublishedSlugs();
  const routes = collectRoutes(posts);

  const server = await preview({ appType: 'spa', preview: { port: 4173, strictPort: false } });
  const base = server.resolvedUrls.local[0].replace(/\/$/, '');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    for (const route of routes) {
      await page.goto(base + route, { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('[data-prerender-ready]', { timeout: 20000 });
      const html = await page.content();
      const requireH1 = route.startsWith('/inspirace/'); // detail má vždy h1
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
