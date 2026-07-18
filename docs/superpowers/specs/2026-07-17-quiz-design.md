# Kvíz „Nevíš kudy kam?" — design spec

**Datum:** 2026-07-17
**Stav:** implementováno dle docs/superpowers/plans/2026-07-17-quiz.md (čeká: sezónní obrázky + profily produktů — §11)
**Repa:** `cesty-bez-mapy` (FE — většina práce), `cesty-bez-mapy-admin` (záložka Kvíz)
**Řeší launch gap:** „kvíz atrapa" z gap-analýzy 2026-07-04

## 1. Cíl

Nahradit placeholder tlačítko „Začít kvíz" na `/naplanuj-si-cestu-snu` skutečným kvízem,
který podle 9 otázek doporučí top 3 produkty z katalogu a konvertuje návštěvníka na nákup
itineráře (nebo poptávku itineráře na míru). Vychází z HTML reference `kviz.html` (mimo repo),
jejíž scoring model se zachovává a opravuje; UI se staví znovu v Reactu.

## 2. Souhrn schválených rozhodnutí

| Téma | Rozhodnutí |
|---|---|
| Zdroj výsledků | Jen existující aktivní produkty; fallback CTA na Itinerář na míru |
| Sezónnost | Nová otázka „Kdy chceš vyrazit?" (jaro/léto/podzim/zima), vylučovací dimenze |
| Počet otázek | 9 (všech 8 z reference + termín), každá s vlastní vahou |
| Výsledky | Vždy top 3 + slovní úroveň shody + procento; pod tím fallback na míru |
| Vizuál otázek | Tmavý foto-modal s bílým rámem; filmový pás jako progress; odpovědi = fotky „na stole"; výběr = zelená pečeť s fajfkou (kombinace konceptů A+C) |
| Vizuál výsledků | „Pohlednice z tvé příští cesty": vítěz velká pohlednice, 2 alternativy menší, míra shody jako poštovní razítko s papírovým podkladem, fallback jako lísteček (v3) |
| Sezónní popisky | Pohlednice ukazují popis produktu pro období zvolené v kvízu (`*_description` sloupce, fallback `description`) |
| Typografie | Jeden font — výchozí font webu ('Segoe UI' stack); žádné nové fonty |
| Barvy | Brandová zelená `green-800 #166534` (akcenty), inkoust pečeti `green-900 #14532d` |
| Architektura | Otázky+váhy staticky ve FE; profily produktů v `products.quiz_data` (jsonb, sloupec existuje); admin záložka „Kvíz" pro Janu |
| Scoring | Vážený lineární matching z reference + 4 úpravy (viz §6) |
| Měřitelnost | Umami eventy pro celý funnel (potvrzeno do scope) |
| Backfill stav | Engine vrací příznak `backfilled`, výsledková stránka upraví copy (potvrzeno do scope) |

## 3. User flow a routing

- Nová routa `ROUTES.QUIZ = '/kviz'`, lazy-loaded přes `React.lazy` + stávající `Suspense`
  v `App.tsx` (stejný vzor jako Checkout apod.). Záznam v `publicRoutes.ts` (title, description)
  → SEO meta + prerender shellu.
- `PlanYourDreamTrip.tsx`: `handleQuizClick` místo alertu naviguje na `ROUTES.QUIZ`.
- Tři obrazovky v rámci stránky `Quiz.tsx`:
  1. **Intro** — nadpis, „9 otázek, zabere ti to ~2 minuty", CTA „Začít kvíz". Produkty se
     začnou načítat už zde (viz §7), aby výsledky vykreslily okamžitě.
  2. **Otázky** — 9× výběr jedné odpovědi; „Další" aktivní až po výběru, žádný auto-posun;
     „Zpět" funguje, změna odpovědi přepíše původní.
  3. **Výsledky** — top 3 pohlednice + lísteček „Itinerář na míru"
     (→ `ROUTES.CUSTOM_ITINERARY_DETAIL`), tlačítko „Zkusit znovu" (reset).
- Odpovědi se průběžně ukládají do `sessionStorage` (přežije refresh); „Zkusit znovu" a
  dokončení je smaže. Nedostupné storage (private mode) → tichý fallback na in-memory.
- „Zobrazit itinerář" na pohlednici → `/cestovni-pruvodci/:slug` (existující ProductDetail).

## 4. Vizuální design (schválené mockupy)

Referenční mockupy ze session leží lokálně v
`.superpowers/brainstorm/13059-1784308122/content/` (gitignored) — závazné soubory:
`question-screen-combo.html` (otázky) a `results-postcards-v3.html` (výsledky).
Popis je ale úplný zde; implementace se řídí tímto textem.

### 4.1 Scéna (společná)

Celostránková scéna: fotografické pozadí `public/images/background-quiz-image.png`
(cover) s radiálním tmavým překryvem `radial-gradient(ellipse at 50% 30%,
rgba(18,28,38,0.5), rgba(10,18,26,0.8))`, obsah v rámu s bílým okrajem (6px) a
zaoblením ~14px. Jeden font = výchozí stack webu. Všechny texty na tmavém pozadí bílé
(eyebrow `rgba(255,255,255,0.75)`, letter-spacing 3px, malé kapitálky).

### 4.2 Obrazovka otázky

- **Eyebrow:** „OTÁZKA X Z 9".
- **Progress = filmový pás:** dvě perforační linky (opakující se bílé čárky ~35% opacity)
  a mezi nimi 9 políček (flex, gap): odpovězená = plná bílá ~75%, aktuální = `#166534`
  s bílým okrajem a jemným zeleným glow, budoucí = průhledná s 30% okrajem.
  `role="progressbar"` + `aria-valuenow/min/max` + `aria-valuetext="Otázka X z 9"`.
- **Titulek otázky:** bílý, bold 800, ~1.7rem, text-shadow.
- **Odpovědi = 4 fotky „na stole":** papírové karty `#fbf9f3`, radius 4px, padding ~7px
  (fotorámeček), fotka `aspect-ratio 4/3.6, object-fit cover`, popisek tučně `#1c2b21`.
  Každá karta jemně natočená (cca −2°, +1.6°, −1.1°, +2.1°). Hover: mírné zvednutí.
  **Vybraná karta:** narovná se (`rotate(0)`), zvedne (`translateY(-6px) scale(1.05)`),
  dostane ring `0 0 0 2.5px #166534` a **pečeť s fajfkou** (SVG, viz §4.4) přes pravý
  horní roh.
- **Navigace:** vlevo ghost „← Zpět" (průhledná bílá s okrajem), vpravo primární
  „Další →" (`#166534`, bílý text, jemný bílý okraj `rgba(255,255,255,0.35)` kvůli
  kontrastu na tmavém pozadí); na poslední otázce „Vyhodnotit". Disabled dokud není vybráno.
- **Mobil (≤640px):** karty 2×2, na nejužších displejích sloupec; žádné pevné min-width
  (oprava rozbitého mobilu reference).

### 4.3 Obrazovka výsledků — „pohlednice z tvé příští cesty"

- **Hlavička:** eyebrow „VÝSLEDEK KVÍZU", titulek „Tvoje příští cesta" (bold 800),
  podtitulek „vybraná podle tvých devíti odpovědí".
- **Vítěz = velká pohlednice** (max-width ~620px, rotate −1.3°): papír `#fbf9f3`,
  fotka produktu (`image_url`) v papírovém rámu, pod ní vlevo název produktu (bold 800,
  `#1c2b21`) + krátký popisek (`#3d5c46`), vpravo cena tučně zeleně s malým
  štítkem „kompletní itinerář" (`duration` v popisku). Přes pravý horní roh **pečeť shody**
  (§4.4) s úrovní a procentem. Pod tím plné zelené CTA „Zobrazit itinerář".
- **Sezónní popisek (všechny 3 pohlednice):** popisek se bere ze sezónního sloupce
  produktu odpovídajícího období zvolenému v otázce 2 — mapování přes existující
  konstantu `SEASONS` v `src/constants/seasons.ts` (`key` jara/léta/podzimu/zimy je
  identický s klíči kvízové dimenze `season`; `dbField` → `spring_description` atd.).
  Když je sezónní popis `null`, fallback na obecný `description`. Text ořezat na
  max. 2 řádky (`line-clamp-2`), pohlednice je jednořádková vizitka, ne odstavec.
- **2 alternativy:** menší pohlednice vedle sebe (rotace +1.4° / −0.9°), menší pečeť
  (jen jeden kroužek), název, mini popisek, cena, podtržený link „Zobrazit itinerář".
- **Fallback lísteček:** papírek `#fffef7` s tlustším zeleným horním okrajem
  (`rgba(22,101,52,0.14)`), text „Nesedlo ti nic z toho? Nevadí — sestavím ti itinerář
  na míru, přesně podle tebe." + outline tlačítko „Chci itinerář na míru".
- **Backfilled varianta (§6.2):** titulek „Nejblíž tvým odpovědím", podtitulek vysvětlí,
  že přesná shoda v katalogu teď není, a lísteček na míru se vizuálně zvýrazní
  (např. přesun nad alternativy). Přesné copy doladit při implementaci.
- **Málo produktů:** 2 kandidáti → vítěz + 1 alternativa; 1 → jen vítěz; 0 → jen hlavička
  + lísteček na míru + link na katalog `/cestovni-pruvodci`.
- **Mobil:** pohlednice pod sebou.

### 4.4 Pečeť (`SealBadge`, sdílená SVG komponenta)

Kulatá „poštovní pečeť": papírový podkladový kotouček `rgba(255,254,247,0.96)`
(řeší čitelnost na fotce i tmavém pozadí), vnější kroužek stroke `#14532d` (3), u velké
varianty i vnitřní kroužek (1.2), `filter: drop-shadow`, rotace ~9–11°. Varianty:
- **check** (výběr odpovědi, ~44px): kroužek + fajfka.
- **score** (výsledky): nahoře úroveň shody (např. „SKVĚLÁ SHODA", ~9px ekvivalent,
  bez širokého prostrkání — text se musí vejít do vnitřního kroužku), uprostřed velké
  procento (`87 %`), dole vlnka „orazítkování". Malá varianta bez vnitřního kroužku.
Texty v SVG dědí font webu. Žádná doména v pečeti.

### 4.5 Motion a přístupnost vizuálu

- Přechody karet/pečetí krátké CSS transitions; `motion-reduce:` varianty vše vypnou
  (žádné rotace/zvedání animací, okamžité přechody).
- Kontrast: bílé texty na tmavém překryvu, inkoust `#14532d` na `#fbf9f3` — obojí ≥ AA.

## 5. Datový model

### 5.1 `products.quiz_data` (jsonb — sloupec už existuje, žádná migrace)

```json
{
  "version": 1,
  "enabled": true,
  "profile": {
    "vacation_type": { "adventure": 3, "cultural": 0, "relax": 1, "city": 2 },
    "season":        { "spring": 2, "summer": 3, "autumn": 2, "winter": 1 },
    "duration":      { "weekend": 0, "short": 0, "mid": 1, "long": 3 },
    "company":       { "solo": 0, "couple": 1, "family": 1, "friends": 1 },
    "activity":      { "nature": 3, "cultural": 1, "food": 3, "nightlife": 0 },
    "budget":        { "low": 0, "mid": 1, "high": 3 },
    "climate":       { "warm": 1, "mild": 2, "cool": 3 },
    "destination":   { "beach": 1, "nature": 3, "city": 2, "cultural": 3 },
    "accommodation": { "luxury": 2, "comfortable": 3, "mid": 3, "budget": 2 }
  }
}
```

- Hodnoty **0–3** (celá čísla). Žádné `*_neutral` klíče — neutralitu řeší engine.
- Produkt vstupuje do kvízu jen když: `is_active && !is_deleted && quiz_data.enabled === true`
  a profil projde runtime validací.
- **Typování:** interface `QuizData`/`QuizProfile` + runtime validátor
  `parseQuizData(json: Json): QuizData | null` v engine (jediný zdroj pravdy tvaru).
  Volitelně MergeDeep override generovaných typů (supabase-js ≥ 2.48 umí typovat
  `->`/`->>` selektory — ověřeno v docs); pro v1 stačí validátor.
- Vadný/neúplný `quiz_data` → produkt se přeskočí + `logger.warn`; logger centrálně
  přidává `Sentry.addBreadcrumb` (plán Task 0 — odešle se jen s případným pozdějším
  eventem), kvíz běží dál.
- Budoucí zpřísnění (mimo v1): `pg_jsonschema` CHECK constraint (ověřeno, že existuje).

### 5.2 Otázky (`src/data/quizQuestions.ts`, statické)

Pořadí a váhy (klimatické otázky záměrně rozestrčené):

| # | Dimenze | Otázka | Odpovědi (klíče) | Váha | Pozn. |
|---|---|---|---|---|---|
| 1 | `vacation_type` | Jaká dovolená tě láká nejvíc? | adventure / cultural / relax / city | 1,35 | obrázky `adventure_1`… |
| 2 | `season` | Kdy chceš vyrazit? | spring / summer / autumn / winter | 1,35 | **vylučovací**; nové obrázky |
| 3 | `duration` | Jak dlouho chceš cestovat? | weekend / short / mid / long | 1,35 | **vylučovací**; `duration_*_3` |
| 4 | `company` | S kým vyrážíš? | solo / couple / family / friends | 0,90 | `solo_4`… |
| 5 | `activity` | Co tě baví nejvíc? | nature / cultural / food / nightlife | 1,15 | `activity_*_5` |
| 6 | `budget` | Jaký máš rozpočet? | low / mid / high / **neutral** | 1,15 | neutral = „Neřeším, hlavně zážitky"; `budget_*_2` |
| 7 | `climate` | Jaké počasí tě láká? | warm / mild / cool / **neutral** | 1,15 | neutral = „Je mi to jedno"; `climate_*_6` |
| 8 | `destination` | Kam tě to táhne? | beach / nature / city / cultural | 1,15 | `destination_*_7` |
| 9 | `accommodation` | Jak moc řešíš ubytování? | luxury / comfortable / mid / budget | 0,90 | `accommodation_*_8` |

- Texty odpovědí převzít z reference **s opravami**: bez úvodních mezer („ Solo dobrodruh"),
  „túry" (ne „tůry/tŮry"). Popisy produktů na pohlednicích jdou z DB, takže opravy
  věcných chyb reference (Matterhorn, Tallinn, Braniborská brána, Aperol Spritz) se týkají
  budoucích textů produktů — poznámka pro Janu v §11.
- Obrázky odpovědí už jsou v `public/images/` (nasazené). **Chybí 4 obrázky ročních
  období** pro otázku 2 — obsahový úkol (§11).
- Váhy + prahy úrovní + penalizační konstanty = pojmenované konstanty v jednom místě
  (`QUIZ_WEIGHTS`, `QUIZ_TIERS`…), aby šly po launchi ladit podle Umami dat.

## 6. Scoring engine (`src/lib/quizEngine.ts` — čisté funkce, bez UI)

### 6.1 Výpočet shody

Pro každý produkt: přes zodpovězené otázky s ne-neutrální odpovědí
`match += w_q · profile[dim][key]`, `max += w_q · 3`; `score = match / max · 100`.

- **Neutrální odpověď** (budget/climate „je mi to jedno") otázku vyřadí z čitatele
  i jmenovatele — dimenze se ignoruje (v referenci srážela % všem).
- **Vylučovací dimenze** `season` a `duration`: pokud `profile[dim][key] === 0`,
  produkt jde do `excluded` poolu (nelze reálně koupit/použít) místo kandidátů.

### 6.2 Výběr top 3 a backfill

1. Kandidáti (po vyloučení) seřazení podle score, sestupně; remízy: vyšší
   `average_rating`, pak abecedně podle `title` (stabilní pořadí).
2. Top 3 (méně, jen když katalog nedá).
3. Pokud kandidátů < 3, doplní se nejlepší z `excluded` — výsledek dostane
   `backfilled: true` (globálně: true = aspoň jeden zobrazený je z excluded poolu)
   a UI přepne copy (§4.3). Karta doplněného ukazuje jeho skutečné score.
4. Návratový tvar: `{ results: Array<{ product, score, tier, fromBackfill }>, backfilled: boolean }`.

### 6.3 Úrovně shody (pečeť)

- `score ≥ 75` → **„Skvělá shoda"**
- `55 ≤ score < 75` → **„Dobrá shoda"**
- `score < 55` → **„Zajímavý tip"**

### 6.4 Vědomé vlastnosti a známá omezení (schváleno)

- **Korelované dimenze:** `vacation_type` + `activity` + `destination` měří příbuznou osu
  (příroda vs. město) — souhrnná efektivní váha ~3,65/9,3. Záměr: je to hlavní signál.
- **Systém se neučí:** v1 bez zpětné vazby; měřitelnost zajišťují Umami eventy (§7.4)
  a konstanty na jednom místě. Váhy se budou ladit postupně podle testování.
- **Bez diverzifikace:** tři podobné produkty mohou obsadit top 3; léčba je ediční
  (odlišné profily), ne algoritmická. Admin varování (§8) tomu předchází.
- Kvalita doporučení stojí a padá s profily v adminu — proto validace a varování v §8.

## 7. FE implementace

### 7.1 Struktura

- `src/pages/Quiz.tsx` — orchestrace obrazovek, stav (`useReducer`), sessionStorage.
- `src/components/quiz/QuizQuestion.tsx`, `QuizResults.tsx`, `SealBadge.tsx`
  (varianty check/score); intro obrazovka je jednoduchá → inline v `Quiz.tsx`.
- `src/data/quizQuestions.ts` — otázky, váhy, prahy, texty (viz §5.2).
- `src/lib/quizEngine.ts` — `parseQuizData`, `computeMatches` (viz §6).

### 7.2 Data

- Fetch při startu kvízu (intro → 1. otázka):
  `supabase.from('products').select('id, slug, title, description, price, duration, image_url, average_rating, quiz_data, spring_description, summer_description, autumn_description, winter_description').eq('is_active', true).eq('is_deleted', false)`
  (`average_rating` kvůli remízám v §6.2)
  — konzistentní s `TravelGuides.tsx` a `ProductDetail.tsx` (ten už sezónní sloupce
  typovaně načítá přes `Pick<Tables<'products'>, …>`); filtrace `quiz_data` klientsky
  (katalog je malý; server-side jsonb filtr `->>` je možný — ověřeno — ale netřeba).
- Chyba fetche → přátelský error stav s „Zkusit znovu" (refetch); kvíz bez produktů
  nemá co doporučit, proto blokuje až výsledky, ne vyplňování.

### 7.3 Přístupnost (opravy vad reference)

- Odpovědi = nativní `<input type="radio">` skryté přes `sr-only` (vzor
  `CustomRadio.tsx` — v repu ověřený), fotka jako `<label>`; fokus viditelný
  (`focus-within` ring zelený). Šipky fungují nativně v radio skupině; čísla 1–4 bonus.
- Žádný auto-posun; „Další" do výběru `aria-disabled` (zůstává v tab-orderu, klik se
  ignoruje) — ne nativní `disabled`, aby čtečka stav vysvětlila.
- Přechod otázek: fokus na nadpis otázky; nadpis nese sr-only prefix „Otázka X z 9:"
  (robustnější než `aria-live` — nehrozí dvojí hlášení při přesunu fokusu).
- Filmový pás `role="progressbar"`; pečeť/dekorace `aria-hidden`.
- `prefers-reduced-motion` viz §4.5. Tailwind 4.1 utility (`motion-reduce:`, arbitrary
  rotace) — žádná změna konfigurace, žádné nové fonty.

### 7.4 Analytika (Umami přes `trackEvent` z `src/lib/analytics.ts`)

Kebab-case názvy (konvence repa i Umami docs), doplnit do `ANALYTICS_EVENTS`:

| Event | Data | Kdy |
|---|---|---|
| `quiz-start` | — | klik na CTA v intru |
| `quiz-complete` | `{ winner, score, backfilled }` | vykreslení výsledků |
| `quiz-result-click` | `{ slug, position }` | klik „Zobrazit itinerář" (1–3) |
| `quiz-custom-click` | — | klik „Chci itinerář na míru" z kvízu |

Míra dokončení = poměr start/complete. Odpovědi neopouštějí prohlížeč (žádné PII,
nic se neukládá na server).

### 7.5 SEO

Záznam v `publicRoutes.ts` (title „Cestovní kvíz — zjisti, kam vyrazit", description),
`SeoTags` + `buildPageMeta`, prerender vyrenderuje intro shell.

## 8. Admin (`cesty-bez-mapy-admin`)

- `ProductCreate.tsx` + `ProductEdit.tsx`: **pátá** `TabbedForm.Tab label="Kvíz"`
  (po Karta / Detail stránka / Galerie / SEO).
- Obsah tabu:
  - `BooleanInput source="quiz_data.enabled"` „Zařadit do kvízu" (default vypnuto).
  - 9 bloků = 9 otázek; nadpis = text otázky, pod ním řádek pro každou odpověď:
    text odpovědi + volba **0–3** (`RadioButtonGroupInput` row, choices 0 „vůbec" /
    1 „trochu" / 2 „dobře" / 3 „perfektně"), source
    `quiz_data.profile.<dim>.<key>` (react-hook-form deep source, jde přímo do jsonb).
  - `transform` na `<Create>`/`<Edit>` (ověřeno v react-admin docs): doplní
    `version: 1`, výchozí nuly nevyplněných klíčů; při vypnutém `enabled` ponechá
    strukturu (nic nemaže).
- **Validace** (input-level validátor na prvním radiu dimenze, jen když `enabled`):
  `season` a `duration` musí mít aspoň jednu hodnotu > 0 (jinak produkt nikdy
  nevypadne) — blokující chyba. Záměrně NE form-level `validate` na TabbedForm —
  v react-adminu by vypnul všechny per-input validátory (required, maxFileSize).
- **Varování (neblokující, `useWatch` + `Alert`):**
  - dimenze, kde žádná hodnota > 0 → „otázka X produkt nikam neposune";
  - dimenze, kde všechny hodnoty ≥ 2 → „otázka X u tohoto produktu nic nerozliší"
    (pojistka proti známkové inflaci — hlavní riziko systému).
- Texty česky, konzistentní s ostatními taby.

## 9. Testy

- **Engine (Vitest, FE):** scoring vč. vah; neutrální vyloučení; gating season/duration;
  backfill + příznak; prahy úrovní (hraniční hodnoty 55/75); remízy; `parseQuizData`
  na vadných tvarech; 0/1/2 kandidáti.
- **Data:** konzistence `quizQuestions.ts` (9 otázek, každá volba mapuje na platnou
  dimenzi+klíč schématu, váhy > 0, obrázky definované).
- **Komponenty (Testing Library):** šťastná cesta intro→9 odpovědí→výsledky (mock
  supabase); klávesnicový průchod; disabled „Další"; stav bez produktů; backfilled copy.
- **Admin:** unit testy transform + validace (gating pravidlo, varování).
- Konvence dle stávajících testů FE (93 it-bloků) a `tsc`/lint v obou repech.

## 10. Ověření proti dokumentacím (2026-07-17)

- **react-admin 5.13** (Context7 `/marmelab/react-admin`): `TabbedForm.Tab`, per-input
  `validate`, `transform` na Create/Edit/SaveButton — potvrzeno; repo už TabbedForm používá.
- **supabase-js 2.79 / PostgREST** (oficiální docs přes Supabase MCP): jsonb `->`/`->>`
  v select i filtrech, zápis JS objektu do jsonb, typování JSON sloupců (≥ 2.48,
  MergeDeep), `pg_jsonschema` jako volitelný constraint — potvrzeno.
- **Umami** (Context7 `/websites/umami_is`): `umami.track(name, data)` — shodné s naším
  `trackEvent` wrapperem; kebab-case názvy dle konvence repa.
- **Interní konzistence:** lazy routy (`App.tsx`), dotazy (`TravelGuides.tsx`), a11y radio
  vzor (`CustomRadio.tsx`), analytics wrapper, Tailwind 4.1, žádné nové závislosti.
- **Sezónní popisky (doplněk):** sloupce `spring/summer/autumn/winter_description`
  existují v DB (`database.types.ts`, `string | null`), `SEASONS` v
  `src/constants/seasons.ts` mapuje identické klíče `spring/summer/autumn/winter`
  na `dbField` a `ProductDetail.tsx` je už podmíněně renderuje (fallback vzor převzat) —
  ověřeno čtením kódu; select více sloupců dle oficiálních Supabase docs (viz výše).

## 11. Obsahové úkoly (mimo kód, před spuštěním kvízu)

1. **4 obrázky ročních období** pro otázku „Kdy chceš vyrazit?" (public/images, stejný
   styl jako stávající sada).
2. **Profily produktů:** Jana vyplní záložku Kvíz u všech produktů katalogu (plánuje se
   výrazné rozšíření katalogu před launchem). Bez profilů kvíz doporučuje z prázdné množiny.
   U produktů zároveň vyplňovat sezónní popisy (`Jaro/Léto/Podzim/Zima`) — pohlednice je
   využijí pro personalizovaný text; bez nich padá copy na obecný popis.
3. **Texty produktů:** při plnění katalogu opravit věcné chyby převzaté z reference
   (Matterhorn, Tallinn, Braniborská brána, Aperol Spritz).
4. Schválení finálních textů otázek/copy Janou.

## 12. Mimo rozsah v1 (vědomě)

- Učení z chování / automatické ladění vah (ručně dle Umami dat).
- Diverzifikační re-rank top 3.
- Ukládání odpovědí na server, sdílení výsledků odkazem.
- E-mail capture na výsledkové stránce.
- `pg_jsonschema` DB constraint pro `quiz_data`.
