# 🚀 Technický přehled projektu Cesty bez mapy

> **Dokumentace pro konzistentní vývoj nových stránek a komponent**

## 🚀 Core Stack

- **React 19.1.0** - nejnovější verze s moderními features
- **React Router 7.7.1** - HashRouter pro GitHub Pages
- **Vite 7.0.4** - moderní build tool místo Create React App
- **Tailwind CSS 4.1.11** - nejnovější verze s Vite integrací

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

*Poslední aktualizace: Prosinec 2024*