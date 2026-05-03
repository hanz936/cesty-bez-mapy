# Cesty bez mapy

E-shop s cestovními průvodci a službou plánování cest na míru.

## Tech Stack

- **Framework:** React 19 (JSX, ne TypeScript)
- **Styling:** Tailwind CSS 4
- **Routing:** React Router 7
- **Backend:** Supabase (PostgreSQL, Auth, Storage)
- **Platby:** Stripe Checkout
- **PDF:** jsPDF
- **Build:** Vite 7
- **Testy:** Vitest + React Testing Library

## Struktura projektu

```
src/
├── components/
│   ├── ui/           # Základní UI (Button, Input, Form, Modal)
│   ├── common/       # Sdílené (Hero, Cart, Navigation)
│   ├── layout/       # Layout, Navigation, Footer
│   └── reviews/      # Recenze
├── pages/            # Stránky (ProductDetail, Checkout, OrderConfirmation, ...)
├── contexts/         # React Context (CartContext)
├── hooks/            # Custom hooks (useNavigation)
├── lib/              # Supabase klient
├── constants/        # Routes, app config, seasons
├── styles/           # CSS utilities, print styles
└── utils/            # Logger a pomocné funkce
```

## Konvence

### Import aliasy
- `@` = `src/`
- `@components` = `src/components/`
- `@pages` = `src/pages/`
- `@assets` = `src/assets/`

### Komponenty
- Funkcionální komponenty s `React.memo` pro optimalizaci
- `useCallback` pro event handlery
- `displayName` pro debugging
- Barrel exporty přes `index.js`

### Styling
- Tailwind utility classes
- Custom utilities v `src/styles/utilities.css`: `focus-ring`, `card-hover`, `text-responsive-*`
- Barevná paleta: zelená (green-600, green-700, green-800)
- Mobile-first s breakpointy: `sm:`, `md:`, `lg:`, `xl:`

### State management
- `CartContext` pro košík (localStorage key: `cbm_cart`)
- URL params pro routing state

## Routy (česky)

```
/                          # Úvod
/muj-pribeh                # O mně
/cestovni-pruvodci         # Produkty
/pruvodce/:slug            # Detail produktu
/naplanuj-si-cestu-snu     # Formulář na míru
/pokladna                  # Checkout
/potvrzeni-objednavky      # Potvrzení s PDF ke stažení
/blog                      # Blog
/clanek/:slug              # Detail článku
```

## Spuštění

```bash
npm install
npm run dev      # Port 3000
npm run build    # Produkční build
npm run preview  # Port 4173
npm run test     # Vitest
npm run lint     # ESLint
```

## Environment variables

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=anon_key
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
VITE_APP_ENV=development
VITE_DEBUG=true
```

## Důležité soubory

- [App.jsx](src/App.jsx) - Routy, ErrorBoundary, CartProvider
- [CartContext.jsx](src/contexts/CartContext.jsx) - Stav košíku s localStorage persistencí
- [supabase.js](src/lib/supabase.js) - Supabase klient
- [routes.js](src/constants/routes.js) - Definice všech rout (ROUTES objekt)
- [vite.config.js](vite.config.js) - Build konfigurace, aliasy, chunk splitting

## E-commerce flow

1. Přidání produktu do košíku (CartContext)
2. Checkout stránka - shrnutí + údaje
3. Přesměrování na Stripe Checkout
4. Po platbě redirect na `/potvrzeni-objednavky?session_id=xxx`
5. Stažení PDF přes `download_tokens` tabulku

## Databázové tabulky

- `products`, `categories`, `product_categories`
- `orders`, `order_items`
- `customers`
- `download_tokens` (JWT tokeny pro PDF)
- `custom_itinerary_requests`
- `blog_posts`
- `user_roles`
- `contact_messages` (zprávy z Contact + Collaboration formulářů, viz Cloudflare Turnstile níže)

## Cloudflare Turnstile

Veřejné formuláře a anonymní auth jsou chráněné Cloudflare Turnstile (managed mode).

- Reusable komponenta: [`src/components/ui/TurnstileField.jsx`](src/components/ui/TurnstileField.jsx)
- Site key env: `VITE_TURNSTILE_SITE_KEY` (veřejný, v bundle)
- Secret key env (Edge Function): `TURNSTILE_SECRET_KEY` (Supabase secrets)
- Edge Function: [`supabase/functions/submit-contact-form/index.ts`](supabase/functions/submit-contact-form/index.ts) (verify_jwt=false, public endpoint)
- Sdílený verifier: [`supabase/functions/_shared/verifyTurnstile.ts`](supabase/functions/_shared/verifyTurnstile.ts) — volá Cloudflare siteverify
- Auth integrace: konfigurováno v Supabase Dashboard → Authentication → CAPTCHA (ne v kódu)
- Production setup: [`docs/MANUAL_SETUP_TURNSTILE.md`](docs/MANUAL_SETUP_TURNSTILE.md)

Chráněné submission flows:
- `Contact.jsx` + `Collaboration.jsx` → POST na `submit-contact-form` Edge Function → INSERT do `contact_messages`
- `Checkout.jsx` → `signInAnonymously({ options: { captchaToken } })` před vytvořením orderu
- `CustomItineraryForm.jsx` → widget jen na posledním wizard stepu (token freshness; 5min TTL)

## Deployment

- **Platforma:** Vercel
- **Main branch:** Manuální deploy
- **Dev branch:** Auto-deploy na preview
- SPA rewrites v `vercel.json`
