// @vitest-environment node
// Tento soubor testuje čisté helpery z prerender.mjs, který importuje `vite`
// (esbuild). esbuild má invariant `TextEncoder().encode() instanceof Uint8Array`,
// jenž v jsdom realmu selže → helpery testujeme v node prostředí.
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import {
  buildShellHtml,
  canonicalHref,
  captureRouteWithRetry,
  collectRoutes,
  createPrerenderPage,
  explainStuckPage,
  NOT_FOUND_MARKER,
  outputPathForRoute,
  pathOf,
  RetryableRouteError,
  validateHtml,
} from './prerender.mjs';
import { MAX_PRERENDERED_REVIEW_PAGES } from '../src/constants/reviews.ts';

describe('collectRoutes', () => {
  it('složí veřejné statické routy + blog + produkty bez duplikátů', () => {
    const routes = collectRoutes([{ slug: 'a' }, { slug: 'a' }], [{ slug: 'tos', review_count: 0 }]);
    expect(routes).toContain('/');
    expect(routes).toContain('/kontakt');
    expect(routes).toContain('/inspirace/a');
    expect(routes).toContain('/cestovni-pruvodci/tos');
    expect(routes.filter((r) => r === '/inspirace/a')).toHaveLength(1);
  });
  it('bez obsahu vrátí jen statické veřejné routy (z PUBLIC_PAGES)', () => {
    const routes = collectRoutes([], []);
    expect(routes).toContain('/');
    expect(routes).toContain('/ochrana-osobnich-udaju');
    expect(routes).not.toContain('/cestovni-pruvodci/itinerar-na-miru/dotaznik');
  });
  it('přidá routu recenzí i produktu bez recenzí (kvůli canonicalu a noindex ve zdroji)', () => {
    const routes = collectRoutes([], [{ slug: 'tos', review_count: 0 }]);
    expect(routes).toContain('/cestovni-pruvodci/tos/recenze');
    expect(routes).not.toContain('/cestovni-pruvodci/tos/recenze/strana/2');
  });
  it('přidá další strany podle review_count (10 na stranu)', () => {
    const routes = collectRoutes([], [{ slug: 'italie', review_count: 25 }]);
    expect(routes).toContain('/cestovni-pruvodci/italie/recenze');
    expect(routes).toContain('/cestovni-pruvodci/italie/recenze/strana/2');
    expect(routes).toContain('/cestovni-pruvodci/italie/recenze/strana/3');
    expect(routes).not.toContain('/cestovni-pruvodci/italie/recenze/strana/4');
  });
  it('přesně 10 recenzí = jedna strana, žádné /strana/2', () => {
    const routes = collectRoutes([], [{ slug: 'x', review_count: 10 }]);
    expect(routes).toContain('/cestovni-pruvodci/x/recenze');
    expect(routes).not.toContain('/cestovni-pruvodci/x/recenze/strana/2');
  });
  it('chybějící review_count bere jako nulu', () => {
    const routes = collectRoutes([], [{ slug: 'x' }]);
    expect(routes).toContain('/cestovni-pruvodci/x/recenze');
    expect(routes).not.toContain('/cestovni-pruvodci/x/recenze/strana/2');
  });
  it('počet prerenderovaných stran má strop', () => {
    // 500 recenzí = 50 stran; předgenerujeme jen prvních MAX_PRERENDERED_REVIEW_PAGES.
    const routes = collectRoutes([], [{ slug: 'velky', review_count: 500 }]);
    expect(routes).toContain(`/cestovni-pruvodci/velky/recenze/strana/${MAX_PRERENDERED_REVIEW_PAGES}`);
    expect(routes).not.toContain(`/cestovni-pruvodci/velky/recenze/strana/${MAX_PRERENDERED_REVIEW_PAGES + 1}`);
  });
  it('nad stropem varuje do konzole a jmenuje produkt', () => {
    // Bez tohohle testu by smazání celého console.warn bloku nezčervenalo nic —
    // je to jediný signál, že strop byl překročen a odkazy vedou na nepredgenerované strany.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      collectRoutes([], [{ slug: 'velky', review_count: 500 }]);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('velky');
      expect(warn.mock.calls[0][0]).toContain('MAX_PRERENDERED_REVIEW_PAGES');
    } finally {
      warn.mockRestore();
    }
  });
  it('pod stropem nevaruje', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      collectRoutes([], [{ slug: 'italie', review_count: 25 }]);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

describe('outputPathForRoute', () => {
  it('mapuje routu na soubor index.html', () => {
    expect(outputPathForRoute('dist', '/')).toBe('dist/index.html');
    expect(outputPathForRoute('dist', '/inspirace')).toBe('dist/inspirace/index.html');
    expect(outputPathForRoute('dist', '/inspirace/lago')).toBe('dist/inspirace/lago/index.html');
  });
});

describe('validateHtml', () => {
  const brand = 'Cesty';
  const CANONICAL = '<link rel="canonical" href="https://www.cestybezmapy.cz/kontakt"/>';
  const limits = { minBytes: 1024, requireH1: true, brand, expectedPath: '/kontakt' };
  /**
   * Stránka, která projde vším — jednotlivé testy z ní pak berou jednu vlastnost.
   * @param {string} [extra]
   */
  const page = (extra = '') =>
    `<html><head>${CANONICAL}</head><body><h1>Nadpis</h1>${extra}` + 'x'.repeat(2000) + ' Cesty</body></html>';

  it('projde u plného HTML s h1, značkou a canonicalem na vlastní routu', () => {
    expect(() => validateHtml(page(), limits)).not.toThrow();
  });
  it('selže u prázdného/loading shellu (krátké, bez h1)', () => {
    expect(() => validateHtml('<html><body>Načítám…</body></html>', limits)).toThrow();
  });
  it('selže, když chybí značka', () => {
    const html = `<html><head>${CANONICAL}</head><body><h1>x</h1>` + 'y'.repeat(2000) + '</body></html>';
    expect(() => validateHtml(html, limits)).toThrow(/značka/);
  });
  it('selže u zachyceného loading stavu, i když má h1, značku i dost bajtů', () => {
    // Regrese P3-A: /recenze se předgenerovala jako skeleton — délka, <h1> i značka
    // seděly, protože stránka ohlásila připravenost natvrdo. Rozhoduje `data-loading`.
    expect(() => validateHtml(page('<p data-loading="true">Načítám recenze…</p>'), limits)).toThrow(/data-loading/);
  });
  it('nezamění atribut za podobně pojmenovanou třídu nebo text', () => {
    expect(() => validateHtml(page('<p class="data-loading-hint">Načítám…</p>'), limits)).not.toThrow();
  });

  it('selže, když stránka canonical vůbec nemá', () => {
    // Po rozdělení skořápky je tohle podpis zachycené cizí stránky: `NotFound` ani nic
    // jiného bez vlastních meta canonical nevydá, protože ho šablona už nedodává.
    const html = '<html><body><h1>Stránka nenalezena</h1>' + 'x'.repeat(2000) + ' Cesty</body></html>';
    expect(() => validateHtml(html, limits)).toThrow(/nemá canonical/);
  });
  it('selže, když canonical patří jiné routě', () => {
    // Tichá vada, kvůli které kontrola vznikla: pod adresou A se zapíše stránka B.
    expect(() => validateHtml(page(), { ...limits, expectedPath: '/recenze' })).toThrow(/patří jiné routě/);
  });
  it('porovnává jen cestu, ne doménu', () => {
    // Origin v HTML pochází z `VITE_SITE_URL` zapečeného do bundlu, skript čte prostředí
    // až za běhu — rozdíl mezi nimi není vada stránky a nesmí shodit build.
    const html = page().replace('https://www.cestybezmapy.cz', 'http://localhost:4173');
    expect(() => validateHtml(html, limits)).not.toThrow();
  });
  it('bez expectedPath se odmítne spustit', () => {
    // Kdyby byl argument volitelný, jeho vypadnutí na volacím místě by kontrolu
    // tiše vyplo a žádný test by nezčervenal.
    // `@ts-expect-error` je tu i důkaz: kdyby `expectedPath` v typu povinný nebyl,
    // řádek by přestal chybovat a `tsc` by na nepoužitou direktivu upozornil.
    // @ts-expect-error chybějící expectedPath je přesně to, co test ověřuje
    expect(() => validateHtml(page(), { minBytes: 1024, requireH1: true, brand })).toThrow(/expectedPath/);
  });
});

describe('canonicalHref', () => {
  it('najde href bez ohledu na pořadí atributů', () => {
    expect(canonicalHref('<link rel="canonical" href="/a"/>')).toBe('/a');
    expect(canonicalHref('<link href="/b" rel="canonical"/>')).toBe('/b');
  });
  it('vrací null, když canonical není', () => {
    expect(canonicalHref('<link rel="icon" href="/favicon.png"/>')).toBeNull();
  });
});

describe('pathOf', () => {
  it('vytáhne cestu z absolutní URL', () => {
    expect(pathOf('https://www.cestybezmapy.cz/kontakt')).toBe('/kontakt');
    expect(pathOf('https://www.cestybezmapy.cz/')).toBe('/');
  });
  it('nerozparsovatelný vstup vrací beze změny, ať je v hlášce vidět', () => {
    expect(pathOf('//nesmysl')).toBe('//nesmysl');
  });
});

describe('explainStuckPage', () => {
  it('pojmenuje zachycenou stránku „nenalezeno\u201c', () => {
    // P3-D: bez tohohle build hlásí jen „Timeout waiting for selector" — pravdu
    // o mechanismu, ne o příčině.
    const msg = explainStuckPage('/cestovni-pruvodci/x', { html: '<div data-page="not-found">…</div>' });
    expect(msg).toContain('/cestovni-pruvodci/x');
    expect(msg).toMatch(/nenalezeno/);
  });
  it('marker, který hledá, na stránce 404 opravdu je', () => {
    // Jinak nesvazuje obě strany nic: smazání atributu v `NotFound.tsx` by nechalo
    // celou sadu zelenou (testy výš si marker píšou samy) a build by se vrátil
    // k hlášce „Timeout waiting for selector", kvůli které tahle diagnostika vznikla.
    // Čteme cestou relativní ke kořeni projektu (cwd Vitestu) — viz `routes.test.ts`.
    expect(readFileSync('src/pages/NotFound.tsx', 'utf8')).toContain(NOT_FOUND_MARKER);
  });

  it('u jiné příčiny vypíše aspoň to, co stránka ukazovala', () => {
    const msg = explainStuckPage('/kontakt', { html: '<div>…</div>', title: 'Kontakt', h1: 'Napiš mi' });
    expect(msg).toContain('/kontakt');
    expect(msg).toContain('Kontakt');
    expect(msg).toContain('Napiš mi');
    expect(msg).not.toMatch(/nenalezeno/);
  });
});

describe('buildShellHtml', () => {
  const template = '<!doctype html><html><head><meta charset="UTF-8" />\n  </head><body><div id="root"></div></body></html>';

  it('doplní neutrální titulek, protože šablona už žádný nemá', () => {
    const shell = buildShellHtml(template);
    expect(shell).toContain('<title>Cesty (bez) mapy</title>');
    expect(shell.match(/<title[\s>]/g)).toHaveLength(1);
  });
  it('skořápka nenese canonical ani marker připravenosti', () => {
    // Canonical by klientský kód přepisoval (Google to zakazuje) a marker by z fallbacku
    // udělal „předgenerovanou stránku" pro každou adresu, která na něj spadne.
    const shell = buildShellHtml(template);
    expect(canonicalHref(shell)).toBeNull();
    expect(shell).not.toMatch(/data-prerender-ready/);
  });
  it('odmítne už prerenderovanou homepage', () => {
    // Opakované `build:novite` nespouští `vite build`, takže dist/index.html je tou dobou
    // homepage — a do skořápky by se uložila i s jejím canonicalem.
    expect(() => buildShellHtml(template.replace('</head>', '<link rel="canonical" href="https://www.cestybezmapy.cz/"/></head>'))).toThrow(
      /už je prerenderovaný/,
    );
  });
});

/**
 * Lokální HTTP server pro testy v opravdovém Chromiu — ať testy nezávisí na internetu.
 * @param {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void} handler
 * @returns {Promise<{ origin: string, close: () => Promise<void> }>}
 */
async function startServer(handler) {
  const server = createServer(handler);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(undefined));
  });
  const { port } = /** @type {import('node:net').AddressInfo} */ (server.address());
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve) => {
        // Zadržené odpovědi (test na vypršený `goto`) by jinak `close` blokovaly.
        server.closeAllConnections();
        server.close(() => resolve(undefined));
      }),
  };
}

describe('createPrerenderPage', () => {
  it('v opravdovém Chromiu pustí jen povolené originy, zbytek zahodí', async () => {
    // Tohle je jediná automatická brána, která omezení sítě hlídá: CI prerender vůbec
    // nespouští (`npx vite build`), takže jeho smazání by se jinak poznalo až
    // spadlým produkčním buildem na Vercelu — přesně jak se to od 18. 8. dělo.
    //
    // Test schválně nepoužívá dvojníka `page`/`route`: dvojník by zůstal zelený i
    // po tom, co by Playwright metodu přejmenoval nebo změnil chování `abort()`.
    // Změřeno: celé kolo stojí ~0,7 s (spuštění prohlížeče 0,47 s) a Chromium už
    // v CI je — stahuje ho `scripts/postinstall.mjs` při `npm ci`.
    //
    // Dva povolené servery zastupují preview a Supabase; třetí běží na stejném hostu,
    // jen na jiném portu — a musí projít sítem, protože se povoluje origin, ne host.
    const { chromium } = await import('playwright');
    /** @type {string[]} */
    const doruceno = [];
    /** @param {string} jmeno */
    const js = (jmeno) => startServer((req, res) => {
      doruceno.push(`${jmeno}${req.url ?? ''}`);
      res.writeHead(200, { 'content-type': 'text/javascript' });
      res.end('/* ok */');
    });
    const [preview, supabase, cizi] = await Promise.all([js('preview'), js('supabase'), js('cizi')]);

    const browser = await chromium.launch();
    try {
      const page = await createPrerenderPage(browser, [`${preview.origin}/`, `${supabase.origin}/rest/v1`]);
      /** @type {{ url: string; duvod: string }[]} */
      const zahozeno = [];
      page.on('requestfailed', (request) =>
        zahozeno.push({ url: request.url(), duvod: request.failure()?.errorText ?? '' }),
      );

      await page.setContent(
        '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>' +
          '<script defer src="https://cloud.umami.is/script.js"></script>' +
          `<script src="${cizi.origin}/cizi.js"></script>` +
          `<script src="${preview.origin}/vlastni.js"></script>` +
          `<script src="${supabase.origin}/rest/v1/products"></script>`,
        { waitUntil: 'load' },
      );

      // Ptáme se na DŮVOD, ne jen na to, že požadavek neprošel: `ERR_BLOCKED_BY_CLIENT`
      // umí vyrobit jedině `route.abort('blockedbyclient')` z `createPrerenderPage`.
      // Kdyby test hlídal pouhé selhání, zůstal by po smazání blokace zelený všude,
      // kde na challenges.cloudflare.com stejně není vidět — třeba v běhu bez sítě.
      // Chromium k tomu připojuje příponu (naměřeno `net::ERR_BLOCKED_BY_CLIENT.Inspector`),
      // takže porovnáváme začátek — přípona se smí změnit, rozlišovací síla zůstává.
      expect(zahozeno.map((r) => r.url).sort()).toEqual(
        [
          'https://challenges.cloudflare.com/turnstile/v0/api.js',
          'https://cloud.umami.is/script.js',
          `${cizi.origin}/cizi.js`,
        ].sort(),
      );
      for (const r of zahozeno) expect(r.duvod).toMatch(/^net::ERR_BLOCKED_BY_CLIENT/);
      expect(doruceno.sort()).toEqual(['preview/vlastni.js', 'supabase/rest/v1/products']);
    } finally {
      await browser.close();
      await Promise.all([preview.close(), supabase.close(), cizi.close()]);
    }
  }, 60_000);

  it('bez seznamu povolených originů odmítne stránku vyrobit', async () => {
    // Prázdný seznam by zablokoval i preview server a build by padal na timeoutu,
    // ze kterého příčina není poznat. Prohlížeč se ke kontrole nedostane.
    const browser = /** @type {import('playwright-core').Browser} */ ({});
    await expect(createPrerenderPage(browser, [])).rejects.toThrow(/povolených originů/);
  });
});

describe('captureRouteWithRetry', () => {
  // Krátké limity, ať test netrvá desítky sekund; logika je stejná jako s produkčními.
  const LIMITS = { gotoTimeout: 1000, readyTimeout: 300 };
  const READY = '<html><head><title>x</title></head><body><div data-prerender-ready="true"><h1>Hotovo</h1></div></body></html>';
  const NOT_READY = '<html><head><title>x</title></head><body><p>Načítám…</p></body></html>';
  const NOT_FOUND = `<html><head><title>x</title></head><body><div ${NOT_FOUND_MARKER}><h1>Nenalezeno</h1></div></body></html>`;

  /** @type {import('playwright').Browser} */
  let browser;
  /** @type {Awaited<ReturnType<typeof startServer>>} */
  let server;
  /** @type {Map<string, number>} */
  const hits = new Map();
  /** @type {import('node:http').ServerResponse[]} */
  const held = [];

  beforeAll(async () => {
    const { chromium } = await import('playwright');
    browser = await chromium.launch();
    server = await startServer((req, res) => {
      const path = req.url ?? '';
      const n = (hits.get(path) ?? 0) + 1;
      hits.set(path, n);
      if (path === '/visi-poprve' && n === 1) {
        held.push(res); // odpověď nepřijde — `goto` vyprší
        return;
      }
      const body = {
        '/pomala-poprve': n === 1 ? NOT_READY : READY,
        '/visi-poprve': READY,
        '/nikdy-hotova': NOT_READY,
        '/nenalezeno': NOT_FOUND,
      }[path];
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(body ?? READY);
    });
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    await server?.close();
  });

  /** @type {import('vitest').MockInstance} */
  let warn;
  beforeEach(() => {
    hits.clear();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  /** @param {string} route */
  const capture = async (route) => {
    const page = await createPrerenderPage(browser, [server.origin]);
    try {
      return await captureRouteWithRetry(page, server.origin + route, route, LIMITS);
    } finally {
      await page.close();
    }
  };

  it('stránku, která napoprvé nestihla ohlásit připravenost, zkusí ještě jednou', async () => {
    const html = await capture('/pomala-poprve');
    expect(html).toContain('Hotovo');
    expect(hits.get('/pomala-poprve')).toBe(2);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/^↻ .*\/pomala-poprve/);
  }, 30_000);

  it('opakuje i načtení, které vypršelo', async () => {
    const html = await capture('/visi-poprve');
    expect(html).toContain('Hotovo');
    expect(hits.get('/visi-poprve')).toBe(2);
    expect(warn).toHaveBeenCalledTimes(1);
  }, 30_000);

  it('druhý neúspěch nechá vybublat — neúplný web se nasadit nesmí', async () => {
    await expect(capture('/nikdy-hotova')).rejects.toBeInstanceOf(RetryableRouteError);
    expect(hits.get('/nikdy-hotova')).toBe(2);
  }, 30_000);

  it('stránku „nenalezeno" neopakuje — napodruhé by dopadla stejně', async () => {
    const err = await capture('/nenalezeno').catch((/** @type {unknown} */ e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(RetryableRouteError);
    expect(String(err)).toMatch(/nenalezeno/);
    expect(hits.get('/nenalezeno')).toBe(1);
    expect(warn).not.toHaveBeenCalled();
  }, 30_000);
});

describe('zapojení do run()', () => {
  // `run()` se netestuje (potřebuje databázi a Chromium s preview serverem), takže
  // kdyby smyčka zase volala `page.goto` napřímo, opakování by tiše zmizelo a testy
  // `captureRouteWithRetry` by dál procházely. Stejný typ strážce jako u NOT_FOUND_MARKER.
  const source = readFileSync('scripts/prerender.mjs', 'utf8');
  const runBody = source.slice(source.indexOf('async function run()'));

  it('smyčka rout jde přes captureRouteWithRetry', () => {
    expect(runBody).toContain('await captureRouteWithRetry(page, base + route, route)');
    expect(runBody).not.toContain('page.goto(');
  });

  it('stránka vzniká přes createPrerenderPage s preview serverem i Supabase', () => {
    expect(runBody).toContain('createPrerenderPage(browser, [base, supabaseUrl()])');
    // Volání, ne zmínka: komentář v `run()` `browser.newPage()` cituje.
    expect(runBody).not.toMatch(/await\s+browser\.newPage\(/);
  });
});
