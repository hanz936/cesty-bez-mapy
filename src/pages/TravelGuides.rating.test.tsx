import { describe, it, expect } from 'vitest';
import { hasAnyReviews } from './TravelGuides';

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
