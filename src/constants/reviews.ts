/** Kolik recenzí je na jedné straně stránky recenzí. */
export const REVIEWS_PAGE_SIZE = 10;

/**
 * Kolik recenzí má ukazovat detail produktu. Jediný zdroj pravdy pro `ProductReviews.tsx`
 * (vykreslení karet) i `ProductDetail.tsx` (preload, ze kterého se skládá JSON-LD) — obě
 * místa čtou tuhle konstantu, takže nemůže nastat stav, kdy strukturovaná data nesou jiný
 * počet recenzí, než kolik jich je na stránce vidět. Přesně to Google vyžaduje.
 */
export const PRODUCT_REVIEWS_LIMIT = 3;

/**
 * Strop pro počet prerenderovaných stran recenzí na jeden produkt. Každá strana
 * je jedna návštěva headless Chromia navíc; hlubší strany zůstanou dostupné,
 * jen se nepředgenerují ani neuvedou v sitemapě.
 */
export const MAX_PRERENDERED_REVIEW_PAGES = 20;

/**
 * Ořízne stranu z adresy do platného rozsahu. Musí se stát PŘED dotazem:
 * `fetchApprovedReviews` posílá `count: 'exact'`, takže PostgREST na `Range`
 * mimo rozsah odpoví 416, funkce na chybu vyhodí a `count` se nedozvíme.
 * Počet stran proto plyne z `products.review_count`.
 *
 * Přijímáme jen kladné celé číslo bez vodicí nuly. Volnější `Number()` by bralo
 * i `0x2`, `2e1`, `+2` nebo ` 2 ` a vyrobilo pro tutéž stranu několik adres.
 */
export function clampPage(raw: string | undefined, totalPages: number): number {
  if (!raw || !/^[1-9]\d*$/.test(raw)) return 1;
  return Math.min(Number(raw), Math.max(totalPages, 1));
}
