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

/** Strana je „další" jen pro celé číslo > 1 — cokoli jiného patří na stranu 1. */
export function isPagedPage(page: number): boolean {
  return Number.isInteger(page) && page > 1;
}

/** Cesta stránky recenzí produktu (strana 1 je bez segmentu `/strana`). */
export function productReviewsPath(slug: string, page = 1): string {
  const base = `/cestovni-pruvodci/${slug}/recenze`;
  return isPagedPage(page) ? `${base}/strana/${page}` : base;
}

/**
 * Kolik stran recenzí produkt celkem má a kolik z nich se má prerenderovat/uvést
 * v sitemapě (strop `MAX_PRERENDERED_REVIEW_PAGES`). Jediné místo, kde žije
 * `Math.ceil`/`Math.min` pár — `prerender.mjs` i `sitemap.mjs` z něj jen čtou,
 * takže matematika stránkování nemůže mezi oběma skripty zdvojeně zestárnout.
 *
 * `reviewCount` smí být `null`/`undefined`: skripty ho berou přímo ze Supabase
 * (`products.review_count`), kde je to nullable sloupec — pojistka `?? 0` proto
 * patří sem, na jedno místo, které ji garantuje pro každého volajícího, ne
 * duplicitně na každé volací místo.
 */
export function reviewPageRange(reviewCount: number | null | undefined): { totalPages: number; prerenderedPages: number } {
  const totalPages = Math.ceil((reviewCount ?? 0) / REVIEWS_PAGE_SIZE);
  return { totalPages, prerenderedPages: Math.min(totalPages, MAX_PRERENDERED_REVIEW_PAGES) };
}
