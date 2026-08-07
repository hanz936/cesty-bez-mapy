# Dedikovaná stránka recenzí pro produkt

**Datum:** 2026-08-07
**Repo:** `cesty-bez-mapy` (frontend). Admin ani databáze se nemění.

## Problém

Recenze u produktů se dnes vykreslují tak, že s rostoucím počtem stránku zahltí, a zároveň
se dlouhé recenze nedají dočíst. Vše níže je změřeno v prohlížeči nad produkčním buildem
(produkt `italie-roadtrip`, viewporty 390 a 1440 px), ne odhadnuto.

1. **Text se ořezává bez konce a bez výpustky.** `ReviewCard` má textový box `h-32`
   (změřeno 128 px) a na odstavci `line-clamp-6`. Do boxu se ale vejde jen **4,92 řádku**
   (řádkování změřeno 26 px), takže se `line-clamp` nikdy neuplatní a `overflow-hidden`
   uřízne text uprostřed řádku. Formulář přitom povoluje `MAX_TEXT = 2000` znaků
   (`src/pages/ReviewSubmit.tsx:18`). **Plný text recenze dnes není dostupný nikde na webu** —
   globální `/recenze` používá tutéž kartu.
2. **Sekce nabobtná.** Změřená výška sekce recenzí při dnešním limitu 6 karet:
   **2 430 px na mobilu** (2,9 násobek viewportu) a 994 px na desktopu.
3. **Rozbitá kompozice při málo recenzích.** `lg:grid-cols-3` s jednou recenzí nechá dvě
   třetiny řádku prázdné.
4. **Chybí souhrn hodnocení.** `ProductDetail` posílá do JSON-LD `aggregateRating`
   (`src/pages/ProductDetail.tsx:335`), ale průměr **nikde na stránce nezobrazuje**.
5. **Překryv na mobilu.** Odznak „Ověřeno nákupem“ se při 390 px překrývá s dekorativním
   kolečkem v pravém horním rohu karty.

## Řešení v jedné větě

Recenze produktu dostanou vlastní stránku `/cestovni-pruvodci/:slug/recenze` s plnými texty
a stránkováním; na detailu produktu zůstane klikatelný souhrn hodnocení a tři ukázkové recenze.

## Rozhodnutí a jejich zdroje

Zdroje ověřeny 2026-08-07 přes Firecrawl a Context7.

| Rozhodnutí | Zdroj |
|---|---|
| Stránka recenzí nese `Product` + `aggregateRating` + `review[]`, **bez `offers`** | Google, *Product snippet* — vzorový příklad „Product review page“ obsahuje přesně tyto vlastnosti a žádné `offers` |
| Na detailu produktu se `review[]` zkrátí na 3 zobrazené | Google, *Structured data general guidelines* (2026-07-10): „include all of the reviews that are **visible** to people on the page“; „**Don't** mark up content that is not visible“ |
| `aggregateRating` smí na detailu zůstat jen se **zobrazeným** průměrem | Google, *Review snippet*: „If you use `AggregateRating`, users should be able to see that aggregate rating on the page“ |
| Stránkování přes `<a href>`, ne tlačítko | Google, *Pagination*: „Google generally crawls URLs found in the `href` attribute… crawlers don't ‚click‘ buttons“ |
| Každá strana má **vlastní** canonical | Google, *Pagination*: „Don't use the first page of a paginated sequence as the canonical page“ |
| Odkaz zpět na první stranu z každé strany | Google, *Pagination* — doporučení pro zdůraznění začátku kolekce |
| Mimo rozsah → **klientské přesměrování**, ne chybová stránka | Google, *JavaScript SEO basics* (2026-03-04): v SPA nelze vrátit smysluplný stavový kód; doporučeny JS přesměrování nebo `noindex`. Google následuje i „JavaScript `location`“ přesměrování (*Redirects and Google Search*) |
| Průměr vždy s počtem hodnocení | Baymard — bez počtu uživatelé průměru nedůvěřují |
| Rozpad hodnocení (graf 5★…1★) se **nestaví** | Baymard: „consider hiding the ratings UI when there are less than 5 ratings“ — v DB je dnes 1 schválená recenze |

**Nezjištěno:** žádná Googlem dokumentovaná horní mez počtu `review` v markupu neexistuje;
jediné pravidlo je shoda s viditelným obsahem.

## Architektura

### Routy

- `/cestovni-pruvodci/:slug/recenze` — strana 1
- `?strana=2`, `?strana=3` … — další strany (strana 1 je bez parametru)

React Router 7 řadí routy podle specifičnosti, ne podle pořadí zápisu, takže nová routa
nekoliduje se statickými cestami v `src/App.tsx:108-112`. Produkt `itinerar-na-miru` má
v DB vlastní záznam, takže i jeho stránka recenzí funguje.

### Jednotky

| Jednotka | Odpovědnost | Závislosti |
|---|---|---|
| `ProductRatingSummary` (nová) | Proužek „★★★★★ 5,0 · 12 recenzí“ jako jeden `<a>` na stránku recenzí | jen props |
| `ProductReviewsPage` (nová) | Stránka: souhrn, plné texty, stránkování, odkaz zpět na produkt | `lib/reviews`, `ReviewCard`, `ReviewsPagination` |
| `ReviewsPagination` (nová, sdílená) | `<nav>` s odkazy na strany | jen props (`currentPage`, `totalPages`, `buildHref`) |
| `ReviewCard` (úprava) | Jedna recenze v režimu `teaser` \| `full` | žádné |
| `ProductReviews` (úprava) | 3 ukázkové recenze na detailu + odkaz na vše | `lib/reviews`, `ReviewCard` |
| `lib/reviews.ts` (doplnění) | Dotazy do DB | Supabase |

`ReviewCard` ani `ReviewsPagination` nevědí nic o Supabase — načítání zůstává v `lib/reviews.ts`
a ve stránkách. Každou jednotku lze testovat samostatně přes props.

### Databáze

**Beze změny.** `products.average_rating` a `review_count` už udržuje trigger
`refresh_product_rating` (migrace `20260711130000_add_reviews_system.sql`) a
`fetchApprovedReviews` už přijímá `productId`, `limit`, `offset` a vrací `count: 'exact'`.
Žádná migrace, žádná nová RLS politika, žádné nové sloupce.

## Chování

### Detail produktu

- `ProductRatingSummary` u titulku produktu; při `review_count === 0` se nezobrazí vůbec.
- Sekce recenzí ukáže **3 nejnovější** recenze (`PRODUCT_REVIEWS_LIMIT` 6 → 3) v režimu `teaser`.
- Mřížka zůstane `lg:grid-cols-3`; při méně než 3 recenzích se vycentruje s omezenou šířkou,
  aby nevznikl uťatý řádek.
- Odkaz „Všechny recenze (N)“ vede na `/cestovni-pruvodci/:slug/recenze`, ne na globální `/recenze`.
- Změřený dopad: sekce klesne z 2 430 px na **1 341 px** na mobilu; na desktopu z 994 px na
  **615 px**, protože tři karty vyplní jeden řádek beze zbytku.

### Stránka recenzí

- `<h1>` s názvem produktu (vyžaduje to `validateHtml` v `scripts/prerender.mjs:104-110`,
  jinak build spadne).
- Souhrn hodnocení nahoře — tentýž vizuál jako `ProductRatingSummary`, ale **bez odkazu**
  (stránka by odkazovala sama na sebe). Komponenta proto přijme volitelné `href`; když chybí,
  vykreslí se jako statický text.
- **10 recenzí na stranu, jeden sloupec, plný text bez ořezu.** Odstavec dostane omezenou
  šířku řádku kvůli čitelnosti — třísloupcová mřížka je pro texty do 2 000 znaků nevhodná.
- Stránkování dole: předchozí / čísla stran / další, plus odkaz na první stranu.
- Odkaz zpět na detail produktu.

### Okrajové případy

| Situace | Chování |
|---|---|
| Produkt neexistuje / není aktivní | `NotFound` |
| Produkt bez recenzí | Prázdný stav + `noindex`; z detailu na stránku nevede odkaz |
| `?strana` mimo rozsah (např. 99 ze 3) | Přesměrování na **poslední platnou** stranu přes `<Navigate replace>` |
| `?strana` nečíselné nebo < 1 | Přesměrování na stranu 1 |
| `?strana=1` | Přesměrování na adresu bez parametru — jinak by vznikly dvě adresy s týmž obsahem |
| Selhání načtení recenzí | Poctivá chybová hláška, **ne** „žádné recenze“ — dle zavedeného vzoru v `ProductReviews.tsx:67-77` |

`replace` u přesměrování zajistí, že se neplatná adresa nezanese do historie prohlížeče.

## SEO

### JSON-LD

**Detail produktu** (merchant listing) — `offers` beze změny, `aggregateRating` zůstává
(nově je průměr i vidět), `review[]` **zkrácené na 3 zobrazené**.

**Stránka recenzí** (product snippet) — `Product` + `name` + `description` +
`aggregateRating` + `review[]` odpovídající **právě zobrazené straně**. Bez `offers`.

V `src/utils/productSeo.ts` přibude samostatná funkce vedle `buildProductMeta`; mapování
`Review` se sdílí, aby nevznikly dvě verze pravdy.

### Indexace

- Každá strana má canonical **sama na sebe**.
- Titulky se rozliší: „Recenze — {produkt}“ vs „Recenze — {produkt} (strana 2)“.
- `scripts/prerender.mjs` a `scripts/sitemap.mjs` dostanou routy recenzí **jen pro produkty
  s `review_count > 0`**; prerenderuje se pouze strana 1, hlubší strany dojde Google po odkazech.
- Stránka použije `<Layout ready={…}>` navázané na načtená data, jako to dělá
  `ProductDetail.tsx:329` — jinak by prerender zachytil načítací stav.

## Přístupnost

- Souhrn je jeden `<a>` s přístupným názvem „Hodnocení 5 z 5, 12 recenzí — zobrazit všechny
  recenze“; hvězdičky jsou `aria-hidden`, význam nese text.
- Stránkování: `<nav aria-label="Stránkování recenzí">`, aktuální strana `aria-current="page"`.
- Po přechodu na jinou stranu se fokus přesune na nadpis seznamu (`tabIndex={-1}`).
- Oprava překryvu odznaku „Ověřeno nákupem“ s dekorativním kolečkem na mobilu.

## Testy

Vitest + React Testing Library, ve stylu `ProductReviews.test.tsx` a `ReviewsSection.test.tsx`.

- `ReviewCard` — režim `teaser` ořezává **s viditelnou výpustkou** (regrese na změřenou vadu
  4,92 vs 6 řádků); režim `full` vykreslí celý text o 2 000 znacích.
- `ProductRatingSummary` — skryje se při 0 recenzích; míří na správnou URL; má přístupný název.
- `ProductReviewsPage` — offset pro `?strana=2`; počet stran; prázdný stav; chybový stav;
  přesměrování při straně mimo rozsah i při nečíselném vstupu.
- `ReviewsPagination` — `aria-current` na aktuální straně; adresy odkazů; odkaz na první stranu.
- `productSeo` — stránka recenzí nemá `offers`; `review[]` se rovná počtu vykreslených recenzí;
  detail produktu má nejvýš 3.
- `prerender.test.js` a `sitemap.test.js` — routy recenzí jen pro produkty s recenzemi.

## Mimo rozsah

Nalezeno cestou, neřeší se v této práci:

1. **`NotFound` nemá `robots` meta.** `src/pages/NotFound.tsx` (62 řádků) neobsahuje žádné
   `noindex`. Dnes to maskuje předlaunchová hlavička `X-Robots-Tag: noindex` ve `vercel.json`,
   ta ale při spuštění zmizí a všechny neexistující routy se stanou měkkými 404. Podle Googlu
   (*JavaScript SEO basics*, 2026-03-04) je řešením `noindex` na chybové stránce.
2. **Globální `/recenze` stahuje všechna hodnocení.** `fetchReviewStats` v `src/lib/reviews.ts:52`
   volá `select('rating')` bez limitu, tedy při každé návštěvě stáhne všechny schválené recenze
   jen kvůli průměru. Role `anon` má `statement_timeout=3s` (ověřeno v `pg_roles`), žádný
   `db_max_rows` nastavený není — takže se nic tiše neořízne, ale objem poroste lineárně.
   `products.average_rating` je přitom v DB hotová; chybí jen globální agregát.
3. **Globální `/recenze` má `ready` napevno.** `src/pages/Reviews.tsx:24` předává `<Layout ready>`
   jako konstantu, takže prerender nečeká na recenze. Opravu `ReviewCard` ale stránka zdědí.

Body 1 a 2 jsou před spuštěním relevantní; doporučuji je vzít jako samostatné úkoly.
