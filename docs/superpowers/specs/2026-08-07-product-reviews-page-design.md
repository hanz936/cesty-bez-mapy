# Dedikovaná stránka recenzí pro produkt

**Datum:** 2026-08-07
**Repo:** `cesty-bez-mapy` (frontend). Admin ani databáze se nemění.
**Stav:** ověřeno třemi koly nezávislých auditů (Opus 5) proti živým dokumentacím; nálezy zapracovány.
**Repo (upřesnění):** frontend, plus **jedna** databázová migrace (deploy-hook trigger na `reviews`).

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

Spec prošel **čtyřmi** koly nezávislého ověření:

1. Před sepsáním plánu (Firecrawl + Context7).
2. Nad hotovým plánem, tři Opus auditoři. Přidalo rozhodnutí označená **[2. kolo]** a odhalilo
   sedm chyb, které by implementaci zastavily.
3. Nad přepsaným plánem, tři Opus auditoři s Context7 (HTTP API) a Firecrawl CLI. Zaměřené hlavně
   na to, co ve druhém kole **vzniklo nově a nikdo to nekontroloval**. Přidalo rozhodnutí
   označená **[3. kolo]**.
4. 2026-08-18, čtyři Opus auditoři (SEO/hosting, React+testy, DB+skripty, konzistence). Metodicky
   nejsilnější kolo: dva auditoři plán **skutečně naimplementovali** a spustili na něm jeho vlastní
   testy, třetí testoval migraci nad živým PostgreSQL 17. Přidalo rozhodnutí označená **[4. kolo]**
   a našlo **28 nálezů, z toho čtyři blokující**.

Třetí kolo mimo jiné **vrátilo zpět opravu z druhého kola**, která byla sama chybná: tvrzení, že
Googlův příklad „Product review page" obsahuje `offers`. Ověřeno strojově — neobsahuje, druhý
auditor si ho spletl se sekcí *Shopping aggregator page*. Poučení pro čtenáře: i „oprava po
ověření" může být chybná, dokud není doložená strojově, ne převyprávěná. Čtvrté kolo tenhle závěr
nezávisle potvrdilo (přepočtem výskytů řetězce v sekci) a zároveň ověřilo **všech 15 doložených
citací** v tabulce níž jako pravdivé.

Čtvrté kolo ukázalo, kde po třech kolech chyby opravdu zůstávají: **ne v citacích, ale v kódu
kroků a v tom, co plán ze správných citací nedovodil.** Nejtypičtější nález: JSON-LD posílalo
`description` a `image`, které stránka nikde nevykreslovala — porušení přesně toho pravidla,
kterým plán argumentuje na třech jiných místech.

| Rozhodnutí | Zdroj |
|---|---|
| Stránka recenzí nese `Product` + `aggregateRating` + `review[]`, **bez `offers`** | Google, *Product snippet* (2025-12-10) — `offers` je v tabulce vlastností vedené jako *Recommended*, ne *Required*. Příklad „Product review page“ `offers` **neobsahuje** v žádném ze tří kódování (JSON-LD, RDFa, Microdata); ověřeno strojově 2026-08-07 — v celé sekci není jediný výskyt řetězce „offer“. Jediné příklady s `offers` patří sekci *Shopping aggregator page*, což je jiný případ užití |
| `Product` musí nést **aspoň jedno** z `review` / `aggregateRating` / `offers` → produkt bez recenzí nedostane JSON-LD vůbec **[2. kolo]** | Google, *Product snippet* (2025-12-10): „You must include one of the following properties: review, aggregateRating, offers“ |
| Na detailu produktu se `review[]` zkrátí na 3 zobrazené | Google, *Structured data general guidelines* (2026-07-10): „include all of the reviews that are **visible** to people on the page“; „**Don't** mark up content that is not visible“ |
| `aggregateRating` smí na detailu zůstat jen se **zobrazeným** průměrem | Google, *Review snippet* (2026-07-24): „If you use `AggregateRating`, users should be able to see that aggregate rating on the page“ |
| Zobrazený průměr a `ratingValue` musí být **totéž číslo** → jedna sdílená zaokrouhlovací funkce **[2. kolo]** | DB drží `round(avg, 2)` (`20260711130000_add_reviews_system.sql:88`), tedy např. `4.67`, zatímco souhrn zobrazuje `4,7`. Google, *Structured data general guidelines* (2026-07-10): „Don't mark up content that is not visible to readers of the page“ |
| Aktuální strana stránkování **zůstává odkazem** s `aria-current="page"` **[2. kolo]** | W3C Design System, *Pagination*: „it is fully linked so users of Assistive Technology can find which is the currently active link“. Rozhodl uživatel 2026-08-07 |
| `robots` je jen `noindex`, bez `follow` **[2. kolo]** | Google, *Robots meta tag* (2026-03-24) — `follow` není mezi platnými pravidly; následování odkazů je výchozí chování. Seznam `follow` uvádí, ale jako **výchozí hodnotu**, takže vynechání nic nemění |
| SPA skořápka se oddělí od homepage do `dist/app-shell.html`; rewrite míří na ni **[3. kolo]** | `dist/index.html` dnes slouží jako prerenderovaná homepage **i** jako cíl rewritu `/(.*) → /`. Jeden canonical nemůže být správný pro obojí. Google, *Consolidate duplicate URLs* (2026-07-10): „If you can't set the canonical URL in the HTML source code, leave it out and only set it with JavaScript." Rozhodl uživatel 2026-08-07 |
| Do `Home.tsx` se stěhuje **celá** meta homepage, ne jen canonical **[4. kolo]** | Argument o skořápce platí stejně pro `title`, `description` i `og:*` — jinak je dál dostane každá neprerenderovaná adresa. Navíc `keepLast()` v `prerender.mjs:96-98` ošetřuje `meta[name]`, `meta[property]` a `link[rel=canonical]`, ale **ne `<title>`**; ověřeno spuštěním, že v `<head>` pak zůstanou dva. react.dev, `<title>`: „Only render a single `<title>` at a time to avoid undefined behavior." Rozhodl uživatel 2026-08-18 |
| `/app-shell` chrání `X-Robots-Tag: noindex` ve `vercel.json`, **ne** `Disallow` v `robots.txt` **[4. kolo]** | Google, *Robots intro* (2025-12-10): „A page that's disallowed in robots.txt can still be indexed if linked to from other sites… use the `noindex` meta tag or response header." Seznam totéž výslovně: zakázaný crawl znamená, že si robot `noindex` nepřečte. Scoping je bezpečný — Vercel zpracovává Headers **před** File System Routes i Rewrites (`vercel.com/docs/routing#routing-order`), takže pravidlo platí jen na přímý požadavek. Rozhodl uživatel 2026-08-18 |
| Stránka recenzí **vykresluje perex produktu a náhledový obrázek** **[4. kolo]** | JSON-LD je posílá v `description` a `image`, ale stránka je nezobrazovala — porušení téhož pravidla, kterým spec argumentuje u `ratingValue`. Google, *Structured data general guidelines* (2026-07-10): „Don't mark up content that is not visible to readers of the page." Uživatel 2026-08-18 zvolil obsah doplnit (druhá možnost byla vypustit ho z markupu) |
| Oba `Product` uzly nesou shodné `name` a shodné `@id` **[4. kolo]** | Detail měl `name: product.title` (což se nikde nezobrazuje — `ProductDetail.tsx:360` vypisuje `detail_title`), stránka recenzí `detail_title`, a žádný sdílený identifikátor. Dva `Product` uzly na dvou adresách bez pojítka. Googlovo stanovisko k tomuhle případu neexistuje (hledáno cíleně), ale platí „canonical preference is a **hint, not a rule**" — sdílené `@id` je jediný tvrdý signál, který dát můžeme. Rozhodl uživatel 2026-08-18 |
| Datum na kartě se zobrazuje **včetně dne** **[4. kolo]** | `datePublished` v JSON-LD nese `2026-07-01`, karta ukazovala „červenec 2026". Tatáž třída rozporu jako u `ratingValue`. Uživatel 2026-08-18 zvolil srovnat to zobrazením přesného data (dopad: mění se i globální `/recenze` a sekce na detailu — sdílí tentýž helper) |
| Fokus po změně strany se řídí `useNavigationType() === NavigationType.Push` **a nesmí padnout při prvním renderu** **[3. kolo, upřesněno 4. kolem]** | Původní guard na `location.key === 'default'` **selhával**: po přesměrování z neplatné strany je klíč náhodný a po F5 přežije v `history.state`. Ověřeno spuštěním — mount i reload jsou `POP`, interní přesměrování `REPLACE`, jen klik je `PUSH`. **4. kolo:** samotné `PUSH` nestačí — příchod z detailu produktu je taky `PUSH` a efekt běží dřív, než doběhne načtení, takže odečítač oznámil useknuté „Recenze —" a fokus přeskočil odkaz „Zpět na průvodce" nad nadpisem (ověřeno spuštěním). Přibyl guard na první render. Porovnání s řetězcem `'PUSH'` navíc shodí lint — `useNavigationType()` vrací enum |
| Prstenec fokusu je `focus:ring`, ne `focus-visible:ring` **[4. kolo]** | Změřeno v Chromiu i WebKitu: po programovém `.focus()` se `:focus-visible` v Chromiu **neaktivuje**, když uživatel ovládá stránku myší — prstenec by chyběl přesně tomu, kdo nejmíň čeká, že mu fokus někam skočí. Rozhodl uživatel 2026-08-18 |
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
v `scripts/prerender.mjs:80-82`), takže by mohly vzniknout dva `<link rel="canonical">`.

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
  (stránka by odkazovala sama na sebe). Protože hvězdičky i oddělovač jsou `aria-hidden`,
  nese varianta bez odkazu význam ve skrytých textových fragmentech, aby odečítač nepřečetl
  jen holé „5,0 12 recenzí" **[4. kolo]**.
- **Perex produktu a náhledový obrázek** pod souhrnem **[4. kolo]**. Nejsou tam kvůli vzhledu:
  JSON-LD je posílá v `description` a `image`, a markovat smíme jen to, co je vidět. Platí to
  oběma směry — když je stránka přestane zobrazovat, musí zmizet i z markupu. Perex se vykresluje
  jen když produkt `hero_subtitle` má; jinak `description` z JSON-LD vypadne úplně (fallback na
  meta description by markoval marketingovou větu, která na stránce nikde není).
- **`REVIEWS_DISCLOSURE`** pod nadpisem, stejně jako na detailu (`ProductReviews.tsx:104`).
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

**Stránka recenzí** (product snippet) — `Product` + `@id` + `name` + `image` +
`aggregateRating` + `review[]` odpovídající **právě zobrazené straně**, a `description`
jen když produkt má perex. Bez `offers`.

`@id` je shodné s uzlem na detailu a míří na detail produktu (`…/cestovni-pruvodci/:slug#product`),
takže obě stránky mluví o prokazatelně témž produktu **[4. kolo]**. `name` prochází sdíleným
helperem `productDisplayName()`, který používá i detail — dřív měl každý svoje.

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
  nevalidní HTML i špatný cíl pro skip-link. Uživatel rozhodl 2026-08-07 sjednotit i zbylé
  stránky **[2. kolo]**. Je jich **18**, ne 16: šestnáct má vlastní `<main>`, další dvě
  (`MyStory`, `Collaboration`) mají `role="main"` na `<section>`, což grep na `<main` nenajde
  **[3. kolo]**.
- **Každý odkaz stránkování má vlastní `aria-label`** — „Strana 2“, „Předchozí strana“,
  „Další strana“. Holé číslo „2“ jako název odkazu nestačí.
- Po přechodu na jinou stranu se fokus přesune na nadpis seznamu (`tabIndex={-1}`), a to
  **jen po skutečném přepnutí strany uvnitř stránky** — poznáno podle `useNavigationType()`
  a podle toho, že nejde o první render **[3. kolo, upřesněno 4. kolem]**. Nejde vyjít ze změny
  čísla strany (to vyskočí z 1 na 2 i při přímém příchodu na `/strana/2` z Googlu) ani
  z `location.key` (ten je `'default'` jen na mountu kanonické adresy — po přesměrování
  z neplatné strany je náhodný a po F5 přežije v `history.state`). Samotné `PUSH` taky nestačí:
  příchod z detailu produktu je `PUSH` a efekt běží dřív, než doběhne načtení dat.
- Prstenec fokusu se kreslí přes `focus:`, **ne `focus-visible:`** **[4. kolo]**. Změřeno
  v Chromiu i WebKitu: po programovém `.focus()` se `:focus-visible` v Chromiu neaktivuje,
  pokud uživatel ovládá stránku myší. Dřívější tvrzení specu, že se prstenec vykreslí v obou
  enginech, bylo chybné.
- Stránka **nepřidává `noindex` do přesměrovací větve** — React 19 by značku sice zvedl do
  `<head>`, ale `Navigate` komponentu hned odmountuje a značka zmizí dřív, než ji renderující
  crawler uvidí. Ochranu obstará `canonical` cílové strany **[3. kolo]**.
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

**Strany nad stropem prerenderu jsou prolinkované, ale nemají statické HTML [4. kolo].**
`ReviewsPagination` počítá `totalPages` z živého `review_count`, ne ze stropu
`MAX_PRERENDERED_REVIEW_PAGES` (20 stran = 200 recenzí). Nad ním tedy vzniknou crawlovatelné
odkazy na strany, které prerender nevyrobil — crawler tam dostane skořápku a obsah uvidí až po
vykonání JavaScriptu. Ořezat odkazy stropem by bylo horší: uživatel by se na hlubší strany
nedostal vůbec. Prerender proto na překročení stropu upozorní v logu, aby se dal včas zvednout.
Při dnešním objemu (jedna schválená recenze) je to teoretické.

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
o adresářových indexech u `cleanUrls` mlčí **na jakékoli hloubce** (ověřeno ve 4. kole průchodem
referencí `vercel.json`, `docs/routing`, `docs/rewrites` i `docs/headers`). V tomhle projektu je
mechanismus prokázaný jen do hloubky 2 (`/cestovni-pruvodci/:slug`); routy recenzí jdou do hloubky
3 (`…/recenze/index.html`) a **5** (`…/recenze/strana/2/index.html`). Nutný smoke na preview
deploy — kdyby se vracela SPA skořápka místo prerenderovaného souboru, padá celý SEO přínos.

**Předpokládá to testovací data [4. kolo].** Hloubka 5 se dá ověřit jedině nad produktem, který
má aspoň 11 schválených recenzí — jinak druhá strana vůbec nevznikne a smoke by hlásil falešný
poplach. Viz předpoklad u Tasku 13.

**3. Předlaunchová hlavička [2. kolo].** `vercel.json:23` posílá na všechny odpovědi
`X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`. Dokud tam je, canonical, `robots` ani
JSON-LD z téhle práce **pro Google** nic neovlivní. Skutečné ověření v Search Console je tedy až
po jejím odstranění při launchi.

**Pozor: pro Seznam to neplatí.** SeznamBot se `X-Robots-Tag` **neřídí** — „*v případě, že ji na
svém webu použijete, robot ji bude ignorovat a stáhne vždy celou URL*". Dnes web chrání jen Basic
auth (401), ne ta hlavička. Pro Seznam je `<meta name="robots">` v HTML **jediný funkční
mechanismus**, což zvyšuje cenu Tasku 11: zastaralý prerenderovaný `noindex` poškodí i Seznam.
Zdroj: [Seznam, Meta tag robots](https://o-seznam.cz/napoveda/vyhledavani/seznambot/meta-tag-robots/).

## Mimo rozsah

Nalezeno cestou, neřeší se v této práci:

1. **`NotFound` nemá `robots` meta.** `src/pages/NotFound.tsx` (62 řádků) neobsahuje žádné
   `noindex`. U Googlu to dnes maskuje předlaunchová hlavička `X-Robots-Tag: noindex` ve
   `vercel.json` (u Seznamu nemaskuje nic — ten hlavičku ignoruje), ta ale při spuštění zmizí
   a všechny neexistující routy se stanou měkkými 404. Podle Googlu
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
