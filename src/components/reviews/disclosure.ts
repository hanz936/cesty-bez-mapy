/**
 * Povinný disclosure dle § 5a odst. 5 zákona č. 634/1992 Sb. — zda a JAK recenze
 * ověřujeme.
 *
 * Od 2026-08-29 nestojí u samotných recenzí, ale na stránce `/overovani-recenzi`,
 * na kterou vede odkaz z patičky (rozhodnutí usera po průzkumu české praxe:
 * samostatná stránka + odkaz v patičce je vzor, který má Shoptet i desítky
 * e-shopů; ČOI naproti tomu doporučuje informaci přímo u recenzí, popř. odtud
 * odkázat — patička je rozšířený, ale měkčí výklad).
 *
 * Na formuláři pro vložení recenze povinnost neleží — tam se záměrně
 * nezobrazuje (rozhodnutí usera 2026-07-17). Finální znění schvaluje Jana.
 */
export const REVIEWS_DISCLOSURE =
  'Recenze píšou jen ověření zákazníci přes odkaz, který posíláme e-mailem po nákupu. ' +
  'Kontrolujeme jen spam a vulgarity, hodnocení neovlivňujeme.';
