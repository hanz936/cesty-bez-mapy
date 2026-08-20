/**
 * Registr veřejných cest. POZOR: tenhle soubor načítá i plain `node` — build skripty
 * si ho táhnou přes `publicRoutes.ts` — a ten z TypeScriptu jen odstraňuje typy,
 * tsconfig vůbec nečte. Relativní import tu proto musí mít příponu a nesmí sem nic,
 * co potřebuje skutečný překlad (enum, namespace s kódem, parameter properties).
 * Hlídá to `scripts/loadable.test.js`.
 */
export const ROUTES = {
  HOME: '/',
  MY_STORY: '/muj-pribeh',
  PLAN_YOUR_DREAM_TRIP: '/naplanuj-si-cestu-snu',
  QUIZ: '/kviz',
  TRAVEL_GUIDES: '/cestovni-pruvodci',
  SALZBURG_ITINERARY: '/salzburg-vikend',
  CUSTOM_ITINERARY_DETAIL: '/cestovni-pruvodci/itinerar-na-miru',
  CUSTOM_ITINERARY_FORM: '/cestovni-pruvodci/itinerar-na-miru/dotaznik',
  CUSTOM_ITINERARY_PREVIEW: '/cestovni-pruvodci/itinerar-na-miru/nahled/:id',
  PRODUCT_DETAIL: '/cestovni-pruvodci/:slug',
  PRODUCT_REVIEWS: '/cestovni-pruvodci/:slug/recenze',
  PRODUCT_REVIEWS_PAGED: '/cestovni-pruvodci/:slug/recenze/strana/:strana',
  CHECKOUT: '/cestovni-pruvodci/objednavka',
  ORDER_CONFIRMATION: '/cestovni-pruvodci/objednavka/potvrzeni',
  DOWNLOAD: '/stahnout',
  INSPIRATION: '/inspirace',
  INSPIRATION_DETAIL: '/inspirace/:slug',
  COLLABORATION: '/spoluprace',
  FAQ: '/caste-dotazy',
  REVIEWS: '/recenze',
  REVIEW_SUBMIT: '/recenze/pridat',
  CONTACT: '/kontakt',
  PRIVACY: '/ochrana-osobnich-udaju'
};

/**
 * Cesta detailu produktu. Builder sedí vedle patternu schválně: `ROUTES.PRODUCT_DETAIL`
 * je tentýž tvar pro router, tohle je tentýž tvar pro odkazy, sitemapu a prerender —
 * a že se ty dva nerozejdou, hlídá drift test v `routes.test.ts`. Dokud se cesta psala
 * ručně na devíti místech, přejmenování segmentu prošlo celou sadou zeleně.
 *
 * Slug se záměrně neenkóduje (na rozdíl od `generatePath` z react-routeru): slugy jsou
 * `[a-z0-9-]` a `productReviewsPath` je staví stejně — enkódování jen v jednom z nich
 * by obě cesty rozešlo. React-router se sem navíc importovat nesmí, viz hlavička.
 */
export function productDetailPath(slug: string): string {
  return `/cestovni-pruvodci/${slug}`;
}

export const ROUTE_LABELS = {
  [ROUTES.HOME]: 'Domů',
  [ROUTES.MY_STORY]: 'Můj příběh',
  [ROUTES.PLAN_YOUR_DREAM_TRIP]: 'Naplánuj si cestu snů',
  [ROUTES.TRAVEL_GUIDES]: 'Cestovní průvodci',
  [ROUTES.INSPIRATION]: 'Inspirace na cesty',
  [ROUTES.COLLABORATION]: 'Spolupráce',
  [ROUTES.FAQ]: 'Časté dotazy',
  [ROUTES.REVIEWS]: 'Recenze',
  [ROUTES.CONTACT]: 'Kontakt'
};

export const NAV_ITEMS = [
  { href: ROUTES.PLAN_YOUR_DREAM_TRIP, text: ROUTE_LABELS[ROUTES.PLAN_YOUR_DREAM_TRIP] },
  { href: ROUTES.TRAVEL_GUIDES, text: ROUTE_LABELS[ROUTES.TRAVEL_GUIDES] },
  { href: ROUTES.INSPIRATION, text: ROUTE_LABELS[ROUTES.INSPIRATION] },
  { href: ROUTES.MY_STORY, text: ROUTE_LABELS[ROUTES.MY_STORY] },
  { href: ROUTES.COLLABORATION, text: ROUTE_LABELS[ROUTES.COLLABORATION] }
];