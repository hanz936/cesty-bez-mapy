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
 * Audit P-7 (2026-08-31) to vyhodnotil jako riziko. User 2026-09-15 po změření
 * 10 českých e-shopů (6 z nich má informaci nebo odkaz přímo u recenzí — Datart,
 * Notino, Mountfield, Dr. Max, Aurio, Fleppi) rozhodl: ZŮSTÁVÁ JEN PATIČKA, riziko
 * „přímo tam" přijímá vědomě. Nejde o přehlédnutí — neotevírat bez nového podnětu.
 *
 * Na formuláři pro vložení recenze povinnost neleží (§ 5a odst. 5 míří na zveřejněné
 * recenze), text se tam proto nezobrazuje (rozhodnutí usera 2026-07-17). Od 2026-09-24
 * tam ale vede odkaz na `/overovani-recenzi` — rozhodnutí usera po auditu B-5: ISO 20488
 * doporučuje informovat pisatele o moderaci ještě před odesláním. Finální znění schvaluje Jana.
 */
export const REVIEWS_DISCLOSURE =
  'Recenze píšou jen ověření zákazníci přes odkaz, který posíláme e-mailem po nákupu. ' +
  'Kontrolujeme jen spam, vulgarity a osobní údaje, hodnocení neovlivňujeme.';
