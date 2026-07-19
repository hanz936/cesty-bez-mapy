import { describe, it, expect } from 'vitest';
import { hasAnyReviews, visibleSortOptions } from './travelGuidesFilters';

describe('hasAnyReviews', () => {
  it('false when no product has reviews', () => {
    expect(hasAnyReviews([{ reviewCount: 0 }, { reviewCount: 0 }])).toBe(false);
  });
  it('true when at least one product has a review', () => {
    expect(hasAnyReviews([{ reviewCount: 0 }, { reviewCount: 2 }])).toBe(true);
  });
  it('false for an empty list', () => {
    expect(hasAnyReviews([])).toBe(false);
  });
});

describe('visibleSortOptions', () => {
  it('nabízí „Dle hodnocení" (v plném pořadí), když recenze existují', () => {
    expect(visibleSortOptions(true)).toEqual([
      'Nejprodávanější',
      'Nejdražší',
      'Nejlevnější',
      'Dle hodnocení',
      'Nejnovější',
    ]);
  });
  it('bez recenzí vynechá přesně „Dle hodnocení", ostatní zachová v pořadí', () => {
    expect(visibleSortOptions(false)).toEqual([
      'Nejprodávanější',
      'Nejdražší',
      'Nejlevnější',
      'Nejnovější',
    ]);
  });
});
