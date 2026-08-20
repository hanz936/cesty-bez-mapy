import { describe, it, expect } from 'vitest';
import {
  clampPage,
  isPagedPage,
  productReviewsPath,
  reviewPageRange,
  REVIEWS_PAGE_SIZE,
  PRODUCT_REVIEWS_LIMIT,
  MAX_PRERENDERED_REVIEW_PAGES,
} from './reviews';
// `reviews.ts` dnes `routes.ts` importuje — cesta detailu produktu žije v registru
// a stránka recenzí ji jen prodlužuje. Že ta dvojice zůstane načitatelná v plain Node,
// hlídá `scripts/loadable.test.js`; tenhle soubor hlídá, že se stavitel cesty a route
// pattern nerozejdou.
import { ROUTES } from './routes.ts';

describe('konstanty recenzí', () => {
  it('drží dohodnuté hodnoty', () => {
    expect(REVIEWS_PAGE_SIZE).toBe(10);
    expect(PRODUCT_REVIEWS_LIMIT).toBe(3);
  });
});

describe('clampPage', () => {
  it('bez segmentu strany vrací první stranu', () => {
    expect(clampPage(undefined, 3)).toBe(1);
  });

  it('platnou stranu propustí', () => {
    expect(clampPage('2', 3)).toBe(2);
    expect(clampPage('3', 3)).toBe(3);
  });

  it('stranu nad rozsah ořízne na poslední platnou', () => {
    expect(clampPage('99', 3)).toBe(3);
    expect(clampPage('99999999999999999999', 3)).toBe(3);
  });

  it('cokoli, co není kladné celé číslo bez vodicí nuly, spadne na první stranu', () => {
    for (const raw of ['0', '-1', 'abc', '2.5', '2.0', '+2', '02', '0x2', '2e1', ' 2 ', '', '٢', 'Infinity']) {
      expect(clampPage(raw, 3)).toBe(1);
    }
  });

  it('při nule stran vrací vždy 1, aby nevznikla strana 0', () => {
    expect(clampPage('5', 0)).toBe(1);
    expect(clampPage(undefined, 0)).toBe(1);
  });
});

describe('productReviewsPath', () => {
  it('strana 1 nemá segment /strana', () => {
    expect(productReviewsPath('italie-roadtrip', 1)).toBe('/cestovni-pruvodci/italie-roadtrip/recenze');
  });

  it('strana 3 má segment /strana/3', () => {
    expect(productReviewsPath('italie-roadtrip', 3)).toBe('/cestovni-pruvodci/italie-roadtrip/recenze/strana/3');
  });

  it('NaN se chová jako nestránkovaná cesta', () => {
    // `NaN <= 1` i `NaN > 1` jsou obě false — bez sdíleného predikátu se `productReviewsPath`
    // a titulek ve `buildProductReviewsMeta` rozejdou (jeden by přidal segment, druhý ne).
    expect(productReviewsPath('italie-roadtrip', NaN)).toBe('/cestovni-pruvodci/italie-roadtrip/recenze');
  });

  it('segment /strana vzniká právě pro isPagedPage', () => {
    // Tuhle ekvivalenci si podmínka redirectu v `ProductReviewsPage` půjčuje: adresa
    // se segmentem `/strana` smí vzniknout právě tehdy, když `isPagedPage` řekne ano.
    // Kdyby se ty dvě věci rozešly, stránka by se přesměrovávala do kruhu.
    for (const raw of [undefined, '1', '2', '3', '99', 'abc', '0', '2.5', '02']) {
      const page = clampPage(raw, 3);
      expect(productReviewsPath('italie', page).includes('/strana/')).toBe(isPagedPage(page));
    }
  });

  it('shoduje se s route patterny v routes.ts', () => {
    // Nic jinak stavitel cesty a router nesvazuje: přejmenování segmentu
    // v `ROUTES.PRODUCT_REVIEWS`/`PRODUCT_REVIEWS_PAGED` by se jinak projevilo
    // až za běhu (prerender by pod adresou recenzí uložil obsah `*`/NotFound).
    expect(productReviewsPath('x')).toBe(ROUTES.PRODUCT_REVIEWS.replace(':slug', 'x'));
    expect(productReviewsPath('x', 2)).toBe(
      ROUTES.PRODUCT_REVIEWS_PAGED.replace(':slug', 'x').replace(':strana', '2'),
    );
  });
});

describe('reviewPageRange', () => {
  it('0 recenzí → 0 stran', () => {
    expect(reviewPageRange(0)).toEqual({ totalPages: 0, prerenderedPages: 0 });
  });

  it('10 recenzí = přesně jedna strana', () => {
    expect(reviewPageRange(10)).toEqual({ totalPages: 1, prerenderedPages: 1 });
  });

  it('25 recenzí = tři strany, všechny pod stropem', () => {
    expect(reviewPageRange(25)).toEqual({ totalPages: 3, prerenderedPages: 3 });
  });

  it('500 recenzí = 50 stran, prerenderuje se jen strop MAX_PRERENDERED_REVIEW_PAGES', () => {
    expect(reviewPageRange(500)).toEqual({ totalPages: 50, prerenderedPages: MAX_PRERENDERED_REVIEW_PAGES });
  });
});
