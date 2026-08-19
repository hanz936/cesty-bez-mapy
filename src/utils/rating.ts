/**
 * Zaokrouhlení průměrného hodnocení na jedno desetinné místo.
 *
 * DB drží `round(avg(rating), 2)` (`refresh_product_rating`), takže hodnota může být
 * třeba 4.67. Zobrazujeme ale jedno desetinné místo — a Google zakazuje markup obsahu,
 * který na stránce není vidět. Viditelný text i `ratingValue` proto musí projít
 * TOUTO funkcí, aby nemohly vydat různá čísla.
 */
export function roundRating(average: number): number {
  return Math.round(average * 10) / 10;
}

/** Pro zobrazení: česká desetinná čárka. */
export function formatRatingCs(average: number): string {
  return roundRating(average).toFixed(1).replace('.', ',');
}

/** Pro JSON-LD: tečka podle schema.org, ale tatáž hodnota, jakou vidí uživatel. */
export function ratingValueJsonLd(average: number): string {
  return roundRating(average).toFixed(1);
}
