import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** Jen ta část `vercel.json`, na kterou tenhle soubor sahá. */
interface VercelConfig {
  rewrites: { source: string; destination: string }[];
  headers: { source: string; headers: { key: string; value: string }[] }[];
}

describe('rozdělení skořápky a homepage', () => {
  // Čteme cestou relativní ke kořeni projektu (cwd Vitestu). NEPOUŽÍVAT
  // `new URL('../../index.html', import.meta.url)`: Vite ten literál přepisuje svým
  // assetImportMetaUrl transformem a `readFileSync` spadne na ERR_INVALID_URL_SCHEME.
  const template = () => readFileSync('index.html', 'utf8');
  const vercelConfig = () => JSON.parse(readFileSync('vercel.json', 'utf8')) as VercelConfig;

  it('index.html nenese natvrdo zapsanou meta homepage', () => {
    // Google: „make sure that JavaScript doesn't change the canonical link element.
    // If you can't set the canonical URL in the HTML source code, leave it out and
    // only set it with JavaScript." Šablona slouží i jako SPA skořápka, takže
    // cokoli v ní dostane každá neprerenderovaná adresa — a klientský kód by to
    // pak přepisoval, což je přesně ten zakázaný vzorec.
    expect(template()).not.toMatch(/rel="canonical"/);
    expect(template()).not.toMatch(/<title>/);
    expect(template()).not.toMatch(/name="description"/);
    expect(template()).not.toMatch(/property="og:/);
    expect(template()).not.toMatch(/name="twitter:/);
  });

  it('homepage si meta vykresluje sama', () => {
    // Když ji sebereme šabloně, musí ji někdo dodat — jinak nejdůležitější
    // stránka webu zůstane bez titulku i bez canonicalu úplně.
    const home = readFileSync('src/pages/Home.tsx', 'utf8');
    expect(home).toMatch(/rel="canonical"/);
    expect(home).toMatch(/<title>/);
    expect(home).toMatch(/name="description"/);
    expect(home).toMatch(/property="og:url"/);
  });

  it('rewrite míří na skořápku, ne na homepage', () => {
    const vercel = vercelConfig();
    expect(vercel.rewrites).toEqual([{ source: '/(.*)', destination: '/app-shell' }]);
  });

  it('skořápka je vyloučená z indexu hlavičkou, ne až robots.txt', () => {
    // `Disallow` v robots.txt nestačí: „a page that's disallowed in robots.txt can
    // still be indexed if linked to from other sites." Hlavička scoped na /app-shell
    // se díky pořadí routingu na Vercelu (Headers → File System → Rewrites) uplatní
    // jen na přímý požadavek, ne na adresy, které na skořápku spadnou rewritem.
    const vercel = vercelConfig();
    const shellRule = vercel.headers.find((h) => h.source === '/app-shell');
    expect(shellRule?.headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex' });
  });

  it('pravidlo pro skořápku nesmí přebít globální bezpečnostní hlavičky', () => {
    // Vercel u `headers` neukončuje na první shodě („the default behavior is to apply
    // headers to matching paths without needing to explicitly continue matching"),
    // takže /app-shell dostane i blok pro /(.*). Kdyby někdo do pravidla pro skořápku
    // začal kopírovat bezpečnostní hlavičky, vznikla by druhá kopie, která by se
    // rozešla s tou globální — proto smí nést jen X-Robots-Tag.
    const vercel = vercelConfig();
    const shellRule = vercel.headers.find((h) => h.source === '/app-shell');
    expect(shellRule?.headers.map((h) => h.key)).toEqual(['X-Robots-Tag']);
    expect(vercel.headers.some((h) => h.source === '/(.*)')).toBe(true);
  });
});
