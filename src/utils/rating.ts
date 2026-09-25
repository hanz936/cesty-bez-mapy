/**
 * Zaokrouhlení průměrného hodnocení na jedno desetinné místo.
 *
 * DB drží průměr zaokrouhlený na 12 desetinných míst (`refresh_product_rating`), třeba
 * 4.545454545455. Tolik míst projde JSONem i JavaScriptem beze změny a zobrazení nezmění.
 * Zobrazujeme jedno desetinné místo — a Google zakazuje markup obsahu, který na stránce
 * není vidět. Viditelný text i `ratingValue` proto musí projít TOUTO funkcí, aby nemohly
 * vydat různá čísla.
 *
 * Zaokrouhluje se jen tady a jen jednou. Dřív DB ukládala `round(avg, 2)` a tahle funkce
 * pak zaokrouhlila podruhé: 11 recenzí se součtem 50 (4,5454…) se uložilo jako 4.55
 * a zobrazilo jako 4,6. Chyba šla vždy nahoru. Slibuje to i `/overovani-recenzi`.
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
