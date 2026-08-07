# Dedikovaná stránka recenzí pro produkt

**Datum:** 2026-08-07
**Repo:** `cesty-bez-mapy` (frontend). Admin ani databáze se nemění.
**Stav:** ověřeno nezávislým agentem (Opus 5) proti živým dokumentacím 2026-08-07; nálezy zapracovány.

## Problém

Recenze u produktů se dnes vykreslují tak, že s rostoucím počtem stránku zahltí, a zároveň
se dlouhé recenze nedají dočíst.

Měřeno v prohlížeči nad produkčním buildem (produkt `italie-roadtrip`, viewporty 390 a 1440 px).
V databázi je dnes **jedna** schválená recenze, takže výšky pro 2, 3 a 6 karet vznikly
naklonováním vykreslené karty v DOM nad skutečným CSS — jde o měření rozvržení, ne o odhad
a ne o měření nad živými daty.

1. **Text se ořezává bez konce a bez výpustky.** `ReviewCard` má textový box `h-32`
   (změřeno 128 px) a na odstavci `line-clamp-6`. Do boxu se ale vejde jen **4,92 řádku**
   (řádkování změřeno 26 px), takže se `line-clamp` nikdy neuplatní a `overflow-hidden`
   uřízne text uprostřed řádku. Formulář přitom povoluje `MAX_TEXT = 2000` znaků
   (`src/pages/ReviewSubmit.tsx:18`). **Plný text recenze dnes není dostupný nikde na webu** —
   globální `/recenze` používá tutéž kartu.
2. **Sekce nabobtná.** Výška sekce recenzí při dnešním limitu 6 karet:
   **2 430 px na mobilu** (2,9 násobek viewportu) a 994 px na desktopu.
3. **Rozbitá kompozice při málo recenzích.** `lg:grid-cols-3` s jednou recenzí nechá dvě
   třetiny řádku prázdné.
4. **Chybí souhrn hodnocení.** `ProductDetail` posílá do JSON-LD `aggregateRating`
   (`src/pages/ProductDetail.tsx:335`), ale průměr **nikde na stránce nezobrazuje**.
5. **Překryv odznaku.** Odznak „Ověřeno nákupem“ se překrývá s dekorativním kolečkem
   (`ReviewCard.tsx:62`, `-top-2 -right-2 w-16 h-16` sahá 56 px od pravého okraje, odznak končí
   na 32 px při `p-8` a 40 px při `lg:p-10`). Týká se to **všech šířek**, ne jen mobilu.

## Řešení v jedné větě

Recenze produktu dostanou vlastní stránku `/cestovni-pruvodci/:slug/recenze` s plnými texty
a stránkováním v cestě; na detailu produktu zůstane klikatelný souhrn hodnocení a tři ukázkové recenze.

## Rozhodnutí a jejich zdroje

Zdroje ověřeny 2026-08-07; data uvedená u zdrojů jsou jejich poslední aktualizace.

Spec prošel **dvěma** koly nezávislého ověření. První (Firecrawl + Context7) před sepsáním plánu,
druhé 2026-08-07 nad hotovým plánem třemi Opus auditory — ti měli k dispozici Supabase docs MCP
a přímé čtení primárních zdrojů, protože Context7 ani Firecrawl v té session nebyly dostupné.
Druhé kolo opravilo citaci u `offers` (níže) a přidalo čtyři rozhodnutí označená **[2. kolo]**.

| Rozhodnutí | Zdroj |
|---|---|
| Stránka recenzí nese `Product` + `aggregateRating` + `review[]`, **bez `offers`** | Google, *Product snippet* (2025-12-10) — v tabulce vlastností je `offers` vedené jako *Recommended*, ne *Required*. **Pozor na dřívější nepřesnost v tomto specu:** příklad „Product review page“ ukazuje dvě varianty a ta první `offers` obsahuje; nosným argumentem je tabulka Required/Recommended, ne příklad |
| `Product` musí nést **aspoň jedno** z `review` / `aggregateRating` / `offers` → produkt bez recenzí nedostane JSON-LD vůbec **[2. kolo]** | Google, *Product snippet* (2025-12-10): „You must include one of the following properties: review, aggregateRating, offers“ |
| Na detailu produktu se `review[]` zkrátí na 3 zobrazené | Google, *Structured data general guidelines* (2026-07-10): „include all of the reviews that are **visible** to people on the page“; „**Don't** mark up content that is not visible“ |
| `aggregateRating` smí na detailu zůstat jen se **zobrazeným** průměrem | Google, *Review snippet* (2026-07-24): „If you use `AggregateRating`, users should be able to see that aggregate rating on the page“ |
| Zobrazený průměr a `ratingValue` musí být **totéž číslo** → jedna sdílená zaokrouhlovací funkce **[2. kolo]** | DB drží `round(avg, 2)` (`20260711130000_add_reviews_system.sql:88`), tedy např. `4.67`, zatímco souhrn zobrazuje `4,7`. Google, *Structured data general guidelines* (2026-07-10): „Don't mark up content that is not visible to readers of the page“ |
| Aktuální strana stránkování **zůstává odkazem** s `aria-current="page"` **[2. kolo]** | W3C Design System, *Pagination*: „it is fully linked so users of Assistive Technology can find which is the currently active link“. Rozhodl uživatel 2026-08-07 |
| `robots` je jen `noindex`, bez `follow` **[2. kolo]** | Google, *Robots meta tag* (2026-03-24) — `follow` není mezi platnými pravidly; následování odkazů je výchozí chování |
| Omezení self-serving recenzí se nás **netýká** | Google, *Review snippet* (2026-07-24) — omezení je výslovně jen pro `LocalBusiness` a ostatní typy `Organization`; `Product` v tom výčtu není |
| Stránkování přes `<a href>`, ne tlačítko | Google, *Pagination* (2025-12-10): „crawlers don't ‚click‘ buttons“ |
| Každá strana má **vlastní** canonical | Google, *Pagination* (2025-12-10): „Don't use the first page of a paginated sequence as the canonical page“ |
| Stránkování **v cestě**, ne v query parametru | Google, *Consolidate duplicate URLs* (2026-07-10): „specify the canonical URL in the HTML source code and **make sure that JavaScript doesn't change the canonical link element**“ — viz „Proč cesta a ne parametr“ níže |
| Odkaz zpět na první stranu z každé strany | Google, *Pagination* (2025-12-10) |
| Disclosure na každé stránce, kde recenze zobrazujeme | § 5a odst. 5 zákona č. 634/1992 Sb.; v repu `src/components/reviews/disclosure.ts`. Podpůrně Google, *Review snippet* (2026-07-24): „Don't include fake or **undisclosed** incentivized reviews“ |
| Průměr vždy s počtem hodnocení | Baymard — bez počtu uživatelé průměru nedůvěřují |
| Rozpad hodnocení (graf 5★…1★) se **nestaví** | Baymard: „consider hiding the ratings UI when there are less than 5 ratings“ — v DB je dnes 1 schválená recenze |

**Nezjištěno:** žádná Googlem dokumentovaná horní mez počtu `review` v markupu neexistuje;
jediné pravidlo je shoda s viditelným obsahem. Rovněž neexistuje Googlovo stanovisko ke dvěma
stránkám s `Product` markupem pro tentýž produkt — viz „Přijatá rizika“.

### Proč cesta a ne parametr

Původní návrh používal `?strana=n`. To ale v tomhle projektu naráží: `vercel.json` má
`cleanUrls: true` a rewrite `/(.*) → /`, takže `…/recenze?strana=2` má **stejnou cestu** jako
strana 1 a Vercel podá prerenderovaný soubor strany 1 — jehož zdrojové HTML nese canonical
strany 1. JavaScript by ho pak přepsal, což je přesně případ, který Google zakazuje.
Riziko zvyšuje i to, že React 19 per-route `<meta>`/`<link>` nededupuje (viz komentář
v `scripts/prerender.mjs:81-83`), takže by mohly vzniknout dva `<link rel="canonical">`.

Se stránkováním v cestě má každá strana vlastní soubor, a tedy správný canonical, titulek
i JSON-LD **už ve zdrojovém HTML**. Googlův `?page=n` je v dokumentaci uveden jen jako příklad
(„For example, include a `?page=n` query parameter“), cesta je rovnocenná.

## Architektura

### Routy

- `/cestovni-pruvodci/:slug/recenze` — strana 1
- `/cestovni-pruvodci/:slug/recenze/strana/:strana` — strany 2 a dál
- `/cestovni-pruvodci/:slug/recenze/strana/1` → přesměrování na adresu bez `/strana/1`

React Router 7 řadí routy podle specifičnosti, ne podle pořadí zápisu (ověřeno v jeho testech
`path-matching-test.tsx`), takže nové routy nekolidují se statickými cestami v `src/App.tsx:108-112`.
Žádná statická routa nemá `recenze` jako třetí segment. Produkt `itinerar-na-miru` má v DB
vlastní záznam, takže i jeho stránka recenzí funguje.

### Jednotky

| Jednotka | Odpovědnost | Závislosti |
|---|---|---|
| `ProductRatingSummary` (nová) | Proužek „★★★★★ 5,0 · 12 recenzí“; s `href` jako `<a>`, bez `href` jako statický text | jen props |
| `ProductReviewsPage` (nová) | Stránka: souhrn, disclosure, plné texty, stránkování, odkaz zpět na produkt | `lib/reviews`, `ReviewCard`, `ReviewsPagination` |
| `ReviewsPagination` (nová, sdílená) | `<nav>` s odkazy na strany | jen props (`currentPage`, `totalPages`, `buildHref`) |
| `ReviewCard` (úprava) | Jedna recenze v režimu `teaser` \| `full` | žádné |
| `ProductReviews` (úprava) | 3 ukázkové recenze na detailu + odkaz na stránku recenzí | `lib/reviews`, `ReviewCard` |
| `ProductDetail` (úprava) | Preload recenzí, `seoReviews`, umístění `ProductRatingSummary` | `lib/reviews` |
| `SeoTags` (úprava) | Volitelná `robots` meta značka | žádné |
| `lib/reviews.ts` (doplnění) | Dotazy do DB, řazení s rozhodujícím druhým klíčem | Supabase |
| `scripts/contentSlugs.mjs` (úprava) | `fetchProductSlugs()` musí vracet i `review_count` | Supabase REST |
| `scripts/prerender.mjs`, `scripts/sitemap.mjs` (úprava) | Routy recenzí včetně dalších stran | `contentSlugs`, `constants/reviews` |
| `constants/reviews.ts` (nová) **[2. kolo]** | `REVIEWS_PAGE_SIZE`, `PRODUCT_REVIEWS_LIMIT`, `MAX_PRERENDERED_REVIEW_PAGES`, `clampPage()` | žádné |
| `utils/rating.ts` (nová) **[2. kolo]** | Zaokrouhlení průměru pro zobrazení i pro `ratingValue` | žádné |
| `components/reviews/paginationItems.ts` (nová) **[2. kolo]** | Které strany se ve stránkování vypíšou (zkrácení dlouhých sekvencí) | žádné |

`ReviewCard` ani `ReviewsPagination` nevědí nic o Supabase — načítání zůstává v `lib/reviews.ts`
a ve stránkách. Každou jednotku lze testovat samostatně přes props.

**Limit recenzí na detailu musí být jedna sdílená konstanta.** Dnes je hodnota na dvou místech:
`PRODUCT_REVIEWS_LIMIT` v `ProductReviews.tsx:12` a **natvrdo `limit: 6`** v `ProductDetail.tsx:111`
(jen s komentářem, že se rovná konstantě). Změna jen konstanty by se na detailu neprojevila.

### Databáze

**Jedna migrace [2. kolo].** Agregáty se nemění — `products.average_rating` a `review_count`
dál udržuje trigger `refresh_product_rating` (migrace `20260711130000_add_reviews_system.sql:76,100`,
ověřeno, že počítá **jen schválené** recenze) a `fetchApprovedReviews` už přijímá `productId`,
`limit`, `offset` a vrací `count: 'exact'`.

Přibývá ale trigger `trg_reviews_deploy_hook`, který po změně schválených recenzí volá Vercel
deploy hook — stejně jako `trg_blog_publish_deploy` u blogu. Bez něj by prerenderovaný `noindex`
u produktu bez recenzí zůstal i po schválení první recenze, a hlubší strany by vznikaly v živém
DOMu dřív, než pro ně existuje statické HTML. Klientsky se to spravit nedá: u `noindex` může
Google rendering a vykonání JavaScriptu přeskočit.
Žádná migrace, žádná nová RLS politika, žádné nové sloupce.

Do budoucna (ne teď): až počet recenzí poroste, bude se hodit složený index
`(product_id, created_at DESC)` — dnešní migrace má jen `(product_id, status)` a `(created_at DESC)`.
Při současném objemu je `count: 'exact'` bez výhrad v pořádku.

## Chování

### Detail produktu

- `ProductRatingSummary` u titulku produktu, jako odkaz na stránku recenzí; při
  `review_count === 0` se nezobrazí vůbec.
- Sekce recenzí ukáže **3 nejnovější** recenze v režimu `teaser`.
- Mřížka zůstane `lg:grid-cols-3`; při méně než 3 recenzích se vycentruje s omezenou šířkou,
  aby nevznikl uťatý řádek.
- Odkaz „Všechny recenze (N)“ se zobrazí **při `review_count > 0`** (dnes až nad limitem,
  `ProductReviews.tsx:132`) — má smysl i u jediné recenze, protože na stránce je v plném znění.
- Změřený dopad: sekce klesne z 2 430 px na **1 341 px** na mobilu; na desktopu z 994 px na
  **615 px**, protože tři karty vyplní jeden řádek beze zbytku.

### Stránka recenzí

- `<h1>` s názvem produktu (vyžaduje to `validateHtml` v `scripts/prerender.mjs:102-107`,
  jinak build spadne).
- Souhrn hodnocení nahoře — tentýž vizuál jako `ProductRatingSummary`, ale **bez odkazu**
  (stránka by odkazovala sama na sebe).
- **`REVIEWS_DISCLOSURE`** pod nadpisem, stejně jako na detailu (`ProductReviews.tsx:106`).
  Zákonná povinnost, ne kosmetika.
- **10 recenzí na stranu, jeden sloupec, plný text bez ořezu.** Odstavec dostane omezenou
  šířku řádku kvůli čitelnosti — třísloupcová mřížka je pro texty do 2 000 znaků nevhodná.
- Stránkování dole: předchozí / čísla stran / další, plus odkaz na první stranu.
- Odkaz zpět na detail produktu.

### Stránkování a okrajové případy

Počet stran se počítá z **`products.review_count`**, které stránka získá už při dohledání
produktu podle slugu — ne z `count` vráceného stránkovaným dotazem. Důvod je ověřený živě proti
produkční databázi: PostgREST na `Range` mimo rozsah vrací **HTTP 416**, a protože
`fetchApprovedReviews` na chybu vyhazuje výjimku (`src/lib/reviews.ts:46`), z takové odpovědi
se `count` už nedozvíme. Strana se proto **ořízne do platného rozsahu ještě před** voláním
`fetchApprovedReviews` a dotaz mimo rozsah se nikdy neodešle.

| Situace | Chování |
|---|---|
| Produkt neexistuje / není aktivní | `NotFound` |
| Produkt bez recenzí | Prázdný stav + `noindex` **ve zdrojovém HTML** (stránka se prerenderuje) |
| Strana mimo rozsah (např. 99 ze 3) | Přesměrování na poslední platnou stranu přes `<Navigate replace>` |
| Strana nečíselná nebo < 1 | Přesměrování na stranu 1 |
| `/strana/1` | Přesměrování na adresu bez `/strana/1` — jinak dvě adresy s týmž obsahem |
| Selhání načtení recenzí | Poctivá chybová hláška, **ne** „žádné recenze“ — dle zavedeného vzoru v `ProductReviews.tsx:67-77` |

`replace` zajistí, že se neplatná adresa nezanese do historie prohlížeče. **Pozor na výklad:**
`<Navigate replace>` používá `history.replaceState`, což **není** „JavaScript `location`
přesměrování“ ve smyslu Googlovy dokumentace — Googlebot to neuvidí jako přesměrování, ale jako
obsah pod původní adresou. Spoléháme na to, že tyhle adresy nikde neodkazujeme a nejsou
v sitemapě; SEO signál to není a spec si na něj nenárokuje.

### Řazení

Stránkovaný dotaz řadí `created_at DESC, id DESC`. Samotné `created_at` nestačí: Supabase
k `range()` upozorňuje, že „respects the query order“ — při shodných časech (dávkové schválení,
import) by se řádek mohl mezi stranami zopakovat nebo přeskočit.

## SEO

### JSON-LD

**Detail produktu** (merchant listing) — `offers` beze změny, `aggregateRating` zůstává
(nově je průměr i vidět), `review[]` **zkrácené na 3 zobrazené**.

**Stránka recenzí** (product snippet) — `Product` + `name` + `description` +
`aggregateRating` + `review[]` odpovídající **právě zobrazené straně**. Bez `offers`.

V `src/utils/productSeo.ts` přibude samostatná funkce vedle `buildProductMeta`; mapování
`Review` se sdílí, aby nevznikly dvě verze pravdy.

Vzor `ItemPage`/`WebPage` s `mainEntity` se **nepoužívá** — Googlem doporučený tvar pro tenhle
případ je přímo `Product` (viz jeho příklad „Product review page“) a `ItemPage` mezi typy
způsobilými pro review snippet vůbec není.

### Indexace

- Každá strana má canonical **sama na sebe**, zapsaný už ve zdrojovém HTML.
- Titulky se rozliší: „Recenze — {produkt}“ vs „Recenze — {produkt} (strana 2)“.
- **Prerenderují se routy recenzí pro všechny aktivní produkty**, včetně těch bez recenzí
  (těch je málo a je to jediný způsob, jak dostat správný `canonical` i `robots` do statického
  HTML). U produktu bez recenzí nese zdrojové HTML `noindex`.
  Bez toho by neprerenderovaná adresa dostala přes rewrite prázdnou skořápku `index.html`.
- **Z `index.html:17` mizí natvrdo zapsaný `canonical` na homepage [2. kolo].** Dokud tam je,
  dostane ho každá neprerenderovaná adresa a `SeoTags` ho pak přepíše — přesně ten zakázaný
  vzorec. Google pro takový případ nabízí: „If you can't set the canonical URL in the HTML
  source code, leave it out and only set it with JavaScript.“
- Prerenderují se i další strany; jejich počet plyne z `review_count`, který proto musí
  `fetchProductSlugs()` vracet (`scripts/contentSlugs.mjs:25` dnes selectuje jen `slug`).
- Totéž rozšíření dostane `scripts/sitemap.mjs`.
- Stránka použije `<Layout ready={…}>` navázané na načtená data, jako to dělá
  `ProductDetail.tsx:329` — jinak by prerender zachytil načítací stav.

## Přístupnost

- Souhrn je jeden `<a>` s přístupným názvem „Hodnocení 5 z 5, 12 recenzí — zobrazit všechny
  recenze“; hvězdičky jsou `aria-hidden`, význam nese text. (WAI-ARIA APG *Link Pattern*:
  „Authors are strongly encouraged to use a native host language link element.“)
- Stránkování: `<nav aria-label="Stránkování recenzí">`, aktuální strana je **odkaz** s
  `aria-current="page"` **[2. kolo]**. Sekvence delší než 7 stran se uprostřed zkracuje výpustkou.
- Stránka **nerenderuje vlastní `<main>`** — `Layout.tsx:86` ho už má a druhý orientační bod je
  nevalidní HTML i špatný cíl pro skip-link. Uživatel rozhodl 2026-08-07 sjednotit i zbylých
  16 stránek, které tuhle chybu mají **[2. kolo]**.
- **Každý odkaz stránkování má vlastní `aria-label`** — „Strana 2“, „Předchozí strana“,
  „Další strana“. Holé číslo „2“ jako název odkazu nestačí.
- Po přechodu na jinou stranu se fokus přesune na nadpis seznamu (`tabIndex={-1}`), a to
  **jen po skutečné navigaci v aplikaci** — poznáno podle `location.key`, ne podle změny čísla
  strany. Číslo strany totiž vyskočí z 1 na 2 i při přímém příchodu na `/strana/2` z Googlu,
  a fokus by uživatele vysadil doprostřed právě otevřené stránky **[2. kolo]**. Prstenec fokusu
  zůstává viditelný (`focus-visible`).
- Oprava překryvu odznaku „Ověřeno nákupem“ s dekorativním kolečkem — **na všech šířkách**,
  ne pod breakpointem.

## Testy

Vitest + React Testing Library, ve stylu `ProductReviews.test.tsx` a `ReviewsSection.test.tsx`.

- `ReviewCard` — režim `teaser` ořezává **s viditelnou výpustkou** (regrese na změřenou vadu
  4,92 vs 6 řádků); režim `full` vykreslí celý text o 2 000 znacích.
- `ProductRatingSummary` — skryje se při 0 recenzích; s `href` je odkaz, bez něj statický text;
  má přístupný název.
- `ProductReviewsPage` — offset pro stranu 2; počet stran z `review_count`; **strana mimo rozsah
  se ořízne bez odeslání dotazu** (regrese na PostgREST 416); přesměrování při `/strana/1`
  a při nečíselném vstupu; prázdný stav; chybový stav; **vykreslí disclosure**.
- `ReviewsPagination` — `aria-current` na aktuální straně; `aria-label` u každého odkazu;
  adresy odkazů; odkaz na první stranu.
- `productSeo` — stránka recenzí nemá `offers`; `review[]` se rovná počtu vykreslených recenzí;
  detail produktu má nejvýš 3.
- `prerender.test.js` a `sitemap.test.js` — routy recenzí pro aktivní produkty včetně dalších stran,
  plus strop počtu předgenerovaných stran.
- Sdílená konstanta limitu — test, že detail preloaduje i vykresluje tentýž počet.
- `clampPage` **[2. kolo]** — tabulka vstupů z adresy (`0`, `-1`, `abc`, `2.5`, `02`, `0x2`, `2e1`,
  `+2`, `' 2 '`, prázdný řetězec, `Infinity`, arabská číslice) a jistota, že žádný nevede na
  přesměrovací smyčku.
- `rating` **[2. kolo]** — zobrazený řetězec a `ratingValue` nesou tutéž hodnotu.
- `paginationItems` **[2. kolo]** — zkracování dlouhých sekvencí, nikdy strana mimo rozsah.
- `index.html` **[2. kolo]** — strážce, že se do šablony nevrátí natvrdo zapsaný `canonical`.
- `src/pages` **[2. kolo]** — strážce, že žádná stránka nerenderuje vlastní `<main>`.
- `04_reviews.test.sql` **[2. kolo]** — pgTAP: deploy-hook funkce i trigger na `reviews` existují.

## Přijatá rizika

**Stránka recenzí je u produktů s 1–3 recenzemi obsahově blízká detailu produktu.** Detail
zobrazuje 3 nejnovější recenze, takže do tří recenzí nese podstránka tytéž recenze. Google řeší
„duplicate or **very similar** pages“ volbou kanonické stránky a může si vybrat jinou, než chceme:
„indicating a canonical preference is a **hint, not a rule**.“

Uživatel rozhodl 2026-08-07, že stránka má vznikat **už od 1 recenze** — jednodušší a stále
stejné pravidlo. Zmírňuje to, že podstránka nese recenze v **plném znění** (na detailu jsou
ořezané) a nemá `offers`. Po spuštění stojí za kontrolu v Search Console, kterou stránku Google
zvolil jako kanonickou.

Odlišné titulky a popisy **jako argument neobstojí** [2. kolo]: Google k paginaci výslovně říká,
že „pages in a paginated sequence don't need to follow this recommendation. You can use the same
titles and descriptions for all pages in the sequence.“ Rozlišujeme je pro čitelnost, ne jako
ochranu proti duplicitě.

**Strana mimo rozsah se řeší klientským přesměrováním, ne stavem 404.** Google pro měkké 404 v SPA
dokumentuje dvě cesty — JS redirect na adresu vracející 404, nebo `noindex` přidaný JavaScriptem.
Volíme přesměrování na nejbližší platnou stranu (rozhodnutí uživatele) doplněné o `noindex`, protože
`history.replaceState` Googlebot nevidí jako přesměrování. Tyhle adresy se nikde neodkazují ani
nedávají do sitemapy.

## Před sloučením ověřit ručně

**1. Rich Results Test.** Nemá veřejné API, takže se neověřil automaticky. Před merge protáhnout
jednou reálnou adresou stránky recenzí a potvrdit, že `Product` bez `offers` projde
(dle tabulky Required/Recommended v *Product snippet* je `offers` jen doporučené, ne povinné).

**2. Hloubka cest na Vercelu [2. kolo].** Vercel dokumentace potvrzuje, že se filesystem uplatní
před rewrity („precedence is given to the filesystem prior to rewrites being applied“), ale
o adresářových indexech u `cleanUrls` mlčí. V tomhle projektu je mechanismus prokázaný jen do
hloubky 2 (`/cestovni-pruvodci/:slug`); routy recenzí jdou do hloubky 3 a 4. Nutný smoke na
preview deploy — kdyby se vracela SPA skořápka místo prerenderovaného souboru, padá celý SEO přínos.

**3. Předlaunchová hlavička [2. kolo].** `vercel.json:23` posílá na všechny odpovědi
`X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`. Dokud tam je, canonical, `robots` ani
JSON-LD z téhle práce v produkci nic neovlivní. Skutečné ověření v Search Console je tedy až
po jejím odstranění při launchi.

## Mimo rozsah

Nalezeno cestou, neřeší se v této práci:

1. **`NotFound` nemá `robots` meta.** `src/pages/NotFound.tsx` (62 řádků) neobsahuje žádné
   `noindex`. Dnes to maskuje předlaunchová hlavička `X-Robots-Tag: noindex` ve `vercel.json`,
   ta ale při spuštění zmizí a všechny neexistující routy se stanou měkkými 404. Podle Googlu
   (*JavaScript SEO basics*, 2026-03-04) je řešením `noindex` na chybové stránce. Po této práci
   bude `SeoTags` `robots` už umět, takže půjde o jednořádkovou opravu.
2. **Globální `/recenze` stahuje všechna hodnocení.** `fetchReviewStats` v `src/lib/reviews.ts:52`
   volá `select('rating')` bez limitu, tedy při každé návštěvě stáhne všechny schválené recenze
   jen kvůli průměru. Role `anon` má `statement_timeout=3s` (ověřeno v `pg_roles`).
   `products.average_rating` je přitom v DB hotová; chybí jen globální agregát.
3. **Globální `/recenze` má `ready` napevno.** `src/pages/Reviews.tsx:24` předává `<Layout ready>`
   jako konstantu, takže prerender nečeká na recenze. Opravu `ReviewCard` ale stránka zdědí.

4. **`fetchApprovedReviews` posílá `count: 'exact'` i tam, kde ho nikdo nepotřebuje.** Stránka
   recenzí počítá strany z `review_count`. Exact COUNT je při dnešním objemu bez dopadu, ale je
   to zároveň jediná příčina odpovědí 416 — bez count preference by PostgREST vrátil 200 a prázdné
   pole. Odstranit jde jen rozdělením funkce, protože globální `/recenze` `total` potřebuje.
5. **`productReviewsPath()` skládá cestu natvrdo**, zatímco `ROUTES.PRODUCT_REVIEWS` drží tentýž
   tvar jako pattern. Dvě verze pravdy pro jednu cestu; sjednocení je zásah do všech rout.

Body 1 a 2 jsou před spuštěním relevantní; doporučuji je vzít jako samostatné úkoly.
