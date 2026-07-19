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
