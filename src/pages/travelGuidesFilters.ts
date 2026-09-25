import { roundRating } from '../utils/rating';

const SORT_OPTIONS = [
  'Nejprodávanější',
  'Nejdražší',
  'Nejlevnější',
  'Dle hodnocení',
  'Nejnovější'
];

/** Rating UI (hvězdičky na kartách + filtr) se ukazuje, až když má aspoň jeden produkt recenze. */
export function hasAnyReviews(guides: { reviewCount: number }[]): boolean {
  return guides.some((g) => g.reviewCount > 0);
}

/** Sort „Dle hodnocení" se nabízí, až když má aspoň jeden produkt recenze (stejný gate jako hvězdičky/filtr). */
export function visibleSortOptions(hasReviews: boolean): string[] {
  return hasReviews ? [...SORT_OPTIONS] : SORT_OPTIONS.filter((o) => o !== 'Dle hodnocení');
}

/**
 * Patří produkt do rozsahu filtru hodnocení („5 / 4.5+ / 4+ / 3.5+ hvězdiček")?
 *
 * DB drží průměr na 12 desetinných míst (4.545454545455), karta ale ukazuje `formatRatingCs`
 * / hvězdy z `roundRating` („4,5"). Filtr i počty u jeho položek proto porovnávají TUTÉŽ
 * zaokrouhlenou hodnotu — jinak by zákazník ve „4.5+" nenašel průvodce, kterého jeho vlastní
 * karta hodnotí „4,5".
 * Zaokrouhluje se jen tady a jen jednou (pravidlo z `src/utils/rating.ts`).
 *
 * `null`/`undefined`/0 (produkt bez recenzí) nepatří do žádného rozsahu.
 */
export function matchesRatingRange(
  rating: number | null | undefined,
  range: { minRating: number; exact?: boolean }
): boolean {
  const rounded = roundRating(rating ?? 0);
  return range.exact ? rounded === range.minRating : rounded >= range.minRating;
}
