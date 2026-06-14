# Manuální setup — Umami analytika

Cookieless analytika přes Umami Cloud (EU region). Aktivuje se až po nastavení env.

## 1. Účet a web
1. Registrace na https://cloud.umami.is/signup (plán **Hobby/Free**).
2. Při zakládání zvolit **EU region** (data v EU).
3. Settings → Websites → **Add website**: name `Cesty bez mapy`,
   domain `cestybezmapy.cz`.
4. Zkopírovat **Website ID** (UUID) a ověřit tracking host (očekáváme
   `https://cloud.umami.is/script.js`).

## 2. Env ve Vercelu (Production)
- `VITE_UMAMI_WEBSITE_ID` = zkopírované Website ID.
- `VITE_UMAMI_SRC` = jen pokud dashboard ukazuje jiný host než default.
- Redeploy. Pokud je host jiný, upravit i CSP ve `vercel.json`
  (`script-src` + `connect-src`).

## 3. Čeština + sdílení Janě
- Umami → Settings → Profile → **Language: Čeština**.
- Sdílet přístup Janě (Team member, nebo Website → Share URL pro jen-čtení).

## 4. Ověření
- Otevřít web, projít stránky → v Umami dashboardu naskočí pageviews.
- Vyvolat add-to-cart / begin-checkout / newsletter → eventy v sekci Events.
- Po testovacím nákupu zkontrolovat **Revenue** (CZK).
- Funnel: `/cestovni-pruvodci` → `add-to-cart` → `begin-checkout` → `purchase`.
