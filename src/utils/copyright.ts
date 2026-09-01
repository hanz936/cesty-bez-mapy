/**
 * Rok prvního zveřejnění webu. Není to rok, kdy se web psal (2025), ale rok,
 * kdy byl vydán do světa — do launche běží jen za Basic auth, tedy zveřejněný
 * není. Kdyby se spuštění posunulo, musí se tohle číslo posunout s ním.
 *
 * Proč zrovna rok vydání: Bernská úmluva, čl. 5(2) — ochrana „shall not be
 * subject to any formality", takže poznámka o autorství není povinná vůbec.
 * Když už tu ale je, nese podle US Copyright Office (Circular 3) „the year of
 * first publication of the work", ne dnešní datum.
 */
export const FIRST_PUBLICATION_YEAR = 2026;

/**
 * Ročník do copyrightové poznámky: v roce vydání jediný rok, potom rozsah
 * „od vydání po dnešek". Web není uzavřené dílo — každý rok v něm přibývají
 * nové články, produkty a recenze, a ty spadají pod rok, kdy vyšly.
 *
 * `currentYear` je parametr schválně, ne `new Date()` uvnitř: funkce tím zůstane
 * čistá a jde ověřit bez posouvání systémových hodin. Dnešek si obstará volající.
 *
 * Rok nižší než rok vydání (rozbité hodiny na klientovi, odložený launch) nesmí
 * vyrobit rozsah pozpátku — vrací se pak samotný rok vydání.
 */
export function copyrightYears(currentYear: number, firstYear: number = FIRST_PUBLICATION_YEAR): string {
  return currentYear > firstYear ? `${firstYear}–${currentYear}` : String(firstYear);
}
