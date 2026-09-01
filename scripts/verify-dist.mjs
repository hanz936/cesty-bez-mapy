import { promises as fs } from 'node:fs';
import path from 'node:path';
import { canonicalHref, pathOf } from './prerender.mjs';

/**
 * Kontrola hotového `dist/` po buildu.
 *
 * Dělba práce s `validateHtml`: ta běží ve smyčce, per routu, PŘED zápisem — umí
 * zabránit tomu, aby vadný soubor vůbec vznikl. Tenhle skript běží jednou nad vším
 * a vidí to, co smyčka z principu nemůže: CHYBĚJÍCÍ soubory, křížovou shodu se
 * `sitemap.xml`, počty značek napříč stránkami a výstup, který prerender nevyrobil.
 * Nepotřebuje browser ani přístup k databázi, takže se dá pustit i nad existujícím
 * `dist/` bez plného buildu.
 */
const DIST = 'dist';
const SHELL = 'app-shell.html';

/**
 * Skryté pole, které do stránky vloží AŽ SPUŠTĚNÝ skript Turnstile. Značka
 * `<script src>` v hlavičce tenhle podpis nemá — ta se do HTML dostane vždycky,
 * protože ji vykresluje komponenta. Naměřeno v opravdovém Chromiu: bez blokace
 * se pole v DOM objeví, s blokací ne (348 → 212 znaků stránky).
 */
const TURNSTILE_FIELD = 'cf-turnstile-response';

/**
 * Adresy ze sitemapy jako cesty (bez originu).
 * @param {string} xml
 * @returns {string[]}
 */
export function sitemapPaths(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => pathOf(m[1]));
}

/**
 * Routa, pod kterou se soubor servíruje. Opak `outputPathForRoute`.
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
 * Závady jedné prerenderované stránky. Prázdné pole = v pořádku.
 *
 * `<title>` se počítá schválně: `keepLast()` v prerenderu uklízí `meta` a `canonical`,
 * ale titulek ne — dokud meta homepage bydlela v `index.html`, nesla každá stránka
 * dva titulky a druhý z nich byl titulek domovské stránky. Nic to nehlásilo.
 *
 * @param {string} route
 * @param {string} html
 * @returns {string[]}
 */
export function pageProblems(route, html) {
  const problems = [];
  const titles = html.match(/<title[\s>]/gi)?.length ?? 0;
  if (titles !== 1) problems.push(`${route}: ${titles}× <title> (má být právě jeden)`);
  const canonicals = html.match(/<link\b[^>]*\brel="canonical"[^>]*>/gi)?.length ?? 0;
  if (canonicals !== 1) {
    problems.push(`${route}: ${canonicals}× canonical (má být právě jeden)`);
  } else {
    const href = /** @type {string} */ (canonicalHref(html));
    if (pathOf(href) !== route) problems.push(`${route}: canonical míří na ${href}`);
  }
  // Captcha se do předgenerovaného HTML dostat nesmí: `createPrerenderPage` její
  // skript blokuje a bez té blokace padal produkční build od 18. 8. (Chromiu pod
  // `--single-process` docházela vlákna). Tohle je poslední záchyt, kdyby někdo
  // stránku vyrobil mimo tu funkci — a schválně se ptá na NEPŘÍTOMNOST, takže
  // až Turnstile z webu jednou zmizí, kontrola nezačne padat bezdůvodně.
  if (html.includes(TURNSTILE_FIELD)) {
    problems.push(`${route}: nese ${TURNSTILE_FIELD} — captcha se při prerenderu načetla, blokace nefunguje`);
  }
  return problems;
}

/**
 * Závady skořápky. Ta stránka není — je to fallback pro adresy, které prerender nemá,
 * takže nesmí nést ani canonical (přepsal by ho klientský kód, což Google zakazuje),
 * ani marker připravenosti (podle něj se pozná předgenerovaná stránka).
 * @param {string} html
 * @returns {string[]}
 */
export function shellProblems(html) {
  const problems = [];
  if (canonicalHref(html) !== null) problems.push(`${SHELL}: nese canonical`);
  if (/\sdata-prerender-ready[=\s>]/i.test(html)) problems.push(`${SHELL}: nese data-prerender-ready`);
  if ((html.match(/<title[\s>]/gi)?.length ?? 0) !== 1) problems.push(`${SHELL}: nemá právě jeden <title>`);
  return problems;
}

/**
 * Origin je jeden pro celý web. Kdyby se lišil, `validateHtml` to nepozná —
 * ta porovnává jen cestu, právě aby nezávisela na `VITE_SITE_URL` v prostředí buildu.
 * @param {string[]} hrefs
 * @returns {string[]}
 */
export function originProblems(hrefs) {
  const origins = new Set(
    hrefs.map((href) => {
      try {
        return new URL(href).origin;
      } catch {
        return href;
      }
    }),
  );
  return origins.size > 1 ? [`canonicaly míří na víc domén: ${[...origins].sort().join(', ')}`] : [];
}

/**
 * Všechny `index.html` pod adresářem, relativně k němu.
 * @param {string} dir
 * @param {string} [prefix]
 * @returns {Promise<string[]>}
 */
async function indexFiles(dir, prefix = '') {
  const found = [];
  for (const entry of await fs.readdir(path.posix.join(dir, prefix), { withFileTypes: true })) {
    const rel = prefix ? path.posix.join(prefix, entry.name) : entry.name;
    if (entry.isDirectory()) found.push(...(await indexFiles(dir, rel)));
    else if (entry.name === 'index.html') found.push(rel);
  }
  return found;
}

async function run() {
  const problems = [];
  const files = await indexFiles(DIST);
  const canonicals = [];
  const byRoute = new Map();

  for (const rel of files) {
    const route = routeForFile(rel);
    const html = await fs.readFile(path.posix.join(DIST, rel), 'utf8');
    byRoute.set(route, html);
    problems.push(...pageProblems(route, html));
    const href = canonicalHref(html);
    if (href) canonicals.push(href);
  }
  problems.push(...originProblems(canonicals));

  const shell = await fs.readFile(path.posix.join(DIST, SHELL), 'utf8').catch(() => null);
  if (shell === null) problems.push(`chybí ${SHELL} — rewrite by servíroval prerenderovanou homepage`);
  else problems.push(...shellProblems(shell));

  const xml = await fs.readFile(path.posix.join(DIST, 'sitemap.xml'), 'utf8');
  for (const route of sitemapPaths(xml)) {
    const html = byRoute.get(route);
    // Sitemapa slibuje adresy, které chceme ve výsledcích vyhledávání. Chybějící
    // soubor znamená měkkou 404 (rewrite podá skořápku), noindex znamená, že si
    // sitemapa a stránka protiřečí.
    if (html === undefined) problems.push(`sitemapa uvádí ${route}, ale soubor pro ni v dist/ není`);
    else if (isNoindex(html)) problems.push(`sitemapa uvádí ${route}, ale stránka nese noindex`);
  }

  if (problems.length > 0) {
    throw new Error(`Kontrola dist/ našla ${problems.length} závad:\n  - ${problems.join('\n  - ')}`);
  }
  console.log(`✓ dist/ v pořádku: ${files.length} stránek + skořápka, sitemapa sedí.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
