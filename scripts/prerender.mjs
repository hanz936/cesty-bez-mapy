import { promises as fs } from 'node:fs';
import path from 'node:path';
import { preview } from 'vite';
import { PUBLIC_PAGES } from '../src/constants/publicRoutes.ts';
import { productDetailPath } from '../src/constants/routes.ts';
import { productReviewsPath, reviewPageRange } from '../src/constants/reviews.ts';
import { fetchBlogSlugs, fetchProductSlugs, supabaseUrl } from './contentSlugs.mjs';

/** @typedef {import('./contentSlugs.mjs').BlogSlugRow} BlogSlugRow */
/** @typedef {import('./contentSlugs.mjs').ProductSlugRow} ProductSlugRow */

const DIST = 'dist';
const BRAND = 'Cesty';
/**
 * Neutrální titulek skořápky. Šablona ho po rozdělení nemá (meta homepage se
 * přestěhovala do `Home.tsx`), a bez něj by prohlížeč na neprerenderovaných
 * adresách ukazoval v záložce holou URL, dokud nedoběhne React.
 */
const SHELL_TITLE = 'Cesty (bez) mapy';
/**
 * `NotFound` se pozná podle atributu, ne podle nadpisu — texty se mění, atribut je záměr
 * (stejná volba jako u `data-loading`). Zdroj: `src/pages/NotFound.tsx`.
 */
export const NOT_FOUND_MARKER = 'data-page="not-found"';
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
 * a celý prerender běží v jediném procesu prohlížeče (viz `run()`). Nad stropem
 * strany dál fungují, jen se nepředgenerují.
 *
 * @param {BlogSlugRow[] | null | undefined} blogPosts
 * @param {ProductSlugRow[] | null | undefined} productSlugs
 * @returns {string[]}
 */
export function collectRoutes(blogPosts, productSlugs = []) {
  const blog = (blogPosts || []).map((p) => `/inspirace/${p.slug}`);
  const products = [];
  for (const product of productSlugs || []) {
    products.push(productDetailPath(product.slug));
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
 * Ověří, že zachycené HTML je „opravdové" (ne loading shell) a že patří té routě,
 * pod kterou se chystá zapsat. Jinak vyhodí.
 *
 * Marker `data-prerender-ready` sám nestačí: stránka ho může vydat natvrdo, zatímco
 * data načítá až vnořená komponenta — pak se předgeneruje loading stav a build ho
 * odbaví jako úspěch. Přesně tak skončila /recenze jako prázdný skeleton. Loading
 * stavy proto nesou `data-loading` a jejich přítomnost je tvrdá chyba. Kontrolujeme
 * atribut, ne text hlášky — texty se mění, atribut je záměr.
 *
 * `expectedPath` je povinný schválně: kdyby byl volitelný, vypadnutí argumentu na
 * volacím místě by kontrolu tiše vyplo a nic by nezčervenalo.
 *
 * Porovnává se JEN cesta, ne celá URL. Origin v HTML pochází z `VITE_SITE_URL`
 * zapečeného do bundlu při `vite build`, kdežto skript čte prostředí až za běhu —
 * rozdíl mezi nimi není vada stránky a shodil by build na něčem jiném, než co
 * hlídáme. Že všechny stránky míří na tutéž doménu, ověřuje `verify-dist.mjs`,
 * který vidí celý `dist/` najednou.
 *
 * @param {string | null | undefined} html
 * @param {{ minBytes: number, requireH1: boolean, brand: string, expectedPath: string }} limits
 * @returns {void}
 */
export function validateHtml(html, { minBytes, requireH1, brand, expectedPath }) {
  if (typeof expectedPath !== 'string' || !expectedPath.startsWith('/')) {
    throw new Error(`Prerender: validateHtml potřebuje cestu routy (expectedPath), dostal ${JSON.stringify(expectedPath)}`);
  }
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
  const canonical = canonicalHref(html);
  if (canonical === null) {
    // Po rozdělení skořápky nemá canonical ani `NotFound`, ani nic jiného, co
    // nevykresluje vlastní meta — „chybí" je proto silnější signál než „nesedí".
    throw new Error(`Prerender: ${expectedPath} nemá canonical — stránka nevykresluje vlastní meta`);
  }
  const canonicalPath = pathOf(canonical);
  if (canonicalPath !== expectedPath) {
    throw new Error(
      `Prerender: ${expectedPath} má canonical na ${canonicalPath} (${canonical}) — zachycená stránka patří jiné routě`,
    );
  }
}

/**
 * `href` z `<link rel="canonical">`, nebo null. Pořadí atributů je volné —
 * React je vypisuje jinak než ruční HTML.
 * @param {string} html
 * @returns {string | null}
 */
export function canonicalHref(html) {
  const tag = html.match(/<link\b[^>]*\brel="canonical"[^>]*>/i)?.[0];
  return tag?.match(/\bhref="([^"]*)"/i)?.[1] ?? null;
}

/**
 * Cesta z absolutní URL. Když se URL rozparsovat nedá, vrací vstup beze změny —
 * ať se v hlášce objeví to, co v HTML doopravdy stojí.
 * @param {string} href
 * @returns {string}
 */
export function pathOf(href) {
  try {
    return new URL(href).pathname;
  } catch {
    return href;
  }
}

/**
 * Vysvětlí, proč routa nikdy neohlásila `data-prerender-ready`.
 *
 * Bez toho build hlásí jen „Timeout waiting for selector" — pravdu o mechanismu,
 * ne o příčině. Ta nejčastější se přitom dá pojmenovat: routa se vyrenderovala jako
 * stránka „nenalezeno", typicky když se rozešla routa v `App.tsx` se stavitelem cesty
 * a prerender chodí na adresu, kterou router nezná. `NotFound` marker připravenosti
 * schválně nevydává (nemá co předgenerovat), takže se to projeví právě timeoutem.
 *
 * @param {string} route
 * @param {{ html?: string | null, title?: string | null, h1?: string | null }} seen
 * @returns {string}
 */
export function explainStuckPage(route, { html, title, h1 }) {
  if (html && html.includes(NOT_FOUND_MARKER)) {
    return `Prerender: ${route} se vyrenderovala jako stránka „nenalezeno" — router tuhle adresu nezná. Zkontroluj, že cestu staví tentýž zdroj, ze kterého je routa v App.tsx.`;
  }
  return `Prerender: ${route} neohlásila připravenost (data-prerender-ready) do limitu. <title>: ${title || '—'}, první <h1>: ${h1 || '—'}.`;
}

/**
 * Skořápka pro SPA rewrite: výstup `vite build` bez meta homepage, s neutrálním titulkem.
 *
 * Vzniká z `dist/index.html` DŘÍV, než ho přepíše prerender homepage — jinak by
 * rewrite `/(.*) → /app-shell` servíroval HTML s canonicalem homepage a klientský
 * kód by ho přepisoval, což Google zakazuje.
 *
 * @param {string} template
 * @returns {string}
 */
export function buildShellHtml(template) {
  if (canonicalHref(template) !== null) {
    // V tuhle chvíli má být dist/index.html čerstvý výstup `vite build`, tedy bez
    // canonicalu. Když ho obsahuje, běží prerender nad UŽ prerenderovanou homepage
    // (typicky opakované `npm run build:novite`, které samo `vite build` nespouští)
    // a do skořápky by se uložila homepage — přesně stav, který tenhle krok ruší.
    throw new Error(
      'dist/index.html už je prerenderovaný — spusť `vite build` před prerenderem, jinak by app-shell.html dostal meta homepage.',
    );
  }
  return template.replace('</head>', `  <title>${SHELL_TITLE}</title>\n  </head>`);
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
    // Prerender čte jen DOM — WebGL nepotřebuje. Ze `sparticuz.args` to odebere
    // --use-gl=angle a --use-angle=swiftshader a přidá --disable-webgl; kvůli
    // --in-process-gpu (zůstává) by GPU kód běžel ve stejném procesu jako renderer.
    // --enable-unsafe-swiftshader z příkazové řádky NEZMIZÍ: Playwright ho přidává
    // vždy sám, před uživatelské `args` (playwright-core 1.60, `_innerDefaultArgs`).
    // Odstranit by šel jen přes `ignoreDefaultArgs`, který dokumentace Playwrightu
    // označuje za nebezpečný a který jde ověřit jedině ostrým buildem na Vercelu.
    sparticuz.setGraphicsMode = false;
    return chromium.launch({
      // /dev/shm má v build containeru 64 MB (změřeno). Chromium ho přesto nepoužívá:
      // --disable-dev-shm-usage posílá Playwright sám ve výchozích přepínačích
      // (`chromiumSwitches`), takže tenhle řádek je duplicita, ne oprava — a /dev/shm
      // proto nemohl být příčinou pádů ze srpna. Zůstává jako pojistka pro případ,
      // že by ho Playwright z výchozích přepínačů vyřadil; sparticuz ho v args nemá.
      args: [...sparticuz.args, '--disable-dev-shm-usage'],
      executablePath: await sparticuz.executablePath(),
      headless: true,
    });
  }
  const { chromium } = await import('playwright');
  return chromium.launch();
}

/**
 * Stránka pro prerender. Vytvoření stránky a omezení sítě jsou schválně v JEDNÉ
 * funkci — stránku bez omezení tak nejde dostat omylem.
 *
 * Stránka smí volat jen povolené originy: lokální preview server (HTML, JS, CSS,
 * obrázky z `public/`) a Supabase (data stránek). Všechno ostatní se zahodí.
 * Dva důvody, oba změřené:
 *
 * 1. Turnstile. Bez jeho blokace build spadne v půlce prerenderu na „Target page,
 *    context or browser has been closed". NENÍ to nedostatek paměti: v okamžiku pádu
 *    bylo z 8 GB limitu využito 1,7 GB. Chromiu docházejí vlákna a deskriptory, protože
 *    každá stránka s formulářem natáhne Turnstile, ten spustí WebRTC a v build containeru
 *    bez odchozího UDP zaplaví log `sendto() … net::ERR_ADDRESS_UNREACHABLE` — a všechno
 *    se to sčítá v jediném procesu (`--single-process` chodí ze `sparticuz.args`, takže
 *    lokálně ani v CI se pád nereprodukuje). Prerender captchu nepotřebuje: widget se
 *    vykresluje až u návštěvníka.
 * 2. Cizí skripty v `<head>`. Na Vercelu tam `vite/umami-plugin.js` vkládá Umami
 *    (`VITE_UMAMI_WEBSITE_ID` je nastavené v Production) a `page.goto` s `waitUntil: 'load'`
 *    na něj čeká. Simulovaný výpadek `cloud.umami.is` shodil první routu po 30 s, a tím
 *    celý produkční build. Allowlist místo seznamu zakázaných hostů chrání i před
 *    dalším skriptem, který do hlavičky někdo přidá.
 *
 * Supabase se pouští celé, ne jen REST. Obrázky ze Storage do HTML nic nepřidají,
 * ale komponenty s `onError` (`PageHero`, `Hero`) zablokovaný obrázek nahradí náhradním
 * pozadím — a to by se zapeklo do předgenerovaného HTML.
 *
 * Vzor na všechny adresy je nutný, allowlist musí vidět každý požadavek. Užší vzor by stejně
 * nic neušetřil: Playwright při jakémkoli `page.route` pozastavuje v Chromiu všechny
 * požadavky (`Fetch.enable` se vzorem `*`) a vzor vyhodnocuje až v Node. Změřeno na
 * 30 routách: rozdíl pod 1 %. `data:` a `blob:` adresy `page.route` nezachytává.
 *
 * Kdyby omezení zmizelo, zčervená integrační test v `prerender.test.js` (opravdové
 * Chromium) a build zastaví kontrola captchy v `verify-dist.mjs` — CI totiž prerender
 * vůbec nespouští, takže jinak by se to poznalo až deploji na Vercelu.
 *
 * @param {import('playwright-core').Browser} browser
 * @param {string[]} allowedOrigins adresy, jejichž origin smí stránka volat
 * @returns {Promise<import('playwright-core').Page>}
 */
export async function createPrerenderPage(browser, allowedOrigins) {
  // Prázdný seznam by zablokoval i preview server a každá routa by spadla na timeoutu
  // s hláškou, ze které příčina není poznat.
  if (!Array.isArray(allowedOrigins) || allowedOrigins.length === 0) {
    throw new Error('Prerender: createPrerenderPage potřebuje seznam povolených originů');
  }
  const allowed = new Set(allowedOrigins.map((href) => new URL(href).origin));
  const page = await browser.newPage();
  await page.route('**/*', (route) =>
    // `blockedbyclient`, ne výchozí `failed`: `net::ERR_BLOCKED_BY_CLIENT` je podpis,
    // který síťová chyba nikdy nevyrobí (ta hlásí ERR_NAME_NOT_RESOLVED a spol.).
    // Díky tomu test pozná zahozený požadavek od požadavku, který jen neprošel sítí —
    // jinak by po smazání téhle blokace zůstal v prostředí bez internetu zelený.
    allowed.has(new URL(route.request().url()).origin) ? route.continue() : route.abort('blockedbyclient'),
  );
  return page;
}

/**
 * Chyba routy, u které má smysl druhý pokus: vypršel čas. Stránka „nenalezeno" ani
 * vadné HTML sem nepatří — napodruhé by dopadly stejně a opakování by jen zdvojnásobilo
 * dobu, než build spadne.
 */
export class RetryableRouteError extends Error {}

/**
 * Playwright hlásí vypršený čas u `goto` i `waitForSelector` jako `TimeoutError`.
 * Porovnává se jméno, ne `instanceof errors.TimeoutError`: prohlížeč pochází podle
 * prostředí jednou z `playwright`, jindy z `playwright-core` (viz `launchBrowser`).
 * @param {unknown} err
 * @returns {boolean}
 */
function isTimeout(err) {
  return err instanceof Error && err.name === 'TimeoutError';
}

/**
 * Načte routu, počká na marker připravenosti a vrátí HTML po úklidu hlavičky.
 * Nevaliduje — `validateHtml` je deterministická, takže patří až za opakování.
 *
 * @param {import('playwright-core').Page} page
 * @param {string} url
 * @param {string} route
 * @param {{ gotoTimeout?: number, readyTimeout?: number }} [timeouts] limity v ms
 * @returns {Promise<string>}
 */
export async function captureRoute(page, url, route, { gotoTimeout = 30000, readyTimeout = 20000 } = {}) {
  try {
    await page.goto(url, { waitUntil: 'load', timeout: gotoTimeout });
  } catch (err) {
    if (!isTimeout(err)) throw err;
    throw new RetryableRouteError(`Prerender: ${route} se nenačetla do ${gotoTimeout} ms.`, { cause: err });
  }
  try {
    await page.waitForSelector('[data-prerender-ready]', { timeout: readyTimeout });
  } catch (err) {
    const seen = await page.evaluate(() => ({
      html: document.documentElement.outerHTML,
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.trim() ?? null,
    }));
    const message = explainStuckPage(route, seen);
    // Stránka „nenalezeno" se napodruhé nezmění — router tu adresu prostě nezná.
    if (!isTimeout(err) || seen.html.includes(NOT_FOUND_MARKER)) throw new Error(message, { cause: err });
    throw new RetryableRouteError(message, { cause: err });
  }
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
  return page.content();
}

/**
 * `captureRoute` s jedním opakováním, když vypršel čas.
 *
 * Jeden pomalý dotaz do Supabase (nad 20 s) by jinak shodil celé nasazení — a build
 * spouští i deploy hook po schválení recenze nebo úpravě produktu, kde ho nikdo nehlídá.
 * Spadlý build nechá produkci na poslední verzi, jenže změna se pak neprojeví, dokud
 * nepřijde další. Druhý neúspěch už vybublá: neúplný web se nasadit nesmí.
 *
 * @param {import('playwright-core').Page} page
 * @param {string} url
 * @param {string} route
 * @param {{ gotoTimeout?: number, readyTimeout?: number }} [timeouts] limity v ms
 * @returns {Promise<string>}
 */
export async function captureRouteWithRetry(page, url, route, timeouts) {
  try {
    return await captureRoute(page, url, route, timeouts);
  } catch (err) {
    if (!(err instanceof RetryableRouteError)) throw err;
    console.warn(`↻ ${err.message} Zkouším ${route} ještě jednou.`);
    return captureRoute(page, url, route, timeouts);
  }
}

async function run() {
  const [posts, products] = await Promise.all([fetchBlogSlugs(), fetchProductSlugs()]);
  const routes = collectRoutes(posts, products);

  // `/` se prerenderuje do dist/index.html, takže by se skořápka jinak ztratila.
  // Odkládáme ji stranou, aby rewrite `/(.*) → /app-shell` servíroval HTML BEZ
  // meta homepage — klientský kód si ji pak smí nastavit sám.
  //
  // `DIST`, ne `distDir`: `distDir` je jen název parametru `outputPathForRoute`
  // a ve `run()` neexistuje.
  const shellPath = path.posix.join(DIST, 'app-shell.html');
  await fs.writeFile(shellPath, buildShellHtml(await fs.readFile(path.posix.join(DIST, 'index.html'), 'utf8')), 'utf8');
  console.log(`✓ skořápka → ${shellPath}`);

  const server = await preview({ appType: 'spa', preview: { port: 4173, strictPort: false, open: false } });
  const localUrl = server.resolvedUrls?.local[0];
  if (!localUrl) throw new Error('Prerender: vite preview nevrátil lokální URL');
  const base = localUrl.replace(/\/$/, '');
  // Jeden browser a jedna stránka na celý běh. Recyklovat se pod --single-process
  // nedá nic: `browser.newContext()` tam nefunguje vůbec a druhou stránku
  // v kontextu od `browser.newPage()` Playwright odmítá („Please use
  // browser.newContext()"). Restartovat browser mezi routami taky ne — měřeno,
  // pokaždé to spadlo dřív, protože `executablePath()` binárku znovu rozbaluje.
  const browser = await launchBrowser();
  // Supabase URL je tatáž proměnná, kterou si při `vite build` zapekl bundle.
  const page = await createPrerenderPage(browser, [base, supabaseUrl()]);
  // Homepage se zapisuje až PO smyčce. Během ní musí `dist/index.html` zůstat čistá
  // šablona z `vite build`, protože `vite preview` ji podává jako SPA fallback každé
  // routě, která ještě nemá vlastní soubor. Kdyby ji přepsala prerenderovaná homepage
  // (a `/` je v pořadí první), nesla by od té chvíle každá další stránka i její meta:
  // canonical sice uklidí `keepLast()`, ale `<title>` ne. Změřeno na ostrém buildu —
  // 27 stránek se dvěma titulky, ten druhý patřil domovské stránce.
  /** @type {string | null} */
  let homepageHtml = null;

  try {
    for (const route of routes) {
      const html = await captureRouteWithRetry(page, base + route, route);
      // /cestovni-pruvodci (listing) a /cestovni-pruvodci/itinerar-na-miru (statická routa)
      // také odpovídají prefixu, ale nejsou detail → vyloučit přes STATIC_ROUTES.
      const isDetail =
        (route.startsWith('/inspirace/') || route.startsWith('/cestovni-pruvodci/')) &&
        !STATIC_ROUTES.includes(route);
      const requireH1 = isDetail; // detail má vždy h1
      validateHtml(html, { minBytes: 1024, requireH1, brand: BRAND, expectedPath: route });
      if (route === '/') {
        homepageHtml = html;
        continue;
      }
      const out = outputPathForRoute(DIST, route);
      await fs.mkdir(path.dirname(out), { recursive: true });
      await fs.writeFile(out, html, 'utf8');
      console.log(`✓ prerendered ${route} → ${out} (${html.length} B)`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
  if (homepageHtml === null) throw new Error('Prerender: homepage (/) se nezachytila — bez ní by v dist/ zůstala holá šablona');
  const homeOut = outputPathForRoute(DIST, '/');
  await fs.writeFile(homeOut, homepageHtml, 'utf8');
  console.log(`✓ prerendered / → ${homeOut} (${homepageHtml.length} B)`);
  console.log(`Prerender hotovo: ${routes.length} rout.`);
}

// Spustit jen když je soubor volán přímo (ne při importu v testu).
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
