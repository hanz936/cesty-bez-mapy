# Cesty bez mapy

React aplikace pro cestovní web s moderním designem a Supabase databází.

## 🚀 Technologie

- **Frontend**: React 19, Vite, Tailwind CSS 4.1
- **Databáze**: Supabase
- **Routing**: React Router
- **SEO**: React Helmet Async
- **Styling**: Tailwind CSS s custom optimalizacemi

## 📦 Instalace

1. **Klonuj repository**
```bash
git clone https://github.com/[username]/cesty-bez-mapy.git
cd cesty-bez-mapy
```

2. **Nainstaluj závislosti**
```bash
npm install
```

3. **Nastav environment variables**
```bash
cp .env.example .env
```
Vyplň své Supabase údaje v `.env` souboru:
- `VITE_SUPABASE_URL` - URL tvého Supabase projektu
- `VITE_SUPABASE_ANON_KEY` - Anon key z Supabase dashboardu

4. **Spusť vývojový server**
```bash
npm run dev
```

## 🗃️ Supabase Setup

Pro práci s Supabase databází:

1. Vytvoř account na [supabase.com](https://supabase.com)
2. Vytvoř nový projekt  
3. Zkopíruj URL a Anon key do `.env` souboru
4. Nastav Row Level Security (RLS) podle potřeby

## 🔒 Bezpečnost

- ❌ **NIKDY** necommituj `.env` soubory
- ✅ Používej pouze `VITE_SUPABASE_ANON_KEY` (public key) ve frontend kódu
- ✅ Service Role Key používej pouze pro server-side operace

## 📱 Funkcionality

- ✅ Mobile-first responsive design
- ✅ Hamburger menu s animacemi
- ✅ Slideshow rotace obrázků
- ✅ SEO optimalizace
- ✅ Accessibility (WCAG)
- ✅ Error boundaries
- ✅ Performance optimalizace
- ✅ Custom itinerary requests (guest checkout)
- ✅ Anonymous authentication support
- ✅ PDF generation via window.print()

## 📚 Dokumentace

Kompletní technická dokumentace se nachází v [docs/](docs/) složce:

- **[Implementation Plan](docs/CUSTOM_ITINERARY_IMPLEMENTATION.md)** - Kompletní implementační plán pro custom itinerary feature
- **[Architecture Decisions](docs/ARCHITECTURE_DECISIONS.md)** - Záznam důležitých architektonických rozhodnutí (ADR)
- **[ROADMAP.md](ROADMAP.md)** - Plán vývoje projektu
- **[TECH_STACK.md](docs/archive/TECH_STACK.md)** - Detailní přehled použitých technologií

## 🛠️ Build

```bash
npm run build
```

## 📄 License

MIT
