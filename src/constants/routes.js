export const ROUTES = {
  HOME: '/',
  MY_STORY: '/muj-pribeh',
  PLAN_YOUR_DREAM_TRIP: '/naplanuj-si-cestu-snu',
  TRAVEL_GUIDES: '/cestovni-pruvodci',
  ITALY_ROADTRIP_DETAIL: '/cestovni-pruvodci/italie-roadtrip',
  CUSTOM_ITINERARY_DETAIL: '/cestovni-pruvodci/itinerar-na-miru',
  CUSTOM_ITINERARY_FORM: '/cestovni-pruvodci/itinerar-na-miru/dotaznik',
  CHECKOUT: '/cestovni-pruvodci/objednavka',
  ORDER_CONFIRMATION: '/cestovni-pruvodci/objednavka/potvrzeni',
  INSPIRATION: '/inspirace',
  COLLABORATION: '/spoluprace',
  FAQ: '/caste-dotazy',
  CONTACT: '/kontakt'
};

export const ROUTE_LABELS = {
  [ROUTES.HOME]: 'Domů',
  [ROUTES.MY_STORY]: 'Můj příběh',
  [ROUTES.PLAN_YOUR_DREAM_TRIP]: 'Naplánuj si cestu snů',
  [ROUTES.TRAVEL_GUIDES]: 'Cestovní průvodci',
  [ROUTES.INSPIRATION]: 'Inspirace na cesty',
  [ROUTES.COLLABORATION]: 'Spolupráce',
  [ROUTES.FAQ]: 'Časté dotazy',
  [ROUTES.CONTACT]: 'Kontakt'
};

export const NAV_ITEMS = [
  { href: ROUTES.PLAN_YOUR_DREAM_TRIP, text: ROUTE_LABELS[ROUTES.PLAN_YOUR_DREAM_TRIP] },
  { href: ROUTES.TRAVEL_GUIDES, text: ROUTE_LABELS[ROUTES.TRAVEL_GUIDES] },
  { href: ROUTES.INSPIRATION, text: ROUTE_LABELS[ROUTES.INSPIRATION] },
  { href: ROUTES.MY_STORY, text: ROUTE_LABELS[ROUTES.MY_STORY] },
  { href: ROUTES.COLLABORATION, text: ROUTE_LABELS[ROUTES.COLLABORATION] }
];