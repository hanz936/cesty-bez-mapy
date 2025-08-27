export const ROUTES = {
  HOME: '/',
  MY_STORY: '/muj-pribeh',
  PLAN_YOUR_DREAM_TRIP: '/naplanuj-si-cestu-snu',
  TRAVEL_GUIDES: '/cestovni-pruvodci',
  ITALY_ROADTRIP_DETAIL: '/cestovni-pruvodci/italie-roadtrip',
  INSPIRATION: '/inspirace',
  COLLABORATION: '/spoluprace',
  FAQ: '/caste-dotazy'
};

export const ROUTE_LABELS = {
  [ROUTES.HOME]: 'Domů',
  [ROUTES.MY_STORY]: 'Můj příběh',
  [ROUTES.PLAN_YOUR_DREAM_TRIP]: 'Naplánuj si cestu snů',
  [ROUTES.TRAVEL_GUIDES]: 'Cestovní průvodci',
  [ROUTES.INSPIRATION]: 'Inspirace na cesty',
  [ROUTES.COLLABORATION]: 'Spolupráce',
  [ROUTES.FAQ]: 'Časté dotazy'
};

export const NAV_ITEMS = [
  { href: ROUTES.PLAN_YOUR_DREAM_TRIP, text: ROUTE_LABELS[ROUTES.PLAN_YOUR_DREAM_TRIP] },
  { href: ROUTES.TRAVEL_GUIDES, text: ROUTE_LABELS[ROUTES.TRAVEL_GUIDES] },
  { href: ROUTES.INSPIRATION, text: ROUTE_LABELS[ROUTES.INSPIRATION] },
  { href: ROUTES.MY_STORY, text: ROUTE_LABELS[ROUTES.MY_STORY] },
  { href: ROUTES.COLLABORATION, text: ROUTE_LABELS[ROUTES.COLLABORATION] }
];