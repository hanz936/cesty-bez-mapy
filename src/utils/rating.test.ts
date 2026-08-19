import { describe, it, expect } from 'vitest';
import { roundRating, formatRatingCs, ratingValueJsonLd } from './rating';

describe('rating', () => {
  it('zaokrouhluje na jedno desetinné místo', () => {
    expect(roundRating(4.67)).toBe(4.7);
    expect(roundRating(4.64)).toBe(4.6);
    expect(roundRating(5)).toBe(5);
  });

  it('zobrazení a JSON-LD nesou tutéž hodnotu, jen jiný oddělovač', () => {
    expect(formatRatingCs(4.67)).toBe('4,7');
    expect(ratingValueJsonLd(4.67)).toBe('4.7');
    expect(formatRatingCs(5)).toBe('5,0');
    expect(ratingValueJsonLd(5)).toBe('5.0');
  });
});
