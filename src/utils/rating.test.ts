import { describe, it, expect } from 'vitest';
import { roundRating, formatRatingCs, ratingValueJsonLd } from './rating';

describe('rating', () => {
  it('přesný průměr z DB zaokrouhlí jen jednou', () => {
    // 11 recenzí se součtem 50. PostgREST posílá `numeric` jako JSON číslo, takže
    // sem dorazí právě to, co z téhle odpovědi udělá `JSON.parse` (literál by měl
    // víc číslic, než double unese). Dřívější uložené 4.55 by dalo 4,6 — o desetinu víc.
    const fromApi = JSON.parse('{"average_rating":4.5454545454545455}') as { average_rating: number };
    expect(roundRating(fromApi.average_rating)).toBe(4.5);
    expect(formatRatingCs(fromApi.average_rating)).toBe('4,5');
  });

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
