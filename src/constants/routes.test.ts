import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { ROUTES, productDetailPath } from './routes';

describe('productDetailPath', () => {
  it('shoduje se s patternem ROUTES.PRODUCT_DETAIL', () => {
    // Jinak stavitel cesty a router nic nesvazuje. Než tenhle test vznikl, šlo
    // přejmenovat segment v routeru a celá sada zůstala zelená — prerender by pak pod
    // adresou produktu uložil obsah `*`/NotFound a poznalo by se to až z produkce.
    expect(productDetailPath('italie-roadtrip')).toBe(ROUTES.PRODUCT_DETAIL.replace(':slug', 'italie-roadtrip'));
  });

  it('je základem cesty recenzí, ne jejím druhopisem', () => {
    expect(ROUTES.PRODUCT_REVIEWS).toBe(`${productDetailPath(':slug')}/recenze`);
    expect(ROUTES.PRODUCT_REVIEWS_PAGED).toBe(`${ROUTES.PRODUCT_REVIEWS}/strana/:strana`);
  });
});

describe('registr rout', () => {
  it('žádná routa v App.tsx není napsaná natvrdo', () => {
    // Routa detailu produktu byla jediná z 24, která si cestu psala sama — a právě proto
    // ji přejmenování nikde neprozvonilo. Tenhle strážný drží pravidlo pro všechny.
    //
    // Čteme cestou relativní ke kořeni projektu (cwd Vitestu). NEPOUŽÍVAT
    // `new URL('../App.tsx', import.meta.url)`: Vite ten literál přepisuje svým
    // assetImportMetaUrl transformem a `readFileSync` spadne na ERR_INVALID_URL_SCHEME.
    // Výjimkou je jen catch-all `path="*"` — ten není adresa, ale „nic z výše
    // uvedeného", a v registru veřejných cest by neměl co dělat.
    const source = readFileSync('src/App.tsx', 'utf8');
    expect(source).not.toMatch(/<Route\s+path="(?!\*")/);
    expect(source).toContain('ROUTES.PRODUCT_DETAIL');
  });

  it('cesty jsou unikátní', () => {
    const paths = Object.values(ROUTES);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
