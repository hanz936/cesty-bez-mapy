# 🚀 Technický přehled projektu Cesty bez mapy

> **Dokumentace pro konzistentní vývoj nových stránek a komponent**

## 🚀 Core Stack

- **React 19.1.0** - nejnovější verze s moderními features
- **React Router 7.7.1** - HashRouter pro GitHub Pages
- **Vite 7.0.4** - moderní build tool místo Create React App
- **Tailwind CSS 4.1.11** - nejnovější verze s Vite integrací

## 🗄️ Backend & Database

**Supabase Platform:**
- **PostgreSQL 15-17** (managed database, nové projekty používají v17)
- **Supabase Auth** - JWT authentication s custom claims
- **Supabase Storage** - file storage s RLS (FÁZE 1)
- **Supabase Edge Functions** - serverless functions (FÁZE 3)

**PostgreSQL Features:**
- **Row Level Security (RLS)** - 12 tabulek s granular policies
- **Custom Access Token Hook** - JWT claims (is_admin, user_role)
- **Database Triggers** - auto-assign default role k novým uživatelům
- **SECURITY DEFINER functions** - s `SET search_path = ''` ochranou
- **JSONB** - pro integration_logs
- **UUID** - všechny primary keys
- **Foreign keys** - CASCADE deletes
- **Check constraints** - data validation
- **Indexes** - performance optimization
- **Soft deletes** - deleted_at pattern pro products

**Security & Auth Pattern:**
- **JWT-based RBAC** - 10-100x rychlejší než DB reads
- **user_roles table** - admin/user role management
- **Defense in depth** - RLS + service_role pro webhooks
- **Immutable audit logs** - newsletter_consent_log (no UPDATE/DELETE)
- **Token-based downloads** - download_tokens s expirací

**Database Schema (12 tabulek):**
- `customers` - normalizovaná zákaznická data
- `categories` + `product_categories` - M:N vztah produkty-kategorie
- `products` - PDF cestopisy
- `blog_posts` - články
- `orders` + `order_items` - Stripe objednávky
- `custom_itinerary_requests` - poptávkový formulář
- `download_tokens` - PDF delivery
- `integration_logs` - API audit trail
- `newsletter_consent_log` - GDPR compliance
- `user_roles` - RBAC

**Planned Integrations:**
- **Stripe** - platby (webhooks, Checkout) - FÁZE 3
- **Ecomail** - email marketing + newsletter - FÁZE 7
- **Resend** - transactional emails (nebo Ecomail API) - FÁZE 7
- **Facturoid** - fakturace - FÁZE 7
- **Plausible Analytics** - GDPR-friendly analytics - FÁZE 6

## 🔧 Admin Panel (FÁZE 2)

**Framework: React-Admin + ra-supabase**

**Proč React-Admin:**
- **Production proven** - 25,000+ firem v produkci, 500,000+ sessions denně
- **E-commerce ready** - demo poster shop (produkty, objednávky, zákazníci)
- **Fastest setup** - AdminGuesser scaffold celý admin jedním řádkem (2-3h setup)
- **Oficiální Supabase integrace** - ra-supabase s auth, CRUD, realtime
- **Material-UI (MUI v7)** - profesionální UI framework pro interní nástroje
- **React 19 kompatibilní** - plná podpora nejnovějšího Reactu (od v5.5)
- **Aktivní maintenance** - měsíční updaty v 2025 (v5.3-5.12)
- **Excelentní dokumentace** - obrovská komunita a tutoriály

**Design rozhodnutí:**
- Admin panel je **interní nástroj** (pouze Jana + admin)
- **Nepotřebuje** vizuální konzistenci s hlavním webem (Tailwind)
- Material UI je **standard pro admin panely** (WordPress, Shopify, atd.)
- **DVĚ SEPARÁTNÍ APLIKACE** - main site (zákazníci) vs admin (interní)

**Funkce:**
- Products CRUD (kategorie, PDF upload, obrázky)
- Orders management (Stripe webhook integration)
- Customers management
- Blog posts CRUD
- Custom itinerary requests
- Integration logs viewer
- Newsletter consent log (GDPR)

**File Upload:**
- Standard upload (do 6MB): `ra-supabase` + `<FileInput>`
- Large files (>6MB): TUS resumable upload (`tus-js-client`)
- Chunk size: 6MB (Supabase requirement)
- Free tier limit: 50MB | Pro tier: až 50GB (plánováno později)

## 🏗️ Architektura

- **Functional Components** - žádné class komponenty (kromě Error Boundaries)
- **Custom Hooks** - useNavigation pro složitou navigaci
- **Error Boundaries** - na všech úrovních (App, Layout, Navigation, Hero)
- **React.memo** - optimalizace výkonu
- **forwardRef** - v UI komponentech

## 🎨 Design System

- **Custom Tailwind utilities** - focus-ring, card-hover, text-responsive-*
- **Konzistentní color palette** - Green tema
- **Mobile-first responsive design**
- **Custom UI komponenty** - Button, Form, Input, TextArea, Dropdown

## 📁 Struktura projektu

- **Barrel exports** - čisté importy přes index.js
- **Path aliases** - @components, @pages, @assets
- **Organizace podle funkcí** - components/ui/, components/common/, pages/

## ⚡ Performance & Build

- **Bundle splitting** - vendor chunky pro lepší cache
- **Asset optimization** - 4KB inline limit
- **Tree shaking** - odstranění dead code
- **GitHub Pages deployment** - připraveno k nasazení

## 🛡️ Bezpečnost & Kvalita

- **ESLint** - code quality
- **Logger utility** - bezpečné logování
- **Error handling** - graceful degradation
- **Accessibility** - ARIA labels, focus management

## 🎯 Speciální features

- **České routy** - /muj-pribeh, /cestovni-pruvodci
- **Video Hero s image fallback**
- **Responsive Navigation s mobile menu**
- **Form validation** - custom form handling
- **Image optimization s fallback handling**

---

## 📋 Checklist pro nové stránky

### ✅ Povinné vzory
- [ ] Použití `Layout` wrapperu
- [ ] `PageHero` komponent pro hero sekce
- [ ] React Router `Link` místo `<a>` tagů pro interní navigaci
- [ ] ROUTES konstanty místo hardcoded cest
- [ ] Tykání místo vykání v textech
- [ ] Mobile-first responsive design

### ✅ UI komponenty
- [ ] `Form` komponent pro formuláře
- [ ] `Input`, `TextArea`, `Button` z ui/ složky
- [ ] Placeholder texty v input polích
- [ ] Error handling s graceful degradation

### ✅ Styling konvence
- [ ] Tailwind CSS třídy
- [ ] Custom utilities z `/src/styles/utilities.css`
- [ ] Green color palette (green-600, green-700, green-800)
- [ ] Responsive breakpoints: sm:, md:, lg:, xl:

### ✅ Code standards
- [ ] Functional komponenty s hooks
- [ ] TypeScript prop types (pokud používáme)
- [ ] displayName pro debugging
- [ ] React.memo pro performance optimalizace
- [ ] useCallback pro event handlery

---

**Celkové hodnocení:** Moderní, well-architected React aplikace následující současné best practices s důrazem na výkon, dostupnost a udržitelnost! 🌟

*Poslední aktualizace: Listopad 2025*