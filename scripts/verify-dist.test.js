// @vitest-environment node
// Přes `verify-dist.mjs` se táhne `prerender.mjs`, a ten importuje `vite` (esbuild).
// esbuild má invariant `TextEncoder().encode() instanceof Uint8Array`, jenž v jsdom
// realmu selže → testujeme v node prostředí, stejně jako u prerenderu.
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  isNoindex,
  originProblems,
  pageProblems,
  routeForFile,
  shellProblems,
  sitemapPaths,
} from './verify-dist.mjs';

/** @param {string} href */
const canonical = (href) => `<link rel="canonical" href="${href}"/>`;
/** @param {string} route @param {string} [extra] */
const page = (route, extra = '') =>
  `<html><head><title>Stránka</title>${canonical(`https://www.cestybezmapy.cz${route}`)}${extra}</head><body></body></html>`;

describe('routeForFile', () => {
  it('mapuje soubor zpátky na routu (opak outputPathForRoute)', () => {
    expect(routeForFile('index.html')).toBe('/');
    expect(routeForFile('kontakt/index.html')).toBe('/kontakt');
    expect(routeForFile('cestovni-pruvodci/italie/recenze/index.html')).toBe('/cestovni-pruvodci/italie/recenze');
  });
});

describe('sitemapPaths', () => {
  it('vytáhne cesty, ne celé URL', () => {
    const xml = '<urlset><url><loc>https://www.cestybezmapy.cz/</loc></url><url><loc>https://www.cestybezmapy.cz/kontakt</loc></url></urlset>';
    expect(sitemapPaths(xml)).toEqual(['/', '/kontakt']);
  });
});

describe('isNoindex', () => {
  it('pozná robots meta s noindex', () => {
    expect(isNoindex('<meta name="robots" content="noindex"/>')).toBe(true);
    expect(isNoindex('<meta name="robots" content="index,follow"/>')).toBe(false);
    expect(isNoindex('<html><head></head></html>')).toBe(false);
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

describe('zapojení do buildu', () => {
  it('kontrola běží jako součást `npm run build`', () => {
    // Jako samostatný skript by nehlídala nic — CI ji spustit nemůže (pouští jen
    // `npx vite build`, prerender nemá creds ani Chromium), takže build je jediné
    // místo, kde se nad hotovým dist/ opravdu proběhne.
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.scripts.build).toContain('node scripts/verify-dist.mjs');
  });
});
