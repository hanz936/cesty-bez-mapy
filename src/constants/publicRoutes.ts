import { ROUTES } from './routes.ts';

/**
 * Veřejné, indexovatelné statické routy (jediný zdroj pravdy pro prerender,
 * sitemap a per-route meta). NEobsahuje transakční/soukromé routy
 * (objednávka, potvrzení, stažení, dotazník/náhled itineráře) ani 404.
 * `title` je holý (komponenta SeoTags připojí „ | Cesty bez mapy"); copy lze
 * doladit s Janou před launchem. `/` je v registru kvůli prerenderu+sitemap,
 * ale Home.jsx meta bere z index.html (žádné SeoTags) — title/description zde
 * jsou jen dokumentační.
 */
export const PUBLIC_PAGES = [
  { path: ROUTES.HOME, title: 'Cesty (bez) mapy', description: 'Místo, kde najdeš inspiraci, itineráře i tipy na místa, která se do běžných průvodců nevešla.' },
  { path: ROUTES.MY_STORY, title: 'Můj příběh', description: 'Jak vznikly Cesty bez mapy — příběh o cestování bez itinerářů, objevování míst mimo mapu a inspiraci pro tvé vlastní cesty.' },
  { path: ROUTES.PLAN_YOUR_DREAM_TRIP, title: 'Naplánuj si cestu snů', description: 'Pomůžu ti naplánovat cestu na míru — itinerář podle tvých představ, tempa i rozpočtu. Cesty bez mapy, ušité na míru tobě.' },
  { path: ROUTES.QUIZ, title: 'Cestovní kvíz — zjisti, kam vyrazit', description: 'Krátký kvíz o devíti otázkách ti doporučí itinerář přesně podle tvého stylu cestování. Zjisti, kam tě to táhne, a vyraz bez starostí.' },
  { path: ROUTES.TRAVEL_GUIDES, title: 'Cestovní průvodci', description: 'Stáhni si cestovní průvodce a itineráře plné tipů na místa, která se do běžných průvodců nevešla. Praktické PDF pro tvé cesty.' },
  { path: ROUTES.SALZBURG_ITINERARY, title: 'Salzburg na víkend', description: 'Víkendový itinerář do Salzburgu — co vidět, kam zajít a jak si užít město i okolí bez stresu. Tipy z cest bez mapy.' },
  { path: ROUTES.CUSTOM_ITINERARY_DETAIL, title: 'Itinerář na míru', description: 'Itinerář na míru přesně podle tvých představ — řekni mi, kam chceš, a já připravím plán cesty ušitý na míru tobě.' },
  { path: ROUTES.INSPIRATION, title: 'Inspirace na cesty', description: 'Inspirace, příběhy a tipy z cest — místa mimo mapu, praktické rady a nápady, kam vyrazit. Nech se vést světem.' },
  { path: ROUTES.COLLABORATION, title: 'Spolupráce', description: 'Pojďme spolupracovat — možnosti spolupráce pro značky, hotely a destinace s Cesty bez mapy. Napiš mi svůj nápad.' },
  { path: ROUTES.FAQ, title: 'Časté dotazy', description: 'Odpovědi na nejčastější dotazy — průvodci, platby, stahování PDF i itineráře na míru. Vše, co potřebuješ vědět.' },
  { path: ROUTES.REVIEWS, title: 'Recenze', description: 'Co říkají cestovatelé, kteří už vyrazili s průvodci Cesty bez mapy. Přečti si reálné zkušenosti a recenze.' },
  { path: ROUTES.CONTACT, title: 'Kontakt', description: 'Ozvi se mi — dotazy ke cestám, průvodcům i spolupráci. Ráda ti pomůžu naplánovat tvou další cestu bez mapy.' },
  { path: ROUTES.PRIVACY, title: 'Ochrana osobních údajů', description: 'Jak Cesty bez mapy zpracovávají a chrání tvé osobní údaje. Zásady ochrany soukromí a informace o cookies.' },
];
