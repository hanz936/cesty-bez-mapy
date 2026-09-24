// @vitest-environment node
// Přes `verify-dist.mjs` se táhne `prerender.mjs`, a ten importuje `vite` (esbuild).
// esbuild má invariant `TextEncoder().encode() instanceof Uint8Array`, jenž v jsdom
// realmu selže → testujeme v node prostředí, stejně jako u prerenderu.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { PUBLIC_PAGES } from '../src/constants/publicRoutes.ts';
import {
  missingStaticPages,
  originProblems,
  pageProblems,
  shellProblems,
  sitemapPaths,
  verifyDist,
} from './verify-dist.mjs';
import { writeSitemap } from './sitemap.mjs';

/** @param {string} href */
const canonical = (href) => `<link rel="canonical" href="${href}"/>`;
/** @param {string} route @param {string} [extra] */
const page = (route, extra = '') =>
  `<html><head><title>Stránka</title>${canonical(`https://www.cestybezmapy.cz${route}`)}${extra}</head><body></body></html>`;

describe('sitemapPaths', () => {
  it('vytáhne cesty, ne celé URL', () => {
    const xml = '<urlset><url><loc>https://www.cestybezmapy.cz/</loc></url><url><loc>https://www.cestybezmapy.cz/kontakt</loc></url></urlset>';
    expect(sitemapPaths(xml)).toEqual(['/', '/kontakt']);
  });
});

describe('pageProblems', () => {
  it('u zdravé stránky mlčí', () => {
    expect(pageProblems('/kontakt', page('/kontakt'))).toEqual([]);
  });

  it('najde dva titulky', () => {
    // Živá vada, kterou tenhle build ruší: dokud meta homepage bydlela v index.html,
    // nesla KAŽDÁ prerenderovaná stránka kromě `/` dva titulky — svůj a homepage.
    // `keepLast()` v prerenderu uklízí meta a canonical, titulek ne, takže to
    // neohlásilo vůbec nic.
    const html = page('/kontakt').replace('</head>', '<title>Cesty (bez) mapy</title></head>');
    expect(pageProblems('/kontakt', html)).toEqual(['/kontakt: 2× <title> (má být právě jeden)']);
  });

  it('najde chybějící canonical', () => {
    const html = '<html><head><title>x</title></head><body></body></html>';
    expect(pageProblems('/kontakt', html)).toEqual(['/kontakt: 0× canonical (má být právě jeden)']);
  });

  it('najde canonical mířící jinam', () => {
    const problems = pageProblems('/kontakt', page('/recenze'));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('canonical míří na');
  });

  it('najde zapečenou captchu', () => {
    // Podpis toho, že se skript Turnstile při prerenderu opravdu načetl — tedy že
    // blokace v `createPrerenderPage` zmizela. Bez ní produkční build padá.
    const html = page('/kontakt').replace('<body>', '<body><input name="cf-turnstile-response" value="x"/>');
    const problems = pageProblems('/kontakt', html);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('cf-turnstile-response');
  });

  it('samotná značka skriptu captchy vadou není', () => {
    // `<script id="cf-turnstile-script">` vykresluje komponenta, je v hlavičce všech
    // 29 předgenerovaných stran a s blokací nemá nic společného. Kdyby kontrola hlídala
    // tenhle řetězec, padal by každý build.
    const html = page('/kontakt', '<script id="cf-turnstile-script" src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>');
    expect(pageProblems('/kontakt', html)).toEqual([]);
  });
});

describe('shellProblems', () => {
  const shell = '<html><head><title>Cesty (bez) mapy</title></head><body><div id="root"></div></body></html>';

  it('u čisté skořápky mlčí', () => {
    expect(shellProblems(shell)).toEqual([]);
  });

  it('odmítne canonical i marker připravenosti', () => {
    const bad = shell
      .replace('</head>', `${canonical('https://www.cestybezmapy.cz/')}</head>`)
      .replace('<div id="root">', '<div id="root" data-prerender-ready="true">');
    expect(shellProblems(bad)).toEqual(['app-shell.html: nese canonical', 'app-shell.html: nese data-prerender-ready']);
  });
});

describe('originProblems', () => {
  it('jedna doména je v pořádku', () => {
    expect(originProblems(['https://www.cestybezmapy.cz/', 'https://www.cestybezmapy.cz/kontakt'])).toEqual([]);
  });
  it('dvě domény hlásí — cestu samotnou validateHtml neprozvoní', () => {
    // `validateHtml` porovnává jen cestu (aby nezávisela na VITE_SITE_URL v prostředí
    // buildu), takže rozjetá doména je přesně to, co musí zachytit až kontrola nad celkem.
    expect(originProblems(['https://www.cestybezmapy.cz/', 'http://localhost:4173/kontakt'])).toHaveLength(1);
  });
});

describe('missingStaticPages', () => {
  const all = PUBLIC_PAGES.map((p) => p.path);

  it('když má každá statická stránka soubor, mlčí', () => {
    expect(missingStaticPages([...all, '/cestovni-pruvodci/italie'])).toEqual([]);
  });

  it('chybějící statickou stránku pojmenuje', () => {
    expect(missingStaticPages(all.filter((p) => p !== '/kontakt'))).toEqual(['statická stránka /kontakt v dist/ chybí']);
  });

  it('prázdný dist/ je chyba i bez sitemapy', () => {
    // Tohle dřív prošlo: prázdná sitemapa + žádné stránky = „✓ dist/ v pořádku: 0 stránek".
    // Křížová kontrola se sitemapou totiž hlídá jen to, co sitemapa sama slibuje.
    expect(missingStaticPages([])).toHaveLength(PUBLIC_PAGES.length);
    expect(PUBLIC_PAGES.length).toBeGreaterThan(0);
  });
});

describe('verifyDist nad vzorovým dist/', () => {
  // Skutečný dist/ vzniká jen plným buildem na Vercelu (CI nemá creds ani prerender),
  // takže celý průchod kontroly se tu zkouší nad malým adresářem sestaveným v testu.
  const SITE = 'https://www.cestybezmapy.cz';
  /** @type {string[]} */
  const dirs = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  /** @param {{ skip?: string[], sitemap?: string[] }} [options] */
  const makeDist = ({ skip = [], sitemap } = {}) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'verify-dist-'));
    dirs.push(dir);
    const routes = PUBLIC_PAGES.map((p) => p.path).filter((r) => !skip.includes(r));
    for (const route of routes) {
      const file = path.join(dir, route === '/' ? '' : route.slice(1), 'index.html');
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, page(route));
    }
    writeFileSync(path.join(dir, 'app-shell.html'), '<html><head><title>Cesty (bez) mapy</title></head><body></body></html>');
    const locs = (sitemap ?? routes).map((r) => `<url><loc>${SITE}${r}</loc></url>`).join('');
    writeFileSync(path.join(dir, 'sitemap.xml'), `<urlset>${locs}</urlset>`);
    return dir;
  };

  it('úplný dist/ projde', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(verifyDist(makeDist())).resolves.toBeUndefined();
  });

  it('prázdný dist/ s prázdnou sitemapou neprojde', async () => {
    // Dřív tohle hlásilo „✓ dist/ v pořádku: 0 stránek" — křížová kontrola se sitemapou
    // hlídá jen to, co sitemapa slibuje, a prázdná neslibuje nic.
    const dir = makeDist({ skip: PUBLIC_PAGES.map((p) => p.path), sitemap: [] });
    await expect(verifyDist(dir)).rejects.toThrow('statická stránka / v dist/ chybí');
  });

  it('indexovatelnou stránku, kterou sitemapa neuvádí, najde (kontrola v obou směrech)', async () => {
    const routes = PUBLIC_PAGES.map((p) => p.path).filter((r) => r !== '/kontakt');
    const dir = makeDist({ sitemap: routes });
    await expect(verifyDist(dir)).rejects.toThrow(
      /^Kontrola dist\/ našla 1 závad:\n {2}- stránka \/kontakt je indexovatelná, ale sitemapa ji neuvádí$/,
    );
  });

  it('stránka s noindex v sitemapě chybět smí — a uvedená v ní být nesmí', async () => {
    const dir = makeDist();
    const file = path.join(dir, 'cestovni-pruvodci/italie/recenze/index.html');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, page('/cestovni-pruvodci/italie/recenze', '<meta name="robots" content="noindex"/>'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(verifyDist(dir)).resolves.toBeUndefined();

    const locs = [...PUBLIC_PAGES.map((p) => p.path), '/cestovni-pruvodci/italie/recenze']
      .map((r) => `<url><loc>${SITE}${r}</loc></url>`)
      .join('');
    writeFileSync(path.join(dir, 'sitemap.xml'), `<urlset>${locs}</urlset>`);
    await expect(verifyDist(dir)).rejects.toThrow('sitemapa uvádí /cestovni-pruvodci/italie/recenze, ale stránka nese noindex');
  });

  it('sitemapa, kterou z dist/ složí `sitemap.mjs`, kontrolou projde (build krok po kroku)', async () => {
    const dir = makeDist({ sitemap: [] });
    const file = path.join(dir, 'cestovni-pruvodci/rakousko/recenze/index.html');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, page('/cestovni-pruvodci/rakousko/recenze', '<meta name="robots" content="noindex"/>'));
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await writeSitemap(dir, SITE);

    await expect(verifyDist(dir)).resolves.toBeUndefined();
  });

  it('chybějící statickou stránku najde, i když ji nezmiňuje ani sitemapa', async () => {
    const routes = PUBLIC_PAGES.map((p) => p.path).filter((r) => r !== '/kontakt');
    const dir = makeDist({ skip: ['/kontakt'], sitemap: routes });
    await expect(verifyDist(dir)).rejects.toThrow(/^Kontrola dist\/ našla 1 závad:\n {2}- statická stránka \/kontakt v dist\/ chybí$/);
  });
});

describe('zapojení do buildu', () => {
  it('kontrola běží jako součást `npm run build`', () => {
    // Jako samostatný skript by nehlídala nic — CI ji spustit nemůže (pouští jen
    // `npx vite build`, prerender nemá creds ani Chromium), takže build je jediné
    // místo, kde se nad hotovým dist/ opravdu proběhne.
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.scripts.build).toContain('node scripts/verify-dist.mjs');
  });
});
