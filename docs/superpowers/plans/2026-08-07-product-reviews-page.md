# Dedikovaná stránka recenzí pro produkt — implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dát recenzím každého produktu vlastní stránku s plnými texty a stránkováním v cestě; na detailu produktu nechat klikatelný souhrn hodnocení a tři ukázkové recenze.

**Architecture:** Nová routa `/cestovni-pruvodci/:slug/recenze` (+ `/strana/:strana` pro strany 2+). Stránka dohledá produkt podle slugu, spočítá počet stran z `products.review_count`, ořízne stranu do platného rozsahu **ještě před** dotazem a načte jednu stranu přes existující `fetchApprovedReviews`. Detail produktu dostane souhrnný proužek s hvězdičkami, který na tuhle stránku odkazuje. Strukturovaná data se rozdělí: detail zůstává merchant listing (`offers` + `aggregateRating` + 3 `review`), stránka recenzí je product snippet (`Product` bez `offers`, `aggregateRating` + `review` odpovídající zobrazené straně).

Protože jsou stránky recenzí předgenerované, doplňuje práci ještě databázový trigger, který po změně schválených recenzí spustí Vercel deploy hook — jinak by prerenderovaný `noindex` i počet stran zastaraly. Zároveň mizí natvrdo zapsaný `canonical` ze šablony `index.html`, aby ho klientský kód nemusel přepisovat.

**Tech Stack:** React 19, TypeScript, React Router 7 (declarative), Tailwind 4, Supabase JS 2, PostgreSQL + pgTAP, Vitest 3 + Testing Library, Playwright (prerender), Vite 7.

**Spec:** [`docs/superpowers/specs/2026-08-07-product-reviews-page-design.md`](../specs/2026-08-07-product-reviews-page-design.md)

## Global Constraints

- **Veškerý text v UI česky.** Kód, commity a názvy souborů anglicky.
- **Jedna databázová migrace, a jen jedna:** trigger na `public.reviews`, který po změně schválených recenzí volá Vercel deploy hook (Task 11). Agregáty `products.average_rating` a `review_count` dál udržuje stávající `refresh_product_rating` — ten se nemění.
- **Recenze mají column-level GRANT jen na 6 sloupců pro `anon`.** Vždy používat `REVIEW_COLUMNS` z `src/lib/reviews.ts`; `select('*')` vrátí 42501.
- **Počet stran se počítá z `products.review_count`, nikdy z `count` stránkovaného dotazu.** Důvod: `fetchApprovedReviews` posílá `{ count: 'exact' }`, a právě kvůli tomu PostgREST na `Range` mimo rozsah odpoví **416** (bez count preference by vrátil 200 a prázdné pole). `fetchApprovedReviews` na chybu vyhazuje, takže z takové odpovědi se `count` nedozvíme.
- **Limit recenzí na detailu produktu je jedna sdílená konstanta.** Dnes je hodnota na dvou místech (`ProductReviews.tsx:12` a natvrdo `limit: 6` v `ProductDetail.tsx:111`).
- **`REVIEWS_DISCLOSURE` musí být na každé stránce, kde recenze zobrazujeme.** Povinnost dle § 5a odst. 5 zákona č. 634/1992 Sb. ČOI k tomu žádá informaci „přímo tam, kde jsou spotřebitelské recenze zveřejněné"; požadavek na viditelnost bez rolování neexistuje.
- **Číselné konstanty mají JEDEN zdroj pravdy: `src/constants/reviews.ts`.** `REVIEWS_PAGE_SIZE = 10`, `PRODUCT_REVIEWS_LIMIT = 3`, `MAX_PRERENDERED_REVIEW_PAGES`. Node skripty ten soubor importují přímo s příponou `.ts` — `prerender.mjs:4` a `sitemap.mjs:3` už dnes takhle importují `../src/constants/publicRoutes.ts` a Node 24 (`engines: node 24.x`) TypeScript odstrojí nativně. Konstanta se **nikde nekopíruje**.
- **Zaokrouhlení hodnocení má taky jeden zdroj.** DB ukládá `round(avg, 2)` (může být `4.67`), ale zobrazujeme jedno desetinné místo. Viditelný text a `ratingValue` v JSON-LD **musí nést tutéž hodnotu** — Google zakazuje markup obsahu, který na stránce není.
- **Totéž platí pro datum recenze [4. kolo].** `datePublished` v JSON-LD nese přesné datum, takže ho musí nést i karta. Proto `formatReviewDate` nově vypisuje den (Task 1).
- **Cokoli, co JSON-LD tvrdí, musí být na té konkrétní stránce vidět [4. kolo].** Netýká se to jen `ratingValue`: stránka recenzí proto vykresluje i perex produktu a náhledový obrázek, protože je posílá v `description` a `image`.
- **Oba `Product` uzly popisují tentýž produkt [4. kolo].** Detail i stránka recenzí musí mít shodné `name` (přes sdílený helper) a shodné `@id` mířící na detail produktu — jinak je Google nemá jak spárovat.
- **Chyba se nikdy nevydává za prázdno.** Selhání načtení → vlastní hláška; nula recenzí → prázdný stav.
- **Sentry:** `Sentry.captureException(err, { tags: { area: 'reviews', component: '<Jméno>' } })`.
- Testy se spouští `npm run test:run`, typová kontrola `npm run type-check`, lint `npm run lint`.

---

### Task 1: `ReviewCard` — režimy `teaser`/`full`, oprava ořezu a překryvu

Karta má dnes textový box s pevnou výškou `h-32` (128 px) a na odstavci `line-clamp-6`. Do boxu se vejde jen 4,92 řádku (6 × 26 px = 156 px > 128 px), takže se výpustka nikdy neukáže a text se ustřihne uprostřed řádku.

Zároveň má karta v základní třídě `h-[400px]`. Pozor na časté nedorozumění: **dnešní volající tím postižení nejsou.** V přeloženém CSS je `.h-full` až za `.h-\[400px\]` (byte-offsety 34020 > 33922 v `dist/assets/index-*.css`), stejná specificita, takže při shodě vyhrává `h-full` — a `ReviewsSection.tsx:107` i `ProductReviews.tsx:128` ho předávají. Odstranění `h-[400px]` je tedy pro stávající mřížky **beze změny**. Nutné je proto, že nová stránka je jeden sloupec a `h-full` nepředává — tam by 400 px plný text ořízlo.

**Files:**
- Modify: `src/components/ui/ReviewCard.tsx` (včetně JSDoc na řádku 9)
- Create: `src/components/ui/ReviewCard.test.tsx`
- Modify: `src/components/reviews/formatReviewDate.ts` — datum nově s dnem **[4. kolo]**
- Modify: `src/components/reviews/ReviewsSection.test.tsx:30-31` — stávající test na starý formát

**Interfaces:**
- Consumes: nic
- Produces: `ReviewCardProps` s novou vlastností `variant?: 'teaser' | 'full'` (výchozí `'teaser'`). Používají Task 8 (`variant="full"`) a Task 9 (`variant="teaser"`).
- Produces také: `formatReviewDate` beze změny signatury, ale s jiným výstupem (`'1. července 2026'` místo `'červenec 2026'`). Dědí to `ReviewsSection`, `ProductReviews` i Task 8.

- [ ] **Step 1: Write the failing test**

Vytvoř `src/components/ui/ReviewCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReviewCard from './ReviewCard';

const base = {
  name: 'Jana N.',
  rating: 5,
  text: 'Skvělý průvodce.',
  productTitle: null,
  date: 'červenec 2026',
  verified: true,
};

describe('ReviewCard', () => {
  it('teaser ořezává přes line-clamp, ale bez pevné výšky boxu', () => {
    const { container } = render(<ReviewCard {...base} variant="teaser" />);
    const paragraph = screen.getByText(/Skvělý průvodce/);
    expect(paragraph.className).toContain('line-clamp-6');
    // Pevná výška by výpustku znemožnila (128 px = 4,92 řádku při line-height 26 px).
    expect(container.innerHTML).not.toContain('h-32');
  });

  it('full vykreslí celý text bez ořezu', () => {
    const long = 'A'.repeat(2000);
    const { container } = render(<ReviewCard {...base} text={long} variant="full" />);
    expect(screen.getByText(new RegExp(`^"?${'A'.repeat(50)}`))).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('line-clamp');
    expect(container.innerHTML).not.toContain('h-32');
  });

  it('full zalamuje nezalomitelný text, aby ho overflow-hidden neustřihl', () => {
    // Recenze běžně obsahují URL; bez zalomení by dlouhý token přetekl kartu.
    const url = `https://example.com/${'a'.repeat(300)}`;
    render(<ReviewCard {...base} text={url} variant="full" />);
    expect(screen.getByText(new RegExp('^"?https://example')).className).toContain('wrap-break-word');
  });

  it('teaser je výchozí režim', () => {
    render(<ReviewCard {...base} />);
    expect(screen.getByText(/Skvělý průvodce/).className).toContain('line-clamp-6');
  });

  it('karta nevnucuje pevnou výšku 400 px', () => {
    const { container } = render(<ReviewCard {...base} variant="full" />);
    expect(container.innerHTML).not.toContain('h-[400px]');
  });

  it('odznak ověření se vykreslí jen když verified', () => {
    const { rerender } = render(<ReviewCard {...base} verified />);
    expect(screen.getByText('Ověřeno nákupem')).toBeInTheDocument();
    rerender(<ReviewCard {...base} verified={false} />);
    expect(screen.queryByText('Ověřeno nákupem')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/ui/ReviewCard.test.tsx`
Expected: FAIL — `h-32` i `h-[400px]` jsou v HTML přítomné a `variant` neexistuje.

- [ ] **Step 3: Write minimal implementation**

V `src/components/ui/ReviewCard.tsx`:

Do `ReviewCardProps` přidej za `verified`:

```tsx
  /**
   * `teaser` = ukázka na detailu produktu (ořez s výpustkou).
   * `full` = plné znění na stránce recenzí.
   */
  variant?: 'teaser' | 'full';
```

Do destrukturalizace parametrů přidej `variant = 'teaser',` před `className = ''`.

Nahraď obal karty — z:

```tsx
    <div className={`bg-white rounded-3xl p-8 lg:p-10 transition-all duration-500 border border-gray-100 group relative overflow-hidden backdrop-blur-sm h-[400px] flex flex-col ${className}`.trim()}>
```

na (bez `h-[400px]`; výšku určuje volající):

```tsx
    <div className={`bg-white rounded-3xl p-8 lg:p-10 transition-all duration-500 border border-gray-100 group relative overflow-hidden backdrop-blur-sm flex flex-col ${className}`.trim()}>
```

Nahraď textový box — z:

```tsx
      <div className="mb-8 flex-grow overflow-hidden h-32">
        <p className="text-gray-700 leading-relaxed text-base italic font-light tracking-wide line-clamp-6">
          "{text}"
        </p>
      </div>
```

na:

```tsx
      <div className="mb-8 flex-grow">
        <p
          className={`text-gray-700 leading-relaxed text-base italic font-light tracking-wide ${
            // `wrap-break-word` je povinné: karta má v základní třídě `overflow-hidden`,
            // takže nezalomitelný token (typicky URL v recenzi) by přetekl a tiše se
            // ustřihl — přesně to, co má `full` odstranit. Formulář povoluje 2 000 znaků.
            // (`wrap-break-word` je v Tailwindu 4 kanonický tvar; starší alias hlásí LSP.)
            variant === 'teaser' ? 'line-clamp-6' : 'whitespace-pre-line wrap-break-word'
          }`}
        >
          "{text}"
        </p>
      </div>
```

Oprav překryv odznaku s dekorativním kolečkem. Kolečko (`-top-2 -right-2 w-16 h-16`) sahá 56 px od pravého okraje, odznak končí na 32 px (`p-8`) resp. 40 px (`lg:p-10`) — překrývají se na **všech** šířkách. Dej hlavičce vyšší vrstvu; z:

```tsx
      <div className="flex items-center justify-start mb-6 flex-shrink-0">
```

na:

```tsx
      <div className="relative z-10 flex items-center justify-start mb-6 flex-shrink-0 pr-12">
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/components/ui/ReviewCard.test.tsx`
Expected: PASS, 6 testů.

- [ ] **Step 5: Sjednoť datum na kartě s `datePublished` v JSON-LD [4. kolo]**

Karta dnes ukazuje „červenec 2026", ale do JSON-LD jde `datePublished: '2026-07-01'`. Je to tentýž
druh rozporu jako u `ratingValue` — markup nese přesnější údaj, než je na stránce vidět. Uživatel
rozhodl 2026-08-18 sladit to zobrazením přesného data.

Nejdřív uprav **stávající** test v `src/components/reviews/ReviewsSection.test.tsx:30-31` — z:

```tsx
  it('formatReviewDate renders Czech month + year', () => {
    expect(formatReviewDate('2026-07-01T10:00:00.000Z')).toBe('červenec 2026');
```

na:

```tsx
  it('formatReviewDate renders a full Czech date', () => {
    // Datum musí odpovídat `datePublished` v JSON-LD (2026-07-01), jinak markujeme
    // přesnější údaj, než jaký je na stránce vidět.
    expect(formatReviewDate('2026-07-01T10:00:00.000Z')).toBe('1. července 2026');
```

Pak `src/components/reviews/formatReviewDate.ts` — z:

```ts
  return new Intl.DateTimeFormat('cs-CZ', { month: 'long', year: 'numeric' }).format(new Date(iso));
```

na:

```ts
  return new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(iso),
  );
```

A oprav JSDoc v `src/components/ui/ReviewCard.tsx:9` — z:

```tsx
  /** Formátované datum, např. "červenec 2026" */
```

na:

```tsx
  /** Formátované datum, např. "1. července 2026" */
```

Pozor: změna se propíše i do globální `/recenze` a do sekce na detailu produktu — obě používají
tentýž helper. To je záměr, ne vedlejší škoda.

- [ ] **Step 6: Ověř, že nic jiného nespadlo**

Run: `npm run test:run && npm run type-check`
Expected: PASS. `ReviewsSection` i `ProductReviews` předávají `className="h-full …"`, takže odstranění `h-[400px]` jejich mřížky nerozbije — výšku dál řídí `h-full` + roztažení řádku mřížky. Jediný test, který na formát data sahal, jsi opravil ve Step 5 (ověřeno grepem, že jiný neexistuje).

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/ReviewCard.tsx src/components/ui/ReviewCard.test.tsx src/components/reviews/formatReviewDate.ts src/components/reviews/ReviewsSection.test.tsx
git commit -m "fix(reviews): let review text clamp with a visible ellipsis

The text box was pinned to h-32 (128px) while the paragraph asked for
line-clamp-6; only 4.92 lines fit, so the clamp never engaged and
overflow-hidden cut the text mid-line. Drop the fixed height, add a full
variant that renders the whole review, and stop the base class forcing
400px on callers that do not pass h-full.

Also lift the verified badge above the decorative quote circle, which
overlapped it at every width, not just on mobile.

Review dates now show the day as well. The card said 'červenec 2026'
while the JSON-LD carried datePublished 2026-07-01, which marks up a more
precise value than the page ever shows — the same class of mismatch the
rounding helper exists to prevent."
```

---

### Task 2: `reviewCountLabel` — české skloňování počtu recenzí

**Files:**
- Create: `src/components/reviews/reviewCountLabel.ts`
- Create: `src/components/reviews/reviewCountLabel.test.ts`

**Interfaces:**
- Consumes: nic
- Produces: `reviewCountLabel(count: number): string` — vrací holé slovo bez čísla (`'recenze'` / `'recenzí'`). Používají Task 3 a Task 8.

- [ ] **Step 1: Write the failing test**

Vytvoř `src/components/reviews/reviewCountLabel.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { reviewCountLabel } from './reviewCountLabel';

describe('reviewCountLabel', () => {
  it('1 → recenze', () => expect(reviewCountLabel(1)).toBe('recenze'));
  it('2 až 4 → recenze', () => {
    expect(reviewCountLabel(2)).toBe('recenze');
    expect(reviewCountLabel(4)).toBe('recenze');
  });
  it('5 a víc → recenzí', () => {
    expect(reviewCountLabel(5)).toBe('recenzí');
    expect(reviewCountLabel(12)).toBe('recenzí');
    expect(reviewCountLabel(100)).toBe('recenzí');
  });
  it('0 → recenzí', () => expect(reviewCountLabel(0)).toBe('recenzí'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/reviews/reviewCountLabel.test.ts`
Expected: FAIL — modul neexistuje.

- [ ] **Step 3: Write minimal implementation**

Vytvoř `src/components/reviews/reviewCountLabel.ts`:

```ts
/**
 * České skloňování slova „recenze" podle počtu. Vrací holé slovo bez čísla,
 * aby si volající mohl číslo naformátovat po svém.
 */
export function reviewCountLabel(count: number): string {
  return count >= 1 && count <= 4 ? 'recenze' : 'recenzí';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/components/reviews/reviewCountLabel.test.ts`
Expected: PASS, 4 testy.

- [ ] **Step 5: Commit**

```bash
git add src/components/reviews/reviewCountLabel.ts src/components/reviews/reviewCountLabel.test.ts
git commit -m "feat(reviews): add Czech pluralisation helper for review counts"
```

---

### Task 3: `ProductRatingSummary` — souhrn hodnocení jako odkaz

**Files:**
- Create: `src/utils/rating.ts`
- Create: `src/utils/rating.test.ts`
- Create: `src/components/reviews/ProductRatingSummary.tsx`
- Create: `src/components/reviews/ProductRatingSummary.test.tsx`

**Interfaces:**
- Consumes: `reviewCountLabel` (Task 2)
- Produces také: `roundRating`, `formatRatingCs`, `ratingValueJsonLd` v `src/utils/rating.ts` — používá Task 5 a Task 9.
- Produces:
  ```tsx
  interface ProductRatingSummaryProps {
    average: number;
    count: number;
    /** Když chybí, vykreslí se statický text (stránka by odkazovala sama na sebe). */
    href?: string;
    className?: string;
  }
  ```
  Používají Task 8 (bez `href`) a Task 9 (s `href`).

- [ ] **Step 1: Write the failing test**

Vytvoř `src/components/reviews/ProductRatingSummary.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProductRatingSummary from './ProductRatingSummary';

const renderIn = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('ProductRatingSummary', () => {
  it('při nule recenzí nevykreslí nic', () => {
    const { container } = renderIn(<ProductRatingSummary average={0} count={0} href="/x" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('s href je odkaz s přístupným názvem', () => {
    renderIn(<ProductRatingSummary average={4.5} count={12} href="/cestovni-pruvodci/italie/recenze" />);
    const link = screen.getByRole('link', { name: 'Hodnocení 4,5 z 5, 12 recenzí — zobrazit všechny recenze' });
    expect(link).toHaveAttribute('href', '/cestovni-pruvodci/italie/recenze');
  });

  it('bez href je statický text, ne odkaz', () => {
    renderIn(<ProductRatingSummary average={5} count={1} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/1 recenze/)).toBeInTheDocument();
  });

  it('průměr formátuje s desetinnou čárkou', () => {
    renderIn(<ProductRatingSummary average={5} count={3} />);
    expect(screen.getByText(/5,0/)).toBeInTheDocument();
  });

  it('průměr z DB zaokrouhlí na jedno desetinné místo', () => {
    // DB ukládá round(avg, 2) → 4.67. Uživatel musí vidět touž hodnotu,
    // jakou pošleme do JSON-LD, jinak markujeme obsah, který na stránce není.
    renderIn(<ProductRatingSummary average={4.67} count={3} />);
    expect(screen.getByText(/4,7/)).toBeInTheDocument();
  });

  it('skloňuje počet recenzí', () => {
    const { rerender } = renderIn(<ProductRatingSummary average={5} count={3} />);
    expect(screen.getByText(/3 recenze/)).toBeInTheDocument();
    rerender(<MemoryRouter><ProductRatingSummary average={5} count={9} /></MemoryRouter>);
    expect(screen.getByText(/9 recenzí/)).toBeInTheDocument();
  });

  it('bez href je souhrn srozumitelný i bez hvězdiček', () => {
    // Hvězdičky jsou aria-hidden a `·` taky, takže bez skrytých fragmentů by
    // odečítač přečetl jen „5,0 12 recenzí“ — bez informace, že jde o hodnocení
    // z pěti. Varianta s href tenhle problém nemá, tam význam nese aria-label.
    renderIn(<ProductRatingSummary average={5} count={12} />);
    expect(screen.getByText('Hodnocení')).toBeInTheDocument();
    expect(screen.getByText('z 5,')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/reviews/ProductRatingSummary.test.tsx`
Expected: FAIL — komponenta neexistuje.

- [ ] **Step 3: Write minimal implementation**

Nejdřív vytvoř `src/utils/rating.ts` — jediné místo, které rozhoduje o zaokrouhlení:

```ts
/**
 * Zaokrouhlení průměrného hodnocení na jedno desetinné místo.
 *
 * DB drží `round(avg(rating), 2)` (`refresh_product_rating`), takže hodnota může být
 * třeba 4.67. Zobrazujeme ale jedno desetinné místo — a Google zakazuje markup obsahu,
 * který na stránce není vidět. Viditelný text i `ratingValue` proto musí projít
 * TOUTO funkcí, aby nemohly vydat různá čísla.
 */
export function roundRating(average: number): number {
  return Math.round(average * 10) / 10;
}

/** Pro zobrazení: česká desetinná čárka. */
export function formatRatingCs(average: number): string {
  return roundRating(average).toFixed(1).replace('.', ',');
}

/** Pro JSON-LD: tečka podle schema.org, ale tatáž hodnota, jakou vidí uživatel. */
export function ratingValueJsonLd(average: number): string {
  return roundRating(average).toFixed(1);
}
```

a `src/utils/rating.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { roundRating, formatRatingCs, ratingValueJsonLd } from './rating';

describe('rating', () => {
  it('zaokrouhluje na jedno desetinné místo', () => {
    expect(roundRating(4.67)).toBe(4.7);
    expect(roundRating(4.64)).toBe(4.6);
    expect(roundRating(5)).toBe(5);
  });

  it('zobrazení a JSON-LD nesou tutéž hodnotu, jen jiný oddělovač', () => {
    expect(formatRatingCs(4.67)).toBe('4,7');
    expect(ratingValueJsonLd(4.67)).toBe('4.7');
    expect(formatRatingCs(5)).toBe('5,0');
    expect(ratingValueJsonLd(5)).toBe('5.0');
  });
});
```

Pak vytvoř `src/components/reviews/ProductRatingSummary.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { formatRatingCs } from '../../utils/rating';
import { reviewCountLabel } from './reviewCountLabel';

interface ProductRatingSummaryProps {
  average: number;
  count: number;
  /** Když chybí, vykreslí se statický text (stránka by odkazovala sama na sebe). */
  href?: string;
  className?: string;
}

/** Hvězdičky nesou jen dekoraci — význam je v textu vedle nich. */
const Stars = ({ average }: { average: number }) => (
  <span className="flex items-center gap-0.5" aria-hidden="true">
    {Array.from({ length: 5 }, (_, index) => {
      const starNumber = index + 1;
      const isFull = starNumber <= Math.floor(average);
      const isHalf = starNumber === Math.ceil(average) && average % 1 !== 0;
      return (
        <span key={starNumber} className="relative inline-flex">
          <svg className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          {(isFull || isHalf) && (
            <svg
              className="w-4 h-4 text-green-800 absolute top-0 left-0"
              fill="currentColor"
              viewBox="0 0 24 24"
              style={{ clipPath: isHalf ? 'inset(0 50% 0 0)' : 'none' }}
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          )}
        </span>
      );
    })}
  </span>
);

/**
 * Souhrn hodnocení produktu. Google vyžaduje, aby byl průměr z `aggregateRating`
 * na stránce vidět, ne jen v JSON-LD.
 */
const ProductRatingSummary = ({ average, count, href, className = '' }: ProductRatingSummaryProps) => {
  if (count === 0) return null;

  const formattedAverage = formatRatingCs(average);
  const label = `${count} ${reviewCountLabel(count)}`;
  // Skryté fragmenty dávají větě smysl i tam, kde souhrn není odkaz (hvězdičky
  // i oddělovač jsou aria-hidden). Prokládáme je místo jednoho souhrnného
  // `sr-only` textu schválně: jinak by se počet recenzí objevil v DOMu dvakrát
  // a `getByText` by hlásil víc shod. U varianty s href je aria-label na odkazu
  // přebije, takže se nic nezdvojí.
  const body = (
    <>
      <Stars average={average} />
      <span className="sr-only">Hodnocení </span>
      <span className="font-semibold text-gray-900">{formattedAverage}</span>
      <span className="sr-only"> z 5,</span>
      <span className="text-gray-500" aria-hidden="true">·</span>
      <span className="text-gray-600">{label}</span>
    </>
  );
  const shared = `inline-flex items-center gap-2 text-sm ${className}`.trim();

  if (!href) {
    return <div className={shared}>{body}</div>;
  }
  return (
    <Link
      to={href}
      className={`${shared} hover:text-green-800 underline-offset-4 hover:underline`}
      aria-label={`Hodnocení ${formattedAverage} z 5, ${label} — zobrazit všechny recenze`}
    >
      {body}
    </Link>
  );
};

export default ProductRatingSummary;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/components/reviews/ProductRatingSummary.test.tsx src/utils/rating.test.ts`
Expected: PASS — 7 testů komponenty a 2 testy `rating`. **Obojí, ne jen komponentu:** `rating.test.ts` vzniká ve Step 3 a bez tohohle běhu by se commitoval neověřený, přestože ho spec jmenovitě žádá.

- [ ] **Step 5: Commit**

```bash
git add src/utils/rating.ts src/utils/rating.test.ts src/components/reviews/ProductRatingSummary.tsx src/components/reviews/ProductRatingSummary.test.tsx
git commit -m "feat(reviews): add rating summary strip

Google requires the aggregateRating value to be visible on any page whose
markup declares it; the product page currently ships aggregateRating in
JSON-LD without showing an average anywhere. Renders as a link when given
an href, as static text otherwise.

Rounding lives in one helper because the database stores two decimals while
the summary shows one, and the value in the markup has to be the value on
the screen."
```

---

### Task 4: `lib/reviews.ts` — rozhodující druhý klíč řazení a dohledání produktu

**Files:**
- Modify: `src/lib/reviews.ts:38-48`
- Modify: `src/lib/reviews.test.ts:18-41` — **povinné**, ne volitelné: oba stávající testy mockují `order` tak, že vrací rovnou `{ range }`, resp. `{ eq }`. Druhé `.order()` na tom objektu neexistuje, takže po změně implementace spadnou na `TypeError: query.order(...).order is not a function`.
- Create: `src/lib/productForReviews.test.ts`

**Interfaces:**
- Consumes: nic
- Produces:
  ```ts
  export interface ProductForReviews {
    id: string;
    title: string;
    detail_title: string | null;
    hero_subtitle: string | null;
    slug: string;
    image_url: string | null;
    average_rating: number | null;
    review_count: number | null;
  }
  export function fetchProductForReviews(slug: string): Promise<ProductForReviews | null>;
  ```
  `null` = produkt neexistuje nebo není veřejný. Používají Task 5 a Task 8.

- [ ] **Step 1: Write the failing test**

Vytvoř `src/lib/productForReviews.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const singleMock = vi.fn<(...args: unknown[]) => unknown>();
const selectSpy = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      select: (...args: unknown[]) => {
        selectSpy(...args);
        return { eq: () => ({ eq: () => ({ eq: () => ({ single: singleMock }) }) }) };
      },
    }),
  },
}));

import { fetchProductForReviews } from './reviews';

describe('fetchProductForReviews', () => {
  beforeEach(() => vi.clearAllMocks());

  it('vrátí produkt, když existuje', async () => {
    singleMock.mockResolvedValue({
      data: {
        id: 'p1', title: 'Itálie', detail_title: 'Roadtrip po Itálii', hero_subtitle: '20 dní',
        slug: 'italie', image_url: null, average_rating: 5, review_count: 12,
      },
      error: null,
    });
    const product = await fetchProductForReviews('italie');
    expect(product?.id).toBe('p1');
    expect(product?.review_count).toBe(12);
  });

  it('vrátí null, když produkt neexistuje (PGRST116)', async () => {
    singleMock.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'no rows' } });
    await expect(fetchProductForReviews('neexistuje')).resolves.toBeNull();
  });

  it('u skutečné chyby vyhodí, aby se nevydávala za prázdno', async () => {
    singleMock.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'boom' } });
    await expect(fetchProductForReviews('italie')).rejects.toBeTruthy();
  });
});
```

V `src/lib/reviews.test.ts` **nahraď** oba stávající testy `fetchApprovedReviews` (řádky 18–41) verzí s fluent mockem, která zároveň ohlídá druhý klíč řazení:

```ts
  it('fetchApprovedReviews selects explicit columns with product embed and range', async () => {
    const range = vi.fn().mockResolvedValue({ data: [], count: 0, error: null });
    const orderById = vi.fn().mockReturnValue({ range });
    const order = vi.fn().mockReturnValue({ order: orderById });
    const select = vi.fn().mockReturnValue({ order });
    fromMock.mockReturnValue({ select });

    await fetchApprovedReviews({ limit: 9, offset: 0 });

    expect(fromMock).toHaveBeenCalledWith('reviews');
    expect(select).toHaveBeenCalledWith(`${REVIEW_COLUMNS}, products ( title, slug )`, { count: 'exact' });
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    // `id` jako rozhodující druhý klíč — bez něj je pořadí při shodných časech
    // nedefinované a offsetové stránkování může řádek zopakovat nebo přeskočit.
    expect(orderById).toHaveBeenCalledWith('id', { ascending: false });
    expect(range).toHaveBeenCalledWith(0, 8);
  });

  it('fetchApprovedReviews filters by productId when provided', async () => {
    const range = vi.fn().mockResolvedValue({ data: [], count: 0, error: null });
    const eq = vi.fn().mockReturnValue({ range });
    const orderById = vi.fn().mockReturnValue({ eq });
    const order = vi.fn().mockReturnValue({ order: orderById });
    const select = vi.fn().mockReturnValue({ order });
    fromMock.mockReturnValue({ select });

    await fetchApprovedReviews({ productId: 'p1', limit: 6, offset: 0 });
    expect(eq).toHaveBeenCalledWith('product_id', 'p1');
  });
```

**Nepoužívej `vi.doMock` + dynamický `await import('./reviews')`.** Soubor má `./reviews` staticky importovaný na řádku 13, takže modul už je v registry a dynamický import vrátí kešovanou instanci navázanou na top-level `vi.mock`. Bez `vi.resetModules()` před `vi.doMock` nemá takový blok žádný účinek (ověřeno spuštěním) a spadne až na nesouvisejícím `TypeError`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/lib/productForReviews.test.ts src/lib/reviews.test.ts`
Expected: FAIL — `fetchProductForReviews` neexistuje; řazení má jen jeden klíč.

- [ ] **Step 3: Write minimal implementation**

V `src/lib/reviews.ts` přidej druhý klíč řazení — z:

```ts
    .order('created_at', { ascending: false });
```

na:

```ts
    // `id` jako rozhodující druhý klíč: bez něj může offsetové stránkování při
    // shodných `created_at` řádek zopakovat nebo přeskočit.
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
```

Na konec souboru přidej:

```ts
export interface ProductForReviews {
  id: string;
  title: string;
  detail_title: string | null;
  hero_subtitle: string | null;
  slug: string;
  image_url: string | null;
  average_rating: number | null;
  review_count: number | null;
}

/**
 * Produkt pro stránku recenzí — jen pole potřebná pro souhrn, nadpis a JSON-LD
 * (`hero_subtitle` slouží jako `Product.description`, viz `buildProductReviewsMeta`).
 * `null` = produkt neexistuje nebo není veřejný (PGRST116). Jakákoli jiná chyba
 * se vyhazuje, aby se výpadek nevydával za „produkt nenalezen".
 *
 * `.single()`, ne `.maybeSingle()`: postgrest-js 2.105 už u `maybeSingle()` neposílá
 * `Accept: application/vnd.pgrst.object+json` a kardinalitu řeší na klientu, takže by
 * PGRST116 nikdy nepřišel a větev níž by byla mrtvý kód. `.single()` navíc kopíruje
 * dva existující call-sites (`ProductDetail.tsx:93-98`, `ProductReviews.tsx:65-70`).
 */
export async function fetchProductForReviews(slug: string): Promise<ProductForReviews | null> {
  const { data, error } = await supabase
    .from('products')
    .select('id, title, detail_title, hero_subtitle, slug, image_url, average_rating, review_count')
    .eq('slug', slug)
    .eq('is_active', true)
    .eq('is_deleted', false)
    .single<ProductForReviews>();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/lib/productForReviews.test.ts src/lib/reviews.test.ts`
Expected: PASS.

- [ ] **Step 5: Ověř, že přidané řazení nerozbilo zbytek sady**

Run: `npm run test:run && npm run type-check`
Expected: PASS. Oba dotčené testy jsi přepsal ve Step 1 — jestli teď něco padá na `query.order(...).order is not a function`, znamená to, že se přepis neuplatnil.

- [ ] **Step 6: Commit**

```bash
git add src/lib/reviews.ts src/lib/reviews.test.ts src/lib/productForReviews.test.ts
git commit -m "feat(reviews): add product lookup for the reviews page, break ordering ties

Offset pagination over created_at alone can repeat or skip a row when
timestamps collide, so add id as a tiebreaker."
```

---

### Task 5: `productSeo.ts` — meta a JSON-LD pro stránku recenzí

**Files:**
- Modify: `src/utils/productSeo.ts`
- Modify: `src/utils/productSeo.test.ts`

**Interfaces:**
- Consumes: `ProductForReviews` (Task 4), `ratingValueJsonLd` (Task 3)
- Produces:
  ```ts
  export interface ProductReviewsMeta {
    title: string;
    description: string;
    canonical: string;
    ogImage: string;
    robots?: string;
    jsonLd?: ProductReviewsJsonLd;
  }
  export function buildProductReviewsMeta(
    product: ProductForReviews,
    options: {
      page: number;
      reviews: { author: string; rating: number; text: string; datePublished: string }[];
    },
    siteUrl?: string,
  ): ProductReviewsMeta;

  /** Cesta stránky recenzí; strana 1 je bez segmentu `/strana`. */
  export function productReviewsPath(slug: string, page?: number): string;
  /** Jméno produktu tak, jak ho uživatel vidí (`detail_title` s fallbackem). */
  export function productDisplayName(product: { detail_title: string | null; title: string }): string;
  /** Sdílené `@id` pro oba `Product` uzly. */
  export function productJsonLdId(slug: string, siteUrl?: string): string;
  ```
  `buildProductReviewsMeta` a `productReviewsPath` používá Task 8, `productReviewsPath` navíc Task 9.
  `productDisplayName` i `productJsonLdId` volá už `buildProductMeta` v tomhle tasku.

- [ ] **Step 1: Write the failing test**

V `src/utils/productSeo.test.ts` rozšiř **stávající** import na řádku 2:

```ts
import { buildProductMeta, buildProductReviewsMeta } from './productSeo';
```

a na konec souboru přidej:

```ts
// Fixtura se JMENUJE JINAK NEŽ `product` schválně: soubor už `const product`
// deklaruje na řádku 4. Kolize by shodila celý soubor na SyntaxError, tedy
// i stávající testy buildProductMeta.
const REVIEWS_PRODUCT = {
  id: 'p1',
  title: 'Roadtrip po Itálii',
  detail_title: 'Roadtrip po Itálii na 20 dní',
  hero_subtitle: 'Kompletně naplánovaná cesta',
  slug: 'italie-roadtrip',
  image_url: 'https://cdn.example/italie.jpg',
  average_rating: 4.5,
  review_count: 12,
};
const reviewsFixture = [
  { author: 'Jana N.', rating: 5, text: 'Skvělé.', datePublished: '2026-07-01' },
  { author: 'Petr K.', rating: 4, text: 'Dobré.', datePublished: '2026-06-20' },
];

describe('buildProductReviewsMeta', () => {
  it('JSON-LD je Product BEZ offers (stránka není prodejní)', () => {
    const meta = buildProductReviewsMeta(REVIEWS_PRODUCT, { page: 1, reviews: reviewsFixture }, 'https://x.cz');
    expect(meta.jsonLd?.['@type']).toBe('Product');
    expect(meta.jsonLd).not.toHaveProperty('offers');
  });

  it('review[] odpovídá počtu recenzí na zobrazené straně', () => {
    const meta = buildProductReviewsMeta(REVIEWS_PRODUCT, { page: 1, reviews: reviewsFixture }, 'https://x.cz');
    expect(meta.jsonLd?.review).toHaveLength(2);
    expect(meta.jsonLd?.review?.[0].author.name).toBe('Jana N.');
  });

  it('nese aggregateRating s průměrem a počtem', () => {
    const meta = buildProductReviewsMeta(REVIEWS_PRODUCT, { page: 1, reviews: reviewsFixture }, 'https://x.cz');
    expect(meta.jsonLd?.aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: '4.5',
      reviewCount: 12,
    });
  });

  it('ratingValue nese TOTÉŽ číslo, jaké uvidí uživatel', () => {
    // DB drží round(avg, 2) = 4.67; souhrn na stránce zobrazí 4,7.
    // Kdyby JSON-LD poslalo 4.67, markujeme obsah, který na stránce není.
    const meta = buildProductReviewsMeta(
      { ...REVIEWS_PRODUCT, average_rating: 4.67 },
      { page: 1, reviews: reviewsFixture },
      'https://x.cz',
    );
    expect(meta.jsonLd?.aggregateRating?.ratingValue).toBe('4.7');
  });

  it('name odpovídá nadpisu stránky, ne internímu title', () => {
    const meta = buildProductReviewsMeta(REVIEWS_PRODUCT, { page: 1, reviews: reviewsFixture }, 'https://x.cz');
    expect(meta.jsonLd?.name).toBe('Roadtrip po Itálii na 20 dní');
  });

  it('oba Product uzly nesou shodné @id i name', () => {
    // Detail a stránka recenzí vydají každý svůj `Product`. Bez sdíleného
    // identifikátoru a se dvěma různými jmény je Google nemá jak spárovat.
    // Test drží obě funkce u sebe, aby se nemohly rozejít.
    const reviewsMeta = buildProductReviewsMeta(REVIEWS_PRODUCT, { page: 2, reviews: reviewsFixture }, 'https://x.cz');
    // Pole vypisujeme ručně, ne spreadem: `ProductMetaProduct` nezná `id`,
    // `average_rating` ani `review_count`, které fixtura navíc nese.
    const detailMeta = buildProductMeta(
      {
        detail_title: REVIEWS_PRODUCT.detail_title,
        title: REVIEWS_PRODUCT.title,
        hero_subtitle: REVIEWS_PRODUCT.hero_subtitle,
        slug: REVIEWS_PRODUCT.slug,
        image_url: REVIEWS_PRODUCT.image_url,
        price: 699,
      },
      { rating: { average: 4.5, count: 12 }, reviews: reviewsFixture },
      'https://x.cz',
    );
    // `@id` míří na detail a NEMĚNÍ se se stranou stránkování.
    expect(reviewsMeta.jsonLd?.['@id']).toBe('https://x.cz/cestovni-pruvodci/italie-roadtrip#product');
    expect(detailMeta.jsonLd['@id']).toBe(reviewsMeta.jsonLd?.['@id']);
    expect(detailMeta.jsonLd.name).toBe(reviewsMeta.jsonLd?.name);
    // Regrese: dřív tu bylo interní `title`, které se na detailu nikde nezobrazuje.
    expect(detailMeta.jsonLd.name).toBe('Roadtrip po Itálii na 20 dní');
  });

  it('description popisuje produkt, ne stránku', () => {
    const meta = buildProductReviewsMeta(REVIEWS_PRODUCT, { page: 1, reviews: reviewsFixture }, 'https://x.cz');
    expect(meta.jsonLd?.description).toBe('Kompletně naplánovaná cesta');
    // Meta description je něco jiného než Product.description.
    expect(meta.description).toMatch(/Recenze od ověřených zákazníků/);
  });

  it('bez perexu se description do JSON-LD vůbec nedostane', () => {
    // Fallback na meta description by markoval větu, která na stránce není.
    // Task 8 vykresluje perex jen když existuje — markup to musí kopírovat.
    const meta = buildProductReviewsMeta(
      { ...REVIEWS_PRODUCT, hero_subtitle: null },
      { page: 1, reviews: reviewsFixture },
      'https://x.cz',
    );
    expect(meta.jsonLd).not.toHaveProperty('description');
    expect(meta.description).toMatch(/Recenze od ověřených zákazníků/);
  });

  it('canonical strany 1 je bez segmentu /strana', () => {
    const meta = buildProductReviewsMeta(REVIEWS_PRODUCT, { page: 1, reviews: reviewsFixture }, 'https://x.cz');
    expect(meta.canonical).toBe('https://x.cz/cestovni-pruvodci/italie-roadtrip/recenze');
  });

  it('canonical strany 2 míří sám na sebe, ne na stranu 1', () => {
    const meta = buildProductReviewsMeta(REVIEWS_PRODUCT, { page: 2, reviews: reviewsFixture }, 'https://x.cz');
    expect(meta.canonical).toBe('https://x.cz/cestovni-pruvodci/italie-roadtrip/recenze/strana/2');
  });

  it('titulek strany 2 se liší od strany 1', () => {
    const first = buildProductReviewsMeta(REVIEWS_PRODUCT, { page: 1, reviews: reviewsFixture }, 'https://x.cz');
    const second = buildProductReviewsMeta(REVIEWS_PRODUCT, { page: 2, reviews: reviewsFixture }, 'https://x.cz');
    expect(first.title).toBe('Recenze — Roadtrip po Itálii na 20 dní');
    expect(second.title).toBe('Recenze — Roadtrip po Itálii na 20 dní (strana 2)');
  });

  it('bez recenzí nese noindex a JSON-LD VYNECHÁ ÚPLNĚ', () => {
    // Google: „You must include one of the following properties: review,
    // aggregateRating, offers." Product bez všech tří není způsobilý pro rich
    // result; u příbuzného případu Google mluví o warningu v Rich Results Testu.
    // Radši tedy žádný markup než markup, který nemůže nic získat.
    const meta = buildProductReviewsMeta(
      { ...REVIEWS_PRODUCT, average_rating: 0, review_count: 0 },
      { page: 1, reviews: [] },
      'https://x.cz',
    );
    expect(meta.robots).toBe('noindex');
    expect(meta.jsonLd).toBeUndefined();
  });

  it('se recenzemi noindex nenastavuje', () => {
    const meta = buildProductReviewsMeta(REVIEWS_PRODUCT, { page: 1, reviews: reviewsFixture }, 'https://x.cz');
    expect(meta.robots).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/utils/productSeo.test.ts`
Expected: FAIL — `buildProductReviewsMeta` neexistuje.

- [ ] **Step 3: Write minimal implementation**

V `src/utils/productSeo.ts` přidej na začátek k importům:

```ts
import { ratingValueJsonLd } from './rating';
import type { ProductForReviews } from '../lib/reviews';
```

A oprav **stávající** `buildProductMeta` na řádku 96 — detail produktu má dnes tentýž rozpor a Task 9 mu navíc přidává viditelný souhrn, takže by byl na očích. Z:

```ts
      ratingValue: String(options.rating.average),
```

na:

```ts
      ratingValue: ratingValueJsonLd(options.rating.average),
```

**Sjednoť `name` a doplň sdílené `@id` [4. kolo].** Dnes má detail v JSON-LD `name: product.title`
(řádek 81), zatímco stránka recenzí by měla `detail_title` — dva `Product` uzly pro tentýž produkt
s různým jménem a bez jakéhokoli pojítka. Navíc `product.title` se na detailu **nikde nezobrazuje**
(`ProductDetail.tsx:360` vypisuje `detail_title`, `title` je jen v `alt` obrázku), takže je to
i markup neviditelného obsahu. Nad `buildProductMeta` přidej dva helpery:

```ts
/**
 * Jméno produktu tak, jak ho uživatel VIDÍ — `detail_title` je to, co vypisuje
 * `<h1>` na detailu i nadpis stránky recenzí. Sdílené schválně: oba `Product`
 * uzly musí mít shodné `name`, jinak je Google nemá jak spárovat, a `product.title`
 * je interní pojmenování, které se nikde nevykresluje.
 */
export function productDisplayName(product: { detail_title: string | null; title: string }): string {
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string detail_title must fall through to fallback
  return product.detail_title?.trim() || product.title;
}

/**
 * Stabilní identita produktu napříč stránkami. Detail i stránka recenzí vydávají
 * `Product` uzel; bez shodného `@id` je Google vidí jako dva různé produkty.
 * Míří na detail, protože ten je kanonickou stránkou produktu.
 */
export function productJsonLdId(slug: string, siteUrl: string = SITE_URL): string {
  return `${siteUrl}/cestovni-pruvodci/${slug}#product`;
}
```

V `buildProductMeta` pak nahraď řádek 81 — z:

```ts
    name: product.title,
```

na:

```ts
    '@id': productJsonLdId(product.slug, siteUrl),
    name: productDisplayName(product),
```

a do rozhraní `ProductJsonLd` přidej hned za `'@type': string;`:

```ts
  '@id': string;
```

Nad `buildProductMeta` vytáhni sdílené mapování `Review` (aby nevznikly dvě verze pravdy) — přidej:

```ts
function toReviewJsonLd(
  reviews: { author: string; rating: number; text: string; datePublished: string }[],
): ReviewJsonLd[] {
  return reviews.map((r) => ({
    '@type': 'Review',
    author: { '@type': 'Person', name: r.author },
    reviewRating: { '@type': 'Rating', ratingValue: String(r.rating) },
    reviewBody: r.text,
    datePublished: r.datePublished,
  }));
}
```

V `buildProductMeta` nahraď tělo `jsonLd.review = options.reviews.map(…)` voláním helperu:

```ts
      jsonLd.review = toReviewJsonLd(options.reviews);
```

Na konec souboru přidej:

```ts
/**
 * JSON-LD pro stránku recenzí. Google tenhle typ stránky nazývá „product snippet"
 * (na rozdíl od „merchant listing" na detailu produktu). `offers` je v jeho tabulce
 * vlastností uvedené jako **Recommended, ne Required**, a Googlův vlastní příklad
 * „Product review page" ho neobsahuje. Vynecháváme ho záměrně:
 * koupit se tu nedá a stránka tak nekonkuruje detailu produktu o roli prodejní stránky.
 *
 * Pozor: `Product` musí nést **aspoň jedno** z `review` / `aggregateRating` / `offers`.
 * Když produkt nemá recenze, nevydáváme JSON-LD vůbec — proto je v `ProductReviewsMeta`
 * volitelné.
 */
export interface ProductReviewsJsonLd {
  '@context': string;
  '@type': 'Product';
  /** Shodné s uzlem na detailu produktu — jinak jsou to pro Google dva různé produkty. */
  '@id': string;
  name: string;
  /** Perex produktu. Chybí, když ho produkt nemá — stránka by ho pak nevykreslila. */
  description?: string;
  image: string[];
  aggregateRating?: AggregateRatingJsonLd;
  review?: ReviewJsonLd[];
}

export interface ProductReviewsMeta {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
  /** Nastaveno jen když produkt nemá recenze — jinak nedefinováno. */
  robots?: string;
  /** Chybí, když produkt nemá recenze — `Product` bez review/aggregateRating/offers je neplatný. */
  jsonLd?: ProductReviewsJsonLd;
}

/** Cesta stránky recenzí produktu (strana 1 je bez segmentu `/strana`). */
export function productReviewsPath(slug: string, page = 1): string {
  const base = `/cestovni-pruvodci/${slug}/recenze`;
  return page <= 1 ? base : `${base}/strana/${page}`;
}

export function buildProductReviewsMeta(
  product: ProductForReviews,
  options: {
    page: number;
    reviews: { author: string; rating: number; text: string; datePublished: string }[];
  },
  siteUrl: string = SITE_URL,
): ProductReviewsMeta {
  // Tentýž helper jako buildProductMeta → obě stránky pošlou shodné `name`.
  const productTitle = productDisplayName(product);
  const count = product.review_count ?? 0;
  const suffix = options.page > 1 ? ` (strana ${options.page})` : '';
  const title = `Recenze — ${productTitle}${suffix}`;
  const description = count > 0
    ? `Recenze od ověřených zákazníků k průvodci ${productTitle}. Přečti si, co říkají ti, kteří s ním už cestovali.`
    : `Průvodce ${productTitle} zatím nemá recenzi. Buď první, kdo se podělí o zkušenost.`;
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string image_url must fall through to fallback
  const image = product.image_url || `${siteUrl}/images/placeholder-guide.jpg`;

  // `Product` musí nést aspoň jedno z review/aggregateRating/offers. Bez recenzí
  // by žádné z nich nebylo → radši nevydáme JSON-LD vůbec, než neplatný markup.
  let jsonLd: ProductReviewsJsonLd | undefined;
  if (count > 0) {
    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      // Shodné s uzlem na detailu produktu — bez toho Google nemá jak poznat,
      // že obě stránky mluví o tomtéž produktu.
      '@id': productJsonLdId(product.slug, siteUrl),
      // `name`, `description` i `image` musí odpovídat tomu, co je na stránce
      // VIDĚT: nadpis nese `productTitle`, perex je `hero_subtitle` a náhledový
      // obrázek je `image_url` — Task 8 všechny tři vykresluje. Kdyby je stránka
      // přestala zobrazovat, musí zmizet i odsud.
      name: productTitle,
      image: [image],
      aggregateRating: {
        '@type': 'AggregateRating',
        // Tatáž funkce jako ProductRatingSummary → zobrazená hodnota == ratingValue.
        ratingValue: ratingValueJsonLd(product.average_rating ?? 0),
        reviewCount: count,
      },
    };
    // `description` jen když perex existuje. NEPOUŽÍVAT jako fallback `description`
    // z meta tagu: ta věta je marketingový text pro výsledky vyhledávání a na
    // stránce nikde není — markovali bychom obsah, který uživatel nevidí.
    const perex = product.hero_subtitle?.trim();
    if (perex) {
      jsonLd.description = perex;
    }
    if (options.reviews.length > 0) {
      jsonLd.review = toReviewJsonLd(options.reviews);
    }
  }

  return {
    title,
    description,
    canonical: `${siteUrl}${productReviewsPath(product.slug, options.page)}`,
    ogImage: image,
    // Jen `noindex`. Google `follow` mezi platnými pravidly neuvádí — následování
    // odkazů je výchozí chování, takže `noindex, follow` je pro něj totéž co `noindex`.
    robots: count === 0 ? 'noindex' : undefined,
    jsonLd,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/utils/productSeo.test.ts`
Expected: PASS včetně stávajících testů `buildProductMeta` (refaktor na `toReviewJsonLd` nemění výstup).

- [ ] **Step 5: Commit**

```bash
git add src/utils/productSeo.ts src/utils/productSeo.test.ts
git commit -m "feat(seo): build product-snippet metadata for the reviews page

offers is Recommended rather than Required for a product snippet, so the
reviews page omits it and stops competing with the product page as the
sellable listing. Product needs at least one of review, aggregateRating or
offers, so a product with no reviews gets no JSON-LD at all rather than an
invalid node. ratingValue goes through the same rounding as the visible
summary, because marking up a value the page never shows is not allowed.
Each page canonicalises to itself because Google forbids pointing a
paginated sequence at page one."
```

---

### Task 6: `SeoTags` — volitelná `robots` meta

**Files:**
- Modify: `src/components/common/SeoTags.tsx`
- Create: `src/components/common/SeoTags.test.tsx`

**Interfaces:**
- Consumes: nic
- Produces: `SeoTagsMeta` s volitelným `robots?: string`. Používá Task 8.

- [ ] **Step 1: Write the failing test**

Vytvoř `src/components/common/SeoTags.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import SeoTags from './SeoTags';

const base = {
  title: 'Recenze',
  description: 'Popis',
  canonical: 'https://x.cz/a',
  ogImage: 'https://x.cz/i.png',
};

describe('SeoTags', () => {
  it('bez robots značku nevykreslí', () => {
    render(<SeoTags meta={base} />);
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('s robots značku vykreslí', () => {
    render(<SeoTags meta={{ ...base, robots: 'noindex' }} />);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/common/SeoTags.test.tsx`
Expected: FAIL u druhého testu — značka se nevykreslí; TypeScript navíc `robots` v `SeoTagsMeta` nezná.

- [ ] **Step 3: Write minimal implementation**

V `src/components/common/SeoTags.tsx` rozšiř import typů — z:

```tsx
import type { ProductMeta } from '../../utils/productSeo';
```

na:

```tsx
import type { ProductMeta, ProductReviewsMeta } from '../../utils/productSeo';
```

Do `SeoTagsMeta` přidej za `ogImage`:

```tsx
  /** Např. 'noindex' pro stránky, které nemají do indexu. */
  robots?: string;
```

A rozšiř typ `jsonLd` o tvar stránky recenzí — jinak by `ProductReviewsMeta` nešla předat:

```tsx
  jsonLd?: BlogMeta['jsonLd'] | ProductMeta['jsonLd'] | ProductReviewsMeta['jsonLd'];
```

Do JSX hned za `<link rel="canonical" …/>`:

```tsx
      {meta.robots && <meta name="robots" content={meta.robots} />}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/components/common/SeoTags.test.tsx && npm run type-check`
Expected: PASS, 2 testy. Typová kontrola musí projít i s rozšířeným `jsonLd` — bez ní by se `ProductReviewsMeta` z Tasku 5 do `SeoTags` nedala předat.

- [ ] **Step 5: Commit**

```bash
git add src/components/common/SeoTags.tsx src/components/common/SeoTags.test.tsx
git commit -m "feat(seo): let SeoTags emit a robots meta tag"
```

---

### Task 7: `ReviewsPagination` — stránkování odkazy

Google crawler neklikne na tlačítko, jde jen po `<a href>`, takže stránkování musí být odkazy.

**Files:**
- Create: `src/components/reviews/paginationItems.ts`
- Create: `src/components/reviews/paginationItems.test.ts`
- Create: `src/components/reviews/ReviewsPagination.tsx`
- Create: `src/components/reviews/ReviewsPagination.test.tsx`

**Interfaces:**
- Consumes: nic
- Produces:
  ```tsx
  interface ReviewsPaginationProps {
    currentPage: number;
    totalPages: number;
    buildHref: (page: number) => string;
    className?: string;
  }
  ```
  Používá Task 8.

- [ ] **Step 1: Write the failing test**

Vytvoř `src/components/reviews/paginationItems.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { paginationItems } from './paginationItems';

describe('paginationItems', () => {
  it('do sedmi stran vypíše všechny', () => {
    expect(paginationItems(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('uprostřed dlouhé sekvence zkrátí obě strany', () => {
    expect(paginationItems(10, 30)).toEqual([1, 'gap', 9, 10, 11, 'gap', 30]);
  });

  it('na začátku zkrátí jen konec', () => {
    expect(paginationItems(2, 30)).toEqual([1, 2, 3, 'gap', 30]);
  });

  it('na konci zkrátí jen začátek', () => {
    expect(paginationItems(30, 30)).toEqual([1, 'gap', 29, 30]);
  });

  it('nikdy nevyrobí stranu mimo rozsah', () => {
    expect(paginationItems(1, 30)).toEqual([1, 2, 'gap', 30]);
  });
});
```

A `src/components/reviews/ReviewsPagination.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReviewsPagination from './ReviewsPagination';

const buildHref = (page: number) => (page <= 1 ? '/r' : `/r/strana/${page}`);
const renderAt = (currentPage: number, totalPages: number) =>
  render(
    <MemoryRouter>
      <ReviewsPagination currentPage={currentPage} totalPages={totalPages} buildHref={buildHref} />
    </MemoryRouter>,
  );

describe('ReviewsPagination', () => {
  it('při jediné straně nevykreslí nic', () => {
    const { container } = renderAt(1, 1);
    expect(container).toBeEmptyDOMElement();
  });

  it('je to pojmenovaný orientační bod', () => {
    renderAt(2, 3);
    expect(screen.getByRole('navigation', { name: 'Stránkování recenzí' })).toBeInTheDocument();
  });

  it('aktuální strana zůstává odkazem a nese aria-current', () => {
    // W3C Design System: „it is fully linked so users of Assistive Technology
    // can find which is the currently active link."
    renderAt(2, 3);
    const current = screen.getByRole('link', { name: 'Strana 2' });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveAttribute('href', '/r/strana/2');
  });

  it('u krátké sekvence vypíše všechny strany', () => {
    renderAt(1, 7);
    expect(screen.getAllByRole('link', { name: /^Strana \d+$/ })).toHaveLength(7);
    expect(screen.queryByText('…')).not.toBeInTheDocument();
  });

  it('u dlouhé sekvence zkrátí prostředek výpustkami', () => {
    renderAt(10, 30);
    // Vždy první, poslední, aktuální a její sousedi.
    for (const page of ['1', '9', '10', '11', '30']) {
      expect(screen.getByRole('link', { name: `Strana ${page}` })).toBeInTheDocument();
    }
    expect(screen.queryByRole('link', { name: 'Strana 5' })).not.toBeInTheDocument();
    expect(screen.getAllByText('…')).toHaveLength(2);
  });

  it('každý odkaz má vlastní přístupný název', () => {
    renderAt(2, 3);
    expect(screen.getByRole('link', { name: 'Strana 1' })).toHaveAttribute('href', '/r');
    expect(screen.getByRole('link', { name: 'Strana 3' })).toHaveAttribute('href', '/r/strana/3');
    expect(screen.getByRole('link', { name: 'Předchozí strana' })).toHaveAttribute('href', '/r');
    expect(screen.getByRole('link', { name: 'Další strana' })).toHaveAttribute('href', '/r/strana/3');
  });

  it('na první straně chybí odkaz na předchozí', () => {
    renderAt(1, 3);
    expect(screen.queryByRole('link', { name: 'Předchozí strana' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Další strana' })).toBeInTheDocument();
  });

  it('na poslední straně chybí odkaz na další', () => {
    renderAt(3, 3);
    expect(screen.queryByRole('link', { name: 'Další strana' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Předchozí strana' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/reviews/ReviewsPagination.test.tsx src/components/reviews/paginationItems.test.ts`
Expected: FAIL — ani komponenta, ani `paginationItems` neexistují.

- [ ] **Step 3: Write minimal implementation**

Nejdřív `src/components/reviews/paginationItems.ts` (vlastní modul, ne export z komponenty —
`react-refresh/only-export-components` by u exportované funkce vedle komponenty hlásil varování):

```ts
export type PaginationItem = number | 'gap';

/** Do téhle délky se vypíšou všechny strany; nad ní se prostředek zkrátí. */
const FULL_LIST_LIMIT = 7;

/**
 * Které strany se ve stránkování vypíšou. Vždy první, poslední, aktuální a její
 * sousedi; mezery mezi nimi nahradí `'gap'`. Bez zkrácení by produkt s 300
 * recenzemi vyrobil 30 odkazů v jedné navigaci.
 */
export function paginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= FULL_LIST_LIMIT) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const keep = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  const sorted = [...keep].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);

  const items: PaginationItem[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous > 0 && page - previous > 1) items.push('gap');
    items.push(page);
    previous = page;
  }
  return items;
}
```

Pak `src/components/reviews/ReviewsPagination.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { paginationItems } from './paginationItems';

interface ReviewsPaginationProps {
  currentPage: number;
  totalPages: number;
  buildHref: (page: number) => string;
  className?: string;
}

const linkClass =
  'inline-flex items-center justify-center min-w-10 h-10 px-3 rounded-xl border border-gray-200 text-gray-700 hover:border-green-800 hover:text-green-800 transition-colors';
const currentClass =
  'inline-flex items-center justify-center min-w-10 h-10 px-3 rounded-xl bg-green-800 text-white font-medium';

/**
 * Stránkování recenzí. Vždy odkazy, nikdy tlačítka — Google crawler neklikne
 * na tlačítko a další strany by nenašel. Odkaz na stranu 1 je vždy přítomný,
 * protože dokumentace doporučuje zdůraznit začátek kolekce.
 *
 * Aktuální strana zůstává odkazem s `aria-current="page"`, jak doporučuje W3C
 * Design System: „it is fully linked so users of Assistive Technology can find
 * which is the currently active link."
 *
 * Šipky `‹`/`›` se nedublují s `aria-label` — přístupný název odkazu ho nahrazuje,
 * a WCAG 2.5.3 symbolicky užitý znak za viditelný popisek nepovažuje.
 */
const ReviewsPagination = ({ currentPage, totalPages, buildHref, className = '' }: ReviewsPaginationProps) => {
  if (totalPages <= 1) return null;

  const items = paginationItems(currentPage, totalPages);

  return (
    <nav aria-label="Stránkování recenzí" className={`flex justify-center ${className}`.trim()}>
      <ul className="flex flex-wrap items-center gap-2">
        {currentPage > 1 && (
          <li>
            <Link to={buildHref(currentPage - 1)} className={linkClass} aria-label="Předchozí strana">
              ‹
            </Link>
          </li>
        )}
        {items.map((item, index) =>
          item === 'gap' ? (
            <li key={`gap-${index}`} className="px-1 text-gray-400" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                to={buildHref(item)}
                className={item === currentPage ? currentClass : linkClass}
                aria-label={`Strana ${item}`}
                aria-current={item === currentPage ? 'page' : undefined}
              >
                {item}
              </Link>
            </li>
          ),
        )}
        {currentPage < totalPages && (
          <li>
            <Link to={buildHref(currentPage + 1)} className={linkClass} aria-label="Další strana">
              ›
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
};

export default ReviewsPagination;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/components/reviews/ReviewsPagination.test.tsx src/components/reviews/paginationItems.test.ts`
Expected: PASS — 8 testů komponenty a 5 testů `paginationItems`.

- [ ] **Step 5: Commit**

```bash
git add src/components/reviews/ReviewsPagination.tsx src/components/reviews/ReviewsPagination.test.tsx src/components/reviews/paginationItems.ts src/components/reviews/paginationItems.test.ts
git commit -m "feat(reviews): add link-based pagination nav

Crawlers follow anchors, not button clicks, so paging has to be real links
for the deeper pages to be discoverable at all. The current page stays a
link carrying aria-current, so assistive tech can locate it in the list.
Sequences longer than seven pages collapse the middle, otherwise a product
with 300 reviews would render thirty links in one nav."
```

---

### Task 8: `ProductReviewsPage` — samotná stránka

**Files:**
- Create: `src/constants/reviews.ts`
- Create: `src/constants/reviews.test.ts`
- Create: `src/pages/ProductReviewsPage.tsx`
- Create: `src/pages/ProductReviewsPage.test.tsx`
- Modify: `src/constants/routes.ts`
- Modify: `src/App.tsx:108`

**Interfaces:**
- Consumes: `fetchProductForReviews`, `ProductForReviews`, `fetchApprovedReviews` (Task 4); `buildProductReviewsMeta`, `productReviewsPath` (Task 5); `SeoTags` s `robots` (Task 6); `ReviewsPagination` (Task 7); `ProductRatingSummary` (Task 3); `ReviewCard` s `variant="full"` (Task 1)
- Produces:
  ```ts
  // src/constants/reviews.ts — JEDINÝ zdroj pravdy, importuje ho i prerender.mjs a sitemap.mjs
  export const REVIEWS_PAGE_SIZE = 10;
  export const PRODUCT_REVIEWS_LIMIT = 3;
  export const MAX_PRERENDERED_REVIEW_PAGES = 20;
  export function clampPage(raw: string | undefined, totalPages: number): number;
  ```
  a routy `ROUTES.PRODUCT_REVIEWS` / `ROUTES.PRODUCT_REVIEWS_PAGED`. Používá Task 9 a Task 10.

- [ ] **Step 1: Write the failing test**

Vytvoř `src/constants/reviews.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { clampPage, REVIEWS_PAGE_SIZE, PRODUCT_REVIEWS_LIMIT } from './reviews';

describe('konstanty recenzí', () => {
  it('drží dohodnuté hodnoty', () => {
    expect(REVIEWS_PAGE_SIZE).toBe(10);
    expect(PRODUCT_REVIEWS_LIMIT).toBe(3);
  });
});

describe('clampPage', () => {
  it('bez segmentu strany vrací první stranu', () => {
    expect(clampPage(undefined, 3)).toBe(1);
  });

  it('platnou stranu propustí', () => {
    expect(clampPage('2', 3)).toBe(2);
    expect(clampPage('3', 3)).toBe(3);
  });

  it('stranu nad rozsah ořízne na poslední platnou', () => {
    expect(clampPage('99', 3)).toBe(3);
    expect(clampPage('99999999999999999999', 3)).toBe(3);
  });

  it('cokoli, co není kladné celé číslo bez vodicí nuly, spadne na první stranu', () => {
    for (const raw of ['0', '-1', 'abc', '2.5', '2.0', '+2', '02', '0x2', '2e1', ' 2 ', '', '٢', 'Infinity']) {
      expect(clampPage(raw, 3)).toBe(1);
    }
  });

  it('při nule stran vrací vždy 1, aby nevznikla strana 0', () => {
    expect(clampPage('5', 0)).toBe(1);
    expect(clampPage(undefined, 0)).toBe(1);
  });
});
```

A `src/pages/ProductReviewsPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { CartProvider } from '../contexts';

const fetchProductForReviewsMock = vi.fn<(...args: unknown[]) => unknown>();
const fetchApprovedReviewsMock = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('../lib/reviews', () => ({
  fetchProductForReviews: (...args: unknown[]) => fetchProductForReviewsMock(...args),
  fetchApprovedReviews: (...args: unknown[]) => fetchApprovedReviewsMock(...args),
}));
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

import ProductReviewsPage from './ProductReviewsPage';

const product = {
  id: 'p1', title: 'Itálie', detail_title: 'Roadtrip po Itálii', hero_subtitle: '20 dní',
  slug: 'italie', image_url: null, average_rating: 5, review_count: 12,
};
const review = (id: string) => ({
  id, product_id: 'p1', reviewer_name: 'Jana N.', rating: 5,
  review_text: 'Skvělý průvodce.', created_at: '2026-07-01T10:00:00.000Z',
  products: { title: 'Itálie', slug: 'italie' },
});

/** Vypíše aktuální cestu, aby šlo ověřit přesměrování. */
const LocationSpy = () => {
  const location = useLocation();
  return <div data-testid="pathname">{location.pathname}</div>;
};

// `CartProvider` je povinný: stránka renderuje Layout → Navigation → CartButton,
// který volá `useCart()`. Bez providera to vyhodí a spadne to do NavigationErrorBoundary —
// testy sice projdou, ale testovaly by jiný strom, než jaký běží v produkci
// (a každý test by vypsal plný React error stack). Stejně to řeší ProductDetail.seo.test.tsx.
function renderAt(path: string) {
  return render(
    <CartProvider>
      <MemoryRouter initialEntries={[path]}>
        <LocationSpy />
        <Routes>
          <Route path="/cestovni-pruvodci/:slug/recenze" element={<ProductReviewsPage />} />
          <Route path="/cestovni-pruvodci/:slug/recenze/strana/:strana" element={<ProductReviewsPage />} />
          <Route path="/cestovni-pruvodci/:slug" element={<div>DETAIL PRODUKTU</div>} />
          <Route path="*" element={<div>NENALEZENO</div>} />
        </Routes>
      </MemoryRouter>
    </CartProvider>,
  );
}

describe('ProductReviewsPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('vykreslí povinný disclosure', async () => {
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze');
    await waitFor(() => expect(screen.getByText(/ověření zákazníci/)).toBeInTheDocument());
  });

  it('strana 1 načítá s nulovým offsetem', async () => {
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze');
    await waitFor(() =>
      expect(fetchApprovedReviewsMock).toHaveBeenCalledWith({ productId: 'p1', limit: 10, offset: 0 }),
    );
  });

  it('strana 2 načítá s offsetem 10', async () => {
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze/strana/2');
    await waitFor(() =>
      expect(fetchApprovedReviewsMock).toHaveBeenCalledWith({ productId: 'p1', limit: 10, offset: 10 }),
    );
  });

  it('stranu mimo rozsah přesměruje na poslední platnou a dotaz mimo rozsah NEODEŠLE', async () => {
    // PostgREST vrací na Range mimo rozsah HTTP 416 → count by se nedozvěděl,
    // proto se strana ořízne z review_count ještě před dotazem.
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze/strana/99');
    // 12 recenzí / 10 na stranu = 2 strany → poslední platná je 2.
    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent('/cestovni-pruvodci/italie/recenze/strana/2'),
    );
    await waitFor(() =>
      expect(fetchApprovedReviewsMock).toHaveBeenCalledWith({ productId: 'p1', limit: 10, offset: 10 }),
    );
    // Nikdy se neptáme na stranu 99 (offset 980).
    expect(fetchApprovedReviewsMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ offset: 980 }),
    );
  });

  it('nečíselnou stranu přesměruje na první', async () => {
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze/strana/abc');
    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent('/cestovni-pruvodci/italie/recenze'),
    );
    await waitFor(() =>
      expect(fetchApprovedReviewsMock).toHaveBeenCalledWith({ productId: 'p1', limit: 10, offset: 0 }),
    );
  });

  it('/strana/1 přesměruje na adresu bez segmentu strany', async () => {
    // Jinak by tentýž obsah žil na dvou adresách.
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze/strana/1');
    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent('/cestovni-pruvodci/italie/recenze'),
    );
  });

  it('platnou stranu 2 nepřesměrovává', async () => {
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze/strana/2');
    await waitFor(() => expect(fetchApprovedReviewsMock).toHaveBeenCalled());
    expect(screen.getByTestId('pathname')).toHaveTextContent('/cestovni-pruvodci/italie/recenze/strana/2');
  });

  it('neznámý produkt vede na NotFound', async () => {
    fetchProductForReviewsMock.mockResolvedValue(null);
    renderAt('/cestovni-pruvodci/neexistuje/recenze');
    await waitFor(() => expect(screen.getByText(/Stránka nenalezena|404/i)).toBeInTheDocument());
    expect(fetchApprovedReviewsMock).not.toHaveBeenCalled();
  });

  it('produkt bez recenzí ukáže prázdný stav a nedotazuje se', async () => {
    fetchProductForReviewsMock.mockResolvedValue({ ...product, review_count: 0, average_rating: 0 });
    renderAt('/cestovni-pruvodci/italie/recenze');
    await waitFor(() => expect(screen.getByText(/zatím recenzi nemá/)).toBeInTheDocument());
    expect(fetchApprovedReviewsMock).not.toHaveBeenCalled();
  });

  it('selhání načtení ukáže chybu, ne prázdný stav', async () => {
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockRejectedValue(new Error('boom'));
    renderAt('/cestovni-pruvodci/italie/recenze');
    await waitFor(() => expect(screen.getByText(/nepodařilo načíst/)).toBeInTheDocument());
    expect(screen.queryByText(/zatím recenzi nemá/)).not.toBeInTheDocument();
  });

  it('po kliknutí na jinou stranu přesune fokus na nadpis', async () => {
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze');
    const heading = await screen.findByRole('heading', { level: 1 });
    expect(document.activeElement).not.toBe(heading);

    // Navigovat se MUSÍ uvnitř téhož routeru. `MemoryRouter` drží historii v `useRef`
    // a `initialEntries` čte jen při prvním renderu, takže `rerender()` s novým
    // routerem stejného typu na stejné pozici location vůbec nezmění — React ho
    // jen re-renderuje a nové `initialEntries` zahodí. (Ověřeno spuštěním.)
    fireEvent.click(await screen.findByRole('link', { name: 'Strana 2' }));
    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent('/cestovni-pruvodci/italie/recenze/strana/2'),
    );
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 })));
  });

  it('přesměrování z neplatné strany fokus NEsebere', async () => {
    // Regrese: guard nesmí viset na `location.key`. Po přesměrování je klíč náhodný
    // (ne 'default'), takže by fokus skočil uživateli, který přišel z Googlu.
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze/strana/99');
    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent('/cestovni-pruvodci/italie/recenze/strana/2'),
    );
    const heading = await screen.findByRole('heading', { level: 1 });
    expect(document.activeElement).not.toBe(heading);
  });

  it('přímý vstup na stranu 2 fokus NEsebere', async () => {
    // Regrese: guard nesmí viset na tom, že se `page` po načtení dat změní z 1 na 2 —
    // to nastane i při příchodu z Googlu nebo ze záložky a uživateli by to bez varování
    // přeskočilo fokus doprostřed stránky.
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze/strana/2');
    await waitFor(() => expect(fetchApprovedReviewsMock).toHaveBeenCalled());
    const heading = await screen.findByRole('heading', { level: 1 });
    expect(document.activeElement).not.toBe(heading);
  });

  it('odkazuje zpět na detail produktu', async () => {
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze');
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /zpět na průvodce/i })).toHaveAttribute(
        'href',
        '/cestovni-pruvodci/italie',
      ),
    );
  });

  it('vykreslí perex a obrázek, protože je posílá do JSON-LD', async () => {
    // Google zakazuje markovat obsah, který na stránce není. `description`
    // a `image` v JSON-LD proto musí mít na stránce protějšek.
    fetchProductForReviewsMock.mockResolvedValue({ ...product, image_url: 'https://cdn.example/i.jpg' });
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    renderAt('/cestovni-pruvodci/italie/recenze');
    await waitFor(() => expect(screen.getByText('20 dní')).toBeInTheDocument());
    expect(screen.getByRole('img', { name: /Průvodce Roadtrip po Itálii/ })).toHaveAttribute(
      'src',
      'https://cdn.example/i.jpg',
    );
  });

  it('signalizuje prerenderu hotovo až po načtení dat', async () => {
    // Na tomhle markeru stojí celý prerender: `waitForSelector` na něj čeká
    // a build tvrdě spadne, když nepřijde. Zároveň nesmí přijít předčasně,
    // jinak by se uložilo statické HTML s načítacím stavem.
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    const { container } = renderAt('/cestovni-pruvodci/italie/recenze');
    expect(container.querySelector('[data-prerender-ready="true"]')).toBeNull();
    await waitFor(() =>
      expect(container.querySelector('[data-prerender-ready="true"]')).not.toBeNull(),
    );
  });

  it('při selhání načtení prerender-ready NEnastaví', async () => {
    // Záměr: build má spadnout hlasitě. Bez toho by výpadek Supabase během
    // prerenderu tiše nasadil HTML s textem „Recenze se nepodařilo načíst“,
    // které má <h1> i dost bajtů, takže by prošlo i validací.
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockRejectedValue(new Error('boom'));
    const { container } = renderAt('/cestovni-pruvodci/italie/recenze');
    await waitFor(() => expect(screen.getByText(/nepodařilo načíst/)).toBeInTheDocument());
    expect(container.querySelector('[data-prerender-ready="true"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/pages/ProductReviewsPage.test.tsx src/constants/reviews.test.ts`
Expected: FAIL — ani stránka, ani `src/constants/reviews.ts` neexistují.

- [ ] **Step 3: Přidej konstanty a routy**

Vytvoř `src/constants/reviews.ts`. Soubor musí zůstat **prostý TypeScript bez JSX, bez `enum` a bez `namespace`** a interní importy (žádné tu zatím nejsou) by musely mít explicitní příponu — importují ho totiž i `prerender.mjs` a `sitemap.mjs`, které jedou pod nativním type-strippingem Node 24:

```ts
/** Kolik recenzí je na jedné straně stránky recenzí. */
export const REVIEWS_PAGE_SIZE = 10;

/**
 * Kolik recenzí ukazuje detail produktu. Hodnotu čte jak ProductReviews
 * (vykreslení), tak ProductDetail (preload + JSON-LD) — Google vyžaduje, aby se
 * počet recenzí v markupu rovnal počtu viditelných.
 */
export const PRODUCT_REVIEWS_LIMIT = 3;

/**
 * Strop pro počet prerenderovaných stran recenzí na jeden produkt. Každá strana
 * je jedna návštěva headless Chromia navíc; hlubší strany zůstanou dostupné,
 * jen se nepředgenerují ani neuvedou v sitemapě.
 */
export const MAX_PRERENDERED_REVIEW_PAGES = 20;

/**
 * Ořízne stranu z adresy do platného rozsahu. Musí se stát PŘED dotazem:
 * `fetchApprovedReviews` posílá `count: 'exact'`, takže PostgREST na `Range`
 * mimo rozsah odpoví 416, funkce na chybu vyhodí a `count` se nedozvíme.
 * Počet stran proto plyne z `products.review_count`.
 *
 * Přijímáme jen kladné celé číslo bez vodicí nuly. Volnější `Number()` by bralo
 * i `0x2`, `2e1`, `+2` nebo ` 2 ` a vyrobilo pro tutéž stranu několik adres.
 */
export function clampPage(raw: string | undefined, totalPages: number): number {
  if (!raw || !/^[1-9]\d*$/.test(raw)) return 1;
  return Math.min(Number(raw), Math.max(totalPages, 1));
}
```

V `src/constants/routes.ts` přidej do `ROUTES` za `CUSTOM_ITINERARY_PREVIEW`:

```ts
  PRODUCT_REVIEWS: '/cestovni-pruvodci/:slug/recenze',
  PRODUCT_REVIEWS_PAGED: '/cestovni-pruvodci/:slug/recenze/strana/:strana',
```

- [ ] **Step 4: Write the page**

Vytvoř `src/pages/ProductReviewsPage.tsx`:

```tsx
import { useState, useEffect, useRef } from 'react';
import { Link, Navigate, NavigationType, useNavigationType, useParams } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import Layout from '../components/layout/Layout';
import SeoTags from '../components/common/SeoTags';
import ReviewCard from '../components/ui/ReviewCard';
import ReviewsPagination from '../components/reviews/ReviewsPagination';
import ProductRatingSummary from '../components/reviews/ProductRatingSummary';
import { REVIEWS_DISCLOSURE } from '../components/reviews/disclosure';
import { formatReviewDate } from '../components/reviews/formatReviewDate';
import { REVIEWS_PAGE_SIZE, clampPage } from '../constants/reviews';
import { fetchApprovedReviews, fetchProductForReviews } from '../lib/reviews';
import type { ProductForReviews, PublicReview } from '../lib/reviews';
import { buildProductReviewsMeta, productReviewsPath } from '../utils/productSeo';
import NotFound from './NotFound';

const ProductReviewsPage = () => {
  const { slug, strana } = useParams();
  const navigationType = useNavigationType();
  const [product, setProduct] = useState<ProductForReviews | null>(null);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Fokus přesouváme jen po skutečném přepnutí strany UVNITŘ téhle stránky.
    // Obě podmínky jsou nutné, každá chytá jiný případ:
    //
    // 1. Ne při prvním renderu. Příchod z detailu produktu je totiž taky `PUSH`,
    //    jenže efekt běží dřív, než doběhne `fetchProductForReviews` — odečítač by
    //    oznámil useknuté „Recenze —“ a doplnění názvu už by neoznámil. Navíc by
    //    fokus přeskočil odkaz „Zpět na průvodce“, který je v DOMu NAD nadpisem,
    //    takže by se k němu dopředným tabováním nešlo dostat. (Ověřeno spuštěním.)
    // 2. Jen `PUSH`. `POP` = mount, reload i tlačítko zpět; `REPLACE` = naše
    //    vlastní přesměrování na kanonickou stranu. V obou případech si uživatel
    //    stránku právě otevřel a sebrat mu fokus doprostřed by bylo překvapení.
    //
    // Komponenta se mezi `/recenze` a `/recenze/strana/2` NEODMONTOVÁVÁ (obě routy
    // renderují tentýž typ, React je odsesouhlasí na stejné pozici), takže si
    // `isFirstRender` mezi stranami udrží hodnotu — ověřeno spuštěním.
    //
    // NEPOUŽÍVAT `location.key === 'default'`: klíč je 'default' jen na mountu
    // kanonické adresy. Po přesměrování z /strana/99 je náhodný a po F5 přežije
    // v `history.state`, takže by guard v obou případech neplatil (ověřeno spuštěním).
    // Stejně tak nejde vyjít ze změny `page` — ta se z 1 na 2 vyšplhá i při přímém
    // vstupu na /strana/2, jakmile doběhne načtení dat.
    //
    // `NavigationType.Push`, ne řetězec `'PUSH'`: `useNavigationType()` vrací enum
    // `Action` (re-exportovaný jako `NavigationType`) a porovnání s literálem shodí
    // lint na `@typescript-eslint/no-unsafe-enum-comparison` — Step 7 lint vyžaduje.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (navigationType !== NavigationType.Push) return;
    headingRef.current?.focus();
  }, [page, navigationType]);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      setError(false);
      setNotFound(false);
      setRedirectTo(null);
      try {
        const found = await fetchProductForReviews(slug!);
        if (!isMounted) return;
        if (!found) {
          setNotFound(true);
          return;
        }
        setProduct(found);

        const count = found.review_count ?? 0;
        const totalPages = Math.ceil(count / REVIEWS_PAGE_SIZE);
        const currentPage = clampPage(strana, totalPages);

        // Adresa neodpovídá platné straně (mimo rozsah, nečíselná, nebo /strana/1)
        // → přesměrujeme, ať tentýž obsah nežije pod víc adresami. Porovnáváme
        // parametr, ne `location.pathname`: pathname v závislostech efektu by při
        // každém přesměrování znovu natáhl produkt a k rozhodnutí nic nepřidává.
        const canonicalStrana = currentPage === 1 ? undefined : String(currentPage);
        if (strana !== canonicalStrana) {
          setRedirectTo(productReviewsPath(slug!, currentPage));
          return;
        }
        setPage(currentPage);

        if (count === 0) {
          setReviews([]);
          return;
        }
        const result = await fetchApprovedReviews({
          productId: found.id,
          limit: REVIEWS_PAGE_SIZE,
          offset: (currentPage - 1) * REVIEWS_PAGE_SIZE,
        });
        if (isMounted) setReviews(result.reviews);
      } catch (err) {
        if (isMounted) setError(true);
        // PostgREST vrací u 416 useknuté tělo (doslova `{"`), na kterém postgrest-js
        // zhavaruje při JSON.parse a vyhodí prostý objekt bez stacku. Sentry by z toho
        // udělal „Non-Error exception captured" bez jakékoli informace.
        const cause = err instanceof Error ? err : new Error(JSON.stringify(err));
        Sentry.captureException(cause, { tags: { area: 'reviews', component: 'ProductReviewsPage' } });
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- fire-and-forget load v useEffect
    load();
    return () => {
      isMounted = false;
    };
  }, [slug, strana]);

  // Ani jedna z těchhle dvou větví nevykreslí Layout s `ready`, takže je prerender
  // neuloží — `waitForSelector('[data-prerender-ready]')` vyprší a build spadne.
  // Je to ZÁMĚR: obě jsou během buildu dosažitelné jen závodem (produkt se deaktivuje
  // nebo mu ubudou recenze mezi načtením seznamu rout a návštěvou stránky). Hlasitý
  // pád je lepší než tiše nasazená 404 nebo přesměrování na platné adrese.
  if (notFound) return <NotFound />;
  // `replace`, aby se neplatná adresa nezanesla do historie prohlížeče. Pozor: je to
  // history.replaceState, ne `window.location` — Googlebot to nevidí jako přesměrování,
  // ale jako obsah pod PŮVODNÍ adresou. Proto tyhle adresy nikde neodkazujeme ani
  // nedáváme do sitemapy; kanonickou stranu pak označí `canonical` cílové stránky.
  //
  // Nemá smysl sem přidávat <meta name="robots" content="noindex">: React 19 by ji
  // sice zvedl do <head>, ale `Navigate` komponentu hned odmountuje a značka zmizí
  // dřív, než ji renderující crawler stihne vidět (ověřeno spuštěním).
  if (redirectTo) return <Navigate to={redirectTo} replace />;

  const count = product?.review_count ?? 0;
  // Stránkování NEOŘEZÁVÁME na `MAX_PRERENDERED_REVIEW_PAGES` [4. kolo]. Strop je
  // jen limit prerenderu, ne limit produktu — kdybychom o něj zkrátili odkazy,
  // uživatel by se nad 200 recenzemi na hlubší strany vůbec nedostal. Nad stropem
  // tedy vzniknou odkazy na strany bez statického HTML; crawler tam dostane
  // skořápku a obsah uvidí až po vykonání JavaScriptu. Je to vědomý kompromis
  // ve prospěch uživatele. Prerender na překročení stropu upozorní v logu
  // (Task 10), takže se strop dá včas zvednout.
  const totalPages = Math.ceil(count / REVIEWS_PAGE_SIZE);
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string detail_title must fall through, stejně jako v buildProductReviewsMeta
  const productTitle = product ? product.detail_title?.trim() || product.title : '';
  const meta = product
    ? buildProductReviewsMeta(product, {
        page,
        reviews: reviews.map((r) => ({
          author: r.reviewer_name,
          rating: r.rating,
          text: r.review_text,
          datePublished: r.created_at.slice(0, 10),
        })),
      })
    : null;

  return (
    // `!error` v `ready` je záměr: bez něj by výpadek Supabase během prerenderu
    // tiše nasadil statické HTML s textem „Recenze se nepodařilo načíst" — má <h1>
    // i dost bajtů, takže by prošlo i validací. Takhle build spadne a je to vidět.
    <Layout ready={!loading && !!product && !error}>
      {meta && <SeoTags meta={meta} />}
      {/* Obyčejný `div`, ne hlavní oblast — Layout element `main#main-content`
          renderuje sám a druhý orientační bod je nevalidní HTML i matoucí cíl
          pro skip-link.

          POZOR: v tomhle komentáři nesmí padnout doslovný zápis toho tagu
          s lomenou závorkou. Strážný test z Tasku 12 hledá v `src/pages`
          řetězec „main" s lomenou závorkou před ním a odchytil by si vlastní
          komentář — pak by nikdy nezezelenal a implementátor by v souboru
          marně hledal druhou hlavní oblast, která tu není. */}
      <div className="max-w-4xl mx-auto px-5 py-16">
        <Link to={`/cestovni-pruvodci/${slug}`} className="text-green-800 underline underline-offset-4">
          ← Zpět na průvodce
        </Link>

        {/* `focus:ring`, ne `focus-visible:ring`: po programovém `.focus()` se
            v Chromiu `:focus-visible` neuplatní, pokud uživatel ovládá stránku
            myší (změřeno v Chromiu i WebKitu). Prstenec by tak chyběl přesně
            tomu, kdo nejmíň čeká, že mu fokus někam skočí. Nadpis není běžně
            fokusovatelný, takže se prstenec nikde jinde neobjeví. */}
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-3xl sm:text-4xl font-bold text-green-800 mt-6 mb-4 focus:outline-none focus:ring-2 focus:ring-green-800 focus:ring-offset-2 rounded"
        >
          Recenze — {productTitle}
        </h1>

        {product && count > 0 && (
          <ProductRatingSummary average={product.average_rating ?? 0} count={count} className="mb-4" />
        )}

        {/* Perex a náhledový obrázek nejsou dekorace: JSON-LD je posílá
            v `description` a `image`, a Google zakazuje markovat obsah, který
            na stránce vidět není. Kdyby odsud zmizely, musí zmizet i
            z `buildProductReviewsMeta` — a naopak. Obrázek bereme z `meta.ogImage`
            schválně: je to tentýž výraz, který jde do markupu, včetně
            placeholderu pro produkt bez vlastního obrázku. */}
        {product?.hero_subtitle?.trim() && (
          <p className="text-lg text-gray-700 mb-6">{product.hero_subtitle}</p>
        )}
        {meta && (
          <img
            src={meta.ogImage}
            alt={`Průvodce ${productTitle}`}
            className="w-full max-h-64 object-cover rounded-2xl mb-8"
            loading="lazy"
          />
        )}

        {/* `gray-600` (7,56:1), ne `gray-500` (4,84:1) — AA sice projde obojí,
            ale u drobného textu je rezerva 0,34 na paletě, která se může posunout. */}
        <p className="text-sm text-gray-600 mb-10">{REVIEWS_DISCLOSURE}</p>

        {loading && <p className="text-center text-gray-600">Načítám recenze…</p>}

        {!loading && error && (
          <p className="text-center text-gray-600">Recenze se nepodařilo načíst. Zkus to prosím později.</p>
        )}

        {!loading && !error && count === 0 && (
          <p className="text-center text-gray-600">
            Tenhle průvodce zatím recenzi nemá. Buď první, kdo se podělí o zkušenost!
          </p>
        )}

        {!loading && !error && count > 0 && (
          <>
            <ul className="space-y-6">
              {reviews.map((review) => (
                <li key={review.id}>
                  <ReviewCard
                    name={review.reviewer_name}
                    rating={review.rating}
                    text={review.review_text}
                    productTitle={null}
                    date={formatReviewDate(review.created_at)}
                    verified
                    variant="full"
                    className="shadow-md"
                  />
                </li>
              ))}
            </ul>
            <ReviewsPagination
              currentPage={page}
              totalPages={totalPages}
              buildHref={(target) => productReviewsPath(slug!, target)}
              className="mt-10"
            />
          </>
        )}
      </div>
    </Layout>
  );
};

export default ProductReviewsPage;
```

- [ ] **Step 5: Zaregistruj routy**

V `src/App.tsx` přidej za řádek s `<Route path="/cestovni-pruvodci/:slug" …/>`:

```tsx
              <Route path={ROUTES.PRODUCT_REVIEWS} element={<ProductReviewsPage />} />
              <Route path={ROUTES.PRODUCT_REVIEWS_PAGED} element={<ProductReviewsPage />} />
```

A k `lazy` deklaracím (řádky 16-22), kam patří všechny nedávno přidané stránky — `<Suspense>` už v `App.tsx` je a klastr F-3 celý code-split zavedl schválně:

```tsx
const ProductReviewsPage = lazy(() => import('./pages/ProductReviewsPage'));
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test:run -- src/pages/ProductReviewsPage.test.tsx src/constants/reviews.test.ts`
Expected: PASS — 18 testů stránky a 6 testů konstant. Žádný test nesmí do konzole vypsat React error stack; kdyby ano, chybí `CartProvider`.

- [ ] **Step 7: Ověř typy a lint**

Run: `npm run type-check && npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/pages/ProductReviewsPage.tsx src/pages/ProductReviewsPage.test.tsx src/constants/reviews.ts src/constants/reviews.test.ts src/constants/routes.ts src/App.tsx
git commit -m "feat(reviews): add per-product reviews page

Full review texts, ten per page, paginated through the path so each page can
carry its own canonical in prerendered HTML. The page count comes from
products.review_count and the requested page is clamped before the query
runs, because the paged query sends count=exact and PostgREST answers an
out-of-range Range header with 416, so it could never report a total to
clamp against.

Focus moves to the heading only after an in-app navigation, keyed off the
router location rather than the page number: the number also climbs from 1
to 2 when someone lands on page 2 directly, and stealing focus there would
drop them into the middle of a page they just opened."
```

---

### Task 9: Detail produktu — 3 recenze, sdílená konstanta, souhrn hodnocení

Dnes je limit na dvou místech: `PRODUCT_REVIEWS_LIMIT = 6` v `ProductReviews.tsx:12` a **natvrdo `limit: 6`** v `ProductDetail.tsx:111`. Změna jen konstanty by se na detailu vůbec neprojevila.

**Files:**
- Modify: `src/components/reviews/ProductReviews.tsx:12,80,118,132-138`
- Modify: `src/pages/ProductDetail.tsx:54,111,358-362` (řádek 335 se **nemění** — zaokrouhlení `ratingValue` řeší Task 5 v `productSeo.ts`)
- Modify: `src/components/reviews/ProductReviews.test.tsx`
- Modify: `src/pages/ProductDetail.seo.test.tsx`

**Interfaces:**
- Consumes: `PRODUCT_REVIEWS_LIMIT` (Task 8), `ProductRatingSummary` (Task 3), `productReviewsPath` (Task 5), `ReviewCard` `variant` (Task 1)
- Produces: nic nového — jen napojení na sdílenou konstantu

- [ ] **Step 1: Write the failing test**

V `src/components/reviews/ProductReviews.test.tsx` uprav očekávání v testu „renders reviews when they exist" — z `limit: 6` na `limit: 3`:

```tsx
    expect(fetchApprovedReviewsMock).toHaveBeenCalledWith({ productId: 'p1', limit: 3, offset: 0 });
```

A přidej nové testy na konec bloku `describe('ProductReviews', …)`:

```tsx
  it('odkaz na všechny recenze míří na stránku produktu a je i u jediné recenze', async () => {
    singleMock.mockResolvedValue({ data: { id: 'p1', average_rating: 5, review_count: 1 }, error: null });
    fetchApprovedReviewsMock.mockResolvedValue({
      reviews: [{
        id: 'r1', product_id: 'p1', reviewer_name: 'Jana N.', rating: 5,
        review_text: 'Skvělý průvodce.', created_at: '2026-07-01T10:00:00.000Z',
        products: { title: 'Salzburg', slug: 'salzburg' },
      }],
      total: 1,
    });
    render(<MemoryRouter><ProductReviews productSlug="salzburg" /></MemoryRouter>);
    const link = await screen.findByRole('link', { name: /Všechny recenze/ });
    expect(link).toHaveAttribute('href', '/cestovni-pruvodci/salzburg/recenze');
  });
```

A do `src/pages/ProductDetail.seo.test.tsx` přidej test, že preload i vykreslení používají tentýž počet:

```tsx
import { PRODUCT_REVIEWS_LIMIT } from '../constants/reviews';

it('preload recenzí používá sdílenou konstantu, ne vlastní číslo', () => {
  expect(PRODUCT_REVIEWS_LIMIT).toBe(3);
  // Regrese: ProductDetail měl limit napevno, takže změna konstanty se neprojevila.
  //
  // Čteme cestou relativní ke kořeni projektu (cwd Vitestu). NEPOUŽÍVAT
  // `new URL('./ProductDetail.tsx', import.meta.url)`: Vite ten literál přepisuje
  // svým assetImportMetaUrl transformem na `http://localhost:3000/src/...`, takže
  // `readFileSync` spadne na ERR_INVALID_URL_SCHEME. (Ověřeno spuštěním.)
  const source = readFileSync('src/pages/ProductDetail.tsx', 'utf8');
  expect(source).not.toMatch(/limit:\s*6/);
  expect(source).toContain('PRODUCT_REVIEWS_LIMIT');
});
```

Na začátek `ProductDetail.seo.test.tsx` doplň import `readFileSync`:

```tsx
import { readFileSync } from 'node:fs';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/components/reviews/ProductReviews.test.tsx src/pages/ProductDetail.seo.test.tsx`
Expected: FAIL — limit je 6 a odkaz míří na `/recenze`.

- [ ] **Step 3: Uprav `ProductReviews`**

V `src/components/reviews/ProductReviews.tsx`:

Nahraď řádek 12 (`const PRODUCT_REVIEWS_LIMIT = 6;`) importem — přidej k ostatním importům:

```tsx
import { PRODUCT_REVIEWS_LIMIT } from '../../constants/reviews';
import { productReviewsPath } from '../../utils/productSeo';
```

a lokální konstantu smaž.

Mřížku (řádek 118) změň tak, aby se při méně než třech kartách vycentrovala:

```tsx
            <div
              className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${
                reviews.length < 3 ? 'max-w-4xl mx-auto' : ''
              }`.trim()}
            >
```

Kartám přidej `variant="teaser"` (výchozí, ale ať je záměr vidět):

```tsx
                  variant="teaser"
```

Blok odkazu (řádky 132-138) nahraď — odkaz se ukazuje už při jediné recenzi, protože na stránce je v plném znění:

```tsx
            {reviewCount > 0 && (
              <div className="text-center mt-8">
                <Link to={productReviewsPath(productSlug)} className="text-green-800 font-medium underline">
                  Všechny recenze ({reviewCount})
                </Link>
              </div>
            )}
```

Import `ROUTES` z `'../../constants'` odstraň, pokud ho soubor už nikde nepoužívá (jinak zůstane nepoužitý a spadne lint).

- [ ] **Step 4: Uprav `ProductDetail`**

V `src/pages/ProductDetail.tsx`:

Přidej k importům:

```tsx
import ProductRatingSummary from '../components/reviews/ProductRatingSummary';
import { PRODUCT_REVIEWS_LIMIT } from '../constants/reviews';
import { productReviewsPath } from '../utils/productSeo';
```

Na řádku 111 nahraď natvrdo zadané číslo konstantou:

```tsx
            const page = await fetchApprovedReviews({ productId: data.id, limit: PRODUCT_REVIEWS_LIMIT, offset: 0 });
```

Uprav komentář na řádku 54, ať už nelže:

```tsx
  // Raw recenze (stejný fetch jako seoReviews, PRODUCT_REVIEWS_LIMIT) — předávané
  // jako `preloaded` do ProductReviews, aby si sekce nemusela dělat vlastní duplicitní fetch.
```

Pod `<h1>` v „Title Section" (řádky **358-362**; 357 je komentář `{/* Title Section */}`, ten **zůstává**) přidej souhrn hodnocení:

```tsx
            <div className="text-center mb-6 pb-5 border-b border-gray-200">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black leading-tight">
                {product.detail_title}
              </h1>
              {(product.review_count ?? 0) > 0 && (
                <ProductRatingSummary
                  average={product.average_rating ?? 0}
                  count={product.review_count ?? 0}
                  href={productReviewsPath(product.slug)}
                  className="mt-4"
                />
              )}
            </div>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:run -- src/components/reviews/ProductReviews.test.tsx src/pages/ProductDetail.seo.test.tsx`
Expected: PASS.

- [ ] **Step 6: Ověř celou sadu**

Run: `npm run test:run && npm run type-check && npm run lint`
Expected: PASS. JSON-LD detailu teď nese nejvýš 3 `review`, což odpovídá třem zobrazeným kartám.

- [ ] **Step 7: Commit**

```bash
git add src/components/reviews/ProductReviews.tsx src/components/reviews/ProductReviews.test.tsx src/pages/ProductDetail.tsx src/pages/ProductDetail.seo.test.tsx
git commit -m "feat(reviews): show three teasers and a linked rating summary on product pages

The review limit lived in two places — a constant in ProductReviews and a
hardcoded 6 in ProductDetail — so changing one alone did nothing. Collapse it
to a single shared constant at 3, which keeps the JSON-LD review array equal
to what is actually visible, and drops the section from a measured 2430px to
1341px on a 390px viewport while filling the desktop row exactly."
```

---

### Task 10: Prerender a sitemap — routy recenzí včetně dalších stran

Neprerenderovaná adresa dostane přes Vercel rewrite `index.html`, tedy prázdnou skořápku bez nadpisu a bez obsahu — a `noindex` u produktu bez recenzí by se objevil až po vykonání JavaScriptu. Proto se prerenderují routy recenzí pro **všechny aktivní produkty**, včetně těch bez recenzí.

(Task 11 zároveň odstraňuje natvrdo zapsaný `canonical` z `index.html:17`. Do té doby by neprerenderovaná adresa dostala canonical mířící na homepage a klientský kód by ho přepisoval — což Google výslovně zakazuje. Prerender tenhle problém řeší jen pro adresy, které předgeneruje; Task 11 ho řeší pro všechny.)

**Files:**
- Modify: `scripts/contentSlugs.mjs:24-26`
- Modify: `scripts/prerender.mjs:11-16`
- Modify: `scripts/sitemap.mjs:33-37` (sestavení `paths` v `run()`; řádky 38-42 jsou `buildSitemap`/zápis souboru a **nemění se**)
- Modify: `scripts/prerender.test.js`
- Modify: `scripts/sitemap.test.js`

**Interfaces:**
- Consumes: `REVIEWS_PAGE_SIZE` a `MAX_PRERENDERED_REVIEW_PAGES` ze `src/constants/reviews.ts` (Task 8). **Hodnota se nikde nekopíruje** — oba skripty ten soubor importují přímo, přesně jako už dnes importují `../src/constants/publicRoutes.ts`.
- Produces: `collectRoutes(blogPosts, products)` nově generuje i routy recenzí; `collectSitemapPaths(posts, products)`.

- [ ] **Step 1: Write the failing test**

V `scripts/prerender.test.js` doplň k importům

```js
import { MAX_PRERENDERED_REVIEW_PAGES } from '../src/constants/reviews.ts';
```

a nahraď blok `describe('collectRoutes', …)`:

```js
describe('collectRoutes', () => {
  it('složí veřejné statické routy + blog + produkty bez duplikátů', () => {
    const routes = collectRoutes([{ slug: 'a' }, { slug: 'a' }], [{ slug: 'tos', review_count: 0 }]);
    expect(routes).toContain('/');
    expect(routes).toContain('/kontakt');
    expect(routes).toContain('/inspirace/a');
    expect(routes).toContain('/cestovni-pruvodci/tos');
    expect(routes.filter((r) => r === '/inspirace/a')).toHaveLength(1);
  });
  it('bez obsahu vrátí jen statické veřejné routy (z PUBLIC_PAGES)', () => {
    const routes = collectRoutes([], []);
    expect(routes).toContain('/');
    expect(routes).toContain('/ochrana-osobnich-udaju');
    expect(routes).not.toContain('/cestovni-pruvodci/itinerar-na-miru/dotaznik');
  });
  it('přidá routu recenzí i produktu bez recenzí (kvůli canonicalu a noindex ve zdroji)', () => {
    const routes = collectRoutes([], [{ slug: 'tos', review_count: 0 }]);
    expect(routes).toContain('/cestovni-pruvodci/tos/recenze');
    expect(routes).not.toContain('/cestovni-pruvodci/tos/recenze/strana/2');
  });
  it('přidá další strany podle review_count (10 na stranu)', () => {
    const routes = collectRoutes([], [{ slug: 'italie', review_count: 25 }]);
    expect(routes).toContain('/cestovni-pruvodci/italie/recenze');
    expect(routes).toContain('/cestovni-pruvodci/italie/recenze/strana/2');
    expect(routes).toContain('/cestovni-pruvodci/italie/recenze/strana/3');
    expect(routes).not.toContain('/cestovni-pruvodci/italie/recenze/strana/4');
  });
  it('přesně 10 recenzí = jedna strana, žádné /strana/2', () => {
    const routes = collectRoutes([], [{ slug: 'x', review_count: 10 }]);
    expect(routes).toContain('/cestovni-pruvodci/x/recenze');
    expect(routes).not.toContain('/cestovni-pruvodci/x/recenze/strana/2');
  });
  it('chybějící review_count bere jako nulu', () => {
    const routes = collectRoutes([], [{ slug: 'x' }]);
    expect(routes).toContain('/cestovni-pruvodci/x/recenze');
    expect(routes).not.toContain('/cestovni-pruvodci/x/recenze/strana/2');
  });
  it('počet prerenderovaných stran má strop', () => {
    // 500 recenzí = 50 stran; předgenerujeme jen prvních MAX_PRERENDERED_REVIEW_PAGES.
    const routes = collectRoutes([], [{ slug: 'velky', review_count: 500 }]);
    expect(routes).toContain(`/cestovni-pruvodci/velky/recenze/strana/${MAX_PRERENDERED_REVIEW_PAGES}`);
    expect(routes).not.toContain(`/cestovni-pruvodci/velky/recenze/strana/${MAX_PRERENDERED_REVIEW_PAGES + 1}`);
  });
});
```

V `scripts/sitemap.test.js` přidej:

```js
import { collectSitemapPaths } from './sitemap.mjs';
import { MAX_PRERENDERED_REVIEW_PAGES } from '../src/constants/reviews.ts';

describe('collectSitemapPaths', () => {
  it('obsahuje produkty i jejich routy recenzí včetně dalších stran', () => {
    const paths = collectSitemapPaths([], [{ slug: 'italie', review_count: 25 }]);
    expect(paths).toContain('/cestovni-pruvodci/italie');
    expect(paths).toContain('/cestovni-pruvodci/italie/recenze');
    expect(paths).toContain('/cestovni-pruvodci/italie/recenze/strana/3');
  });
  it('produkt bez recenzí do sitemapy stránku recenzí nedává (nese noindex)', () => {
    const paths = collectSitemapPaths([], [{ slug: 'x', review_count: 0 }]);
    expect(paths).toContain('/cestovni-pruvodci/x');
    expect(paths).not.toContain('/cestovni-pruvodci/x/recenze');
  });
  it('neslibuje strany nad stropem prerenderu', () => {
    const paths = collectSitemapPaths([], [{ slug: 'velky', review_count: 500 }]);
    expect(paths).not.toContain(`/cestovni-pruvodci/velky/recenze/strana/${MAX_PRERENDERED_REVIEW_PAGES + 1}`);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- scripts/prerender.test.js scripts/sitemap.test.js`
Expected: FAIL — routy recenzí se negenerují, `collectSitemapPaths` neexistuje.

- [ ] **Step 3: Rozšiř `contentSlugs.mjs`**

V `scripts/contentSlugs.mjs` nahraď `fetchProductSlugs`:

```js
export function fetchProductSlugs() {
  // `review_count` je potřeba pro routy recenzí (počet stran) — viz prerender.mjs.
  return getJson('products?select=slug,review_count&is_active=eq.true&is_deleted=eq.false');
}
```

- [ ] **Step 4: Rozšiř `prerender.mjs`**

V `scripts/prerender.mjs` přidej k importům (hned za `publicRoutes.ts` na řádku 4):

```js
import { REVIEWS_PAGE_SIZE, MAX_PRERENDERED_REVIEW_PAGES } from '../src/constants/reviews.ts';
```

a nahraď `collectRoutes`:

```js
/**
 * Statické veřejné routy + /inspirace/:slug + /cestovni-pruvodci/:slug
 * + stránky recenzí (bez duplikátů).
 *
 * Routa recenzí se generuje i pro produkt bez recenzí: neprerenderovaná adresa
 * by dostala přes rewrite index.html, a než se stihne uplatnit klientský canonical,
 * je tam ten ze zdroje. Prázdná stránka navíc nese noindex už ve zdrojovém HTML.
 *
 * Hlubší strany mají strop — každá je jedna návštěva headless Chromia navíc
 * a prerender po každých osmi routách browser restartuje. Nad stropem strany
 * dál fungují, jen se nepředgenerují.
 */
export function collectRoutes(blogPosts, productSlugs = []) {
  const blog = (blogPosts || []).map((p) => `/inspirace/${p.slug}`);
  const products = [];
  for (const product of productSlugs || []) {
    products.push(`/cestovni-pruvodci/${product.slug}`);
    products.push(`/cestovni-pruvodci/${product.slug}/recenze`);
    const totalPages = Math.ceil((product.review_count ?? 0) / REVIEWS_PAGE_SIZE);
    const lastPage = Math.min(totalPages, MAX_PRERENDERED_REVIEW_PAGES);
    if (totalPages > MAX_PRERENDERED_REVIEW_PAGES) {
      // Stránkování na stránce odkazy neořezává (jinak by se uživatel na hlubší
      // strany nedostal), takže od téhle chvíle existují crawlovatelné odkazy
      // na strany bez statického HTML. Není to tichá vada — je to signál strop zvednout.
      console.warn(
        `⚠ ${product.slug}: ${totalPages} stran recenzí, prerenderuje se jen ${MAX_PRERENDERED_REVIEW_PAGES}. Zvaž zvýšení MAX_PRERENDERED_REVIEW_PAGES.`,
      );
    }
    for (let page = 2; page <= lastPage; page++) {
      products.push(`/cestovni-pruvodci/${product.slug}/recenze/strana/${page}`);
    }
  }
  return [...new Set([...STATIC_ROUTES, ...blog, ...products])];
}
```

- [ ] **Step 5: Rozšiř `sitemap.mjs`**

V `scripts/sitemap.mjs` přidej k importům (za `publicRoutes.ts` na řádku 3):

```js
import { REVIEWS_PAGE_SIZE, MAX_PRERENDERED_REVIEW_PAGES } from '../src/constants/reviews.ts';
```

a nad `run()` exportovaný helper, který pak použiješ:

```js
/**
 * Cesty do sitemapy. Stránka recenzí se uvádí jen u produktů, které recenzi mají —
 * prázdná nese noindex, a do sitemapy patří jen adresy, které chceme ve výsledcích.
 * Hlubší strany mají stejný strop jako prerender, aby sitemapa neslibovala adresy,
 * které nemají statické HTML.
 */
export function collectSitemapPaths(posts, products) {
  const paths = [
    ...PUBLIC_PAGES.map((p) => p.path),
    ...(posts || []).map((p) => `/inspirace/${p.slug}`),
  ];
  for (const product of products || []) {
    paths.push(`/cestovni-pruvodci/${product.slug}`);
    const count = product.review_count ?? 0;
    if (count === 0) continue;
    paths.push(`/cestovni-pruvodci/${product.slug}/recenze`);
    const totalPages = Math.ceil(count / REVIEWS_PAGE_SIZE);
    const lastPage = Math.min(totalPages, MAX_PRERENDERED_REVIEW_PAGES);
    for (let page = 2; page <= lastPage; page++) {
      paths.push(`/cestovni-pruvodci/${product.slug}/recenze/strana/${page}`);
    }
  }
  return paths;
}
```

A v `run()` nahraď sestavení `paths`:

```js
  const paths = collectSitemapPaths(posts, products);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test:run -- scripts/prerender.test.js scripts/sitemap.test.js`
Expected: PASS.

- [ ] **Step 7: Ověř build s prerenderem naostro**

Prerender vyžaduje proměnné prostředí, které Node skripty čtou z prostředí (Vite si je bere z `.env.local` sám):

```bash
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy
set -a; . .env.local; set +a; npm run build
```

Expected: build projde a v logu jsou řádky `✓ prerendered /cestovni-pruvodci/<slug>/recenze`. Pak ověř obsah:

```bash
grep -c "Recenze —" dist/cestovni-pruvodci/italie-roadtrip/recenze/index.html
grep -o 'rel="canonical" href="[^"]*"' dist/cestovni-pruvodci/italie-roadtrip/recenze/index.html
grep -o '"@type":"Product"' dist/cestovni-pruvodci/italie-roadtrip/recenze/index.html
grep -c '"offers"' dist/cestovni-pruvodci/italie-roadtrip/recenze/index.html
```

Expected: nadpis přítomen; canonical míří na `…/italie-roadtrip/recenze` (ne na homepage a ne na detail); JSON-LD typu `Product`; **žádné `"offers"`** (poslední příkaz vrátí 0).

Hledá se klíč `"offers"` **s uvozovkami**, ne slovo „offers" kdekoli v HTML — to by mohlo přijít i odjinud. `italie-roadtrip` je reálný produkční slug s jednou schválenou recenzí, takže soubor bude existovat; hlubší strany tenhle krok neřeší, na ty je Task 13.

Pozor: `npm run build` spouštěj z adresáře frontendu. Když je pracovní adresář jiný, vite servíruje cizí `dist`.

- [ ] **Step 8: Commit**

```bash
git add scripts/contentSlugs.mjs scripts/prerender.mjs scripts/sitemap.mjs scripts/prerender.test.js scripts/sitemap.test.js
git commit -m "build(seo): prerender the reviews pages and list them in the sitemap

Every active product gets a prerendered reviews route, including products
with no reviews: an unprerendered URL is served the empty index.html shell,
so the heading, the reviews and the noindex on empty pages would all appear
only after JavaScript runs. Deeper pages are derived from review_count,
which fetchProductSlugs now returns, and capped so one product cannot add
fifty headless browser visits to the build."
```

---

### Task 11: Rebuild po změně recenzí + zrušení canonicalu ve zdroji

Bez tohohle tasku je SEO záměr celé práce v produkci nefunkční, a to dvěma způsoby.

**1. Prerenderovaný `noindex` zastarává.** Task 10 předgeneruje stránku recenzí i pro produkt bez recenzí a ta nese `noindex` **ve zdrojovém HTML**. Nic ale nespouští rebuild, když Jana schválí první recenzi: deploy hook má dnes jen `blog_posts` (`trg_blog_publish_deploy`, `baseline.sql:2455`), tabulka `reviews` žádný trigger nemá. Stránka by zůstala neindexovatelná až do dalšího nasazení — a klientsky se to nespraví, protože u `noindex` může Google rendering a vykonání JavaScriptu přeskočit úplně.

**2. Živá stránka odkazuje na strany, které nejsou předgenerované.** `ReviewsPagination` počítá `totalPages` z čerstvého `review_count` ze Supabase, ne z buildu. Jakmile počet schválených recenzí překročí násobek `REVIEWS_PAGE_SIZE`, objeví se v DOMu `<a href>` na stranu, pro kterou statické HTML neexistuje.

**3. Šablona rozesílá canonical homepage na cizí adresy.** `vercel.json` má rewrite `/(.*) → /` a prerender mapuje `/` na `dist/index.html`. Je to tedy **jeden a týž soubor**: prerenderovaná homepage i SPA fallback. Canonical zapsaný v šabloně proto dostane každá neprerenderovaná adresa — a jakmile na ní klientský kód vykreslí `SeoTags`, canonical se přepíše, což Google zakazuje. Dnes se to neprojevuje, protože žádná neprerenderovaná routa `SeoTags` nerenderuje; **stránka recenzí nad stropem prerenderu bude první, která ano.**

Řešíme to **rozdělením skořápky** (rozhodnutí uživatele 2026-08-07): rewrite povede na vlastní soubor bez canonicalu, homepage si canonical vykreslí sama. Obě role se tím oddělí natrvalo a pro všechny routy, ne jen pro recenze. Google tenhle vzorec výslovně předepisuje: *„If you can't set the canonical URL in the HTML source code, leave it out and only set it with JavaScript."*

**Files:**
- Create: `supabase/migrations/<timestamp>_add_reviews_deploy_hook.sql`
- Modify: `supabase/tests/database/04_reviews.test.sql` (`plan(39)` → `plan(41)` + 2 aserce do bloku „── Struktura ──")
- Modify: `index.html:6-17` — celý blok meta homepage, ne jen canonical **[4. kolo]**
- Modify: `src/pages/Home.tsx`
- Modify: `vercel.json` — rewrite `destination` **a** nová hlavička `X-Robots-Tag` pro `/app-shell` **[4. kolo]**
- Modify: `scripts/prerender.mjs` (odložení skořápky)
- Create: `src/utils/sourceCanonical.test.ts`

**Interfaces:**
- Consumes: nic
- Produces: trigger `trg_reviews_deploy_hook` na `public.reviews`

- [ ] **Step 1: Write the failing tests**

Do `supabase/tests/database/04_reviews.test.sql` přidej dvě aserce. **Patří do bloku „── Struktura ──" (řádky 5-8), ne na konec souboru** — na řádku 212 je `finish()` a na 213 `ROLLBACK;`, takže aserce připojené za ně by se nevykonaly a pgTAP by hlásil „planned 41 but ran 39". Zároveň zvyš `plan(39)` na řádku 2 na **`plan(41)`**:

```sql
select has_function('public'::name, 'notify_vercel_reviews_change'::name, 'deploy-hook funkce pro recenze existuje');
select has_trigger('public'::name, 'reviews'::name, 'trg_reviews_deploy_hook'::name, 'reviews mají deploy-hook trigger');
```

A vytvoř `src/utils/sourceCanonical.test.ts` — strážce proti návratu meta homepage do šablony:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('rozdělení skořápky a homepage', () => {
  const template = () => readFileSync('index.html', 'utf8');

  it('index.html nenese natvrdo zapsanou meta homepage', () => {
    // Google: „make sure that JavaScript doesn't change the canonical link element.
    // If you can't set the canonical URL in the HTML source code, leave it out and
    // only set it with JavaScript." Šablona slouží i jako SPA skořápka, takže
    // cokoli v ní dostane každá neprerenderovaná adresa — a klientský kód by to
    // pak přepisoval, což je přesně ten zakázaný vzorec.
    expect(template()).not.toMatch(/rel="canonical"/);
    expect(template()).not.toMatch(/<title>/);
    expect(template()).not.toMatch(/name="description"/);
    expect(template()).not.toMatch(/property="og:/);
    expect(template()).not.toMatch(/name="twitter:/);
  });

  it('homepage si meta vykresluje sama', () => {
    // Když ji sebereme šabloně, musí ji někdo dodat — jinak nejdůležitější
    // stránka webu zůstane bez titulku i bez canonicalu úplně.
    const home = readFileSync('src/pages/Home.tsx', 'utf8');
    expect(home).toMatch(/rel="canonical"/);
    expect(home).toMatch(/<title>/);
    expect(home).toMatch(/name="description"/);
    expect(home).toMatch(/property="og:url"/);
  });

  it('rewrite míří na skořápku, ne na homepage', () => {
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
    expect(vercel.rewrites).toEqual([{ source: '/(.*)', destination: '/app-shell' }]);
  });

  it('skořápka je vyloučená z indexu hlavičkou, ne až robots.txt', () => {
    // `Disallow` v robots.txt nestačí: „a page that's disallowed in robots.txt can
    // still be indexed if linked to from other sites." Hlavička scoped na /app-shell
    // se díky pořadí routingu na Vercelu (Headers → File System → Rewrites) uplatní
    // jen na přímý požadavek, ne na adresy, které na skořápku spadnou rewritem.
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
    const shellRule = vercel.headers.find((h: { source: string }) => h.source === '/app-shell');
    expect(shellRule?.headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy
npm run test:run -- src/utils/sourceCanonical.test.ts
```
Expected: FAIL — `index.html` canonical zatím obsahuje.

```bash
open -a Docker            # bez běžícího Dockeru padne `supabase start` i `db reset`
supabase start
supabase db reset && supabase test db
```
Expected: FAIL na obou nových ascercích — funkce ani trigger neexistují.

Pozor na hranici toho, co pgTAP ověří: **lokální `vault.secrets` je prázdný**, takže `hook_url is null` a větev s `net.http_post` se nikdy nevykoná. Zelená sada dokazuje existenci funkce a triggeru, **ne** že deploy hook opravdu odejde. To se ověří až v Tasku 13.

- [ ] **Step 3: Napiš migraci**

```bash
supabase migration new add_reviews_deploy_hook
```

Do vzniklého souboru:

```sql
-- Rebuild the static output when the set of approved reviews changes.
--
-- Reviews pages are prerendered: a product with no approved reviews ships a
-- noindex in its source HTML, and the number of paginated pages is baked in at
-- build time. Both go stale the moment a review is approved or removed, and a
-- stale noindex cannot be undone client-side because Google may skip rendering
-- entirely when it sees one. Mirrors trg_blog_publish_deploy on blog_posts.
create or replace function "public"."notify_vercel_reviews_change"() returns "trigger"
    language "plpgsql" security definer
    set "search_path" to ''
    as $$
declare
  hook_url text;
  is_relevant boolean;
begin
  -- Only approved rows are public, so only transitions into or out of
  -- 'approved' can change what the prerendered pages contain.
  -- `is distinct from` je nutné: `UPDATE OF status` firuje, kdykoli je sloupec
  -- v SET listu, i když se hodnota nemění. Admin formulář (ReviewEdit transform)
  -- posílá `status` při KAŽDÉM uložení, takže bez téhle podmínky by i pouhá
  -- úprava interní poznámky spustila produkční build.
  is_relevant :=
       (TG_OP = 'INSERT' and NEW.status = 'approved')
    or (TG_OP = 'UPDATE' and OLD.status is distinct from NEW.status
        and (NEW.status = 'approved' or OLD.status = 'approved'))
    or (TG_OP = 'DELETE' and OLD.status = 'approved');
  if not is_relevant then
    return coalesce(NEW, OLD);
  end if;

  select decrypted_secret into hook_url
  from vault.decrypted_secrets
  where name = 'vercel_deploy_hook';

  if hook_url is not null then
    perform net.http_post(
      url := hook_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  end if;

  return coalesce(NEW, OLD);
end;
$$;

alter function "public"."notify_vercel_reviews_change"() owner to "postgres";
revoke all on function "public"."notify_vercel_reviews_change"() from public, "anon", "authenticated";
grant all on function "public"."notify_vercel_reviews_change"() to "service_role";

-- Pozn. k pořadí: PostgreSQL spouští AFTER triggery na téže tabulce abecedně, takže
-- trg_reviews_deploy_hook jde PŘED trg_reviews_refresh_product_rating a v okamžiku
-- jeho běhu je products.review_count ještě neaktualizovaný. Nevadí to: net.http_post
-- request jen zařadí do fronty a odesílá se až po commitu, kdy je agregát hotový.
create trigger "trg_reviews_deploy_hook"
  after insert or delete or update of "status" on "public"."reviews"
  for each row execute function "public"."notify_vercel_reviews_change"();
```

Ověřeno spuštěním nad lokálním PostgreSQL 17.6 (produkce má 17.6.1.037, tedy tutéž major verzi),
že jeden booleovský výraz sahající na `OLD` i `NEW` je bezpečný ve všech třech operacích: `OLD` je
v INSERT triggeru **null-record**, ne nepřiřazený record, takže `OLD.status` vrátí `NULL` a nic
nespadne. Prošly všechny scénáře — INSERT jako `pending` i rovnou `approved`, UPDATE se změnou
statusu, UPDATE se statusem v SET listu bez změny hodnoty (správně nespustí build), UPDATE bez
statusu (trigger vůbec nefiruje) i DELETE.

Pojmenování drží `supabase/CONVENTIONS.md`: trigger `trg_<tab>_<purpose>`, funkce `snake_case` verb_noun, povinné `set search_path = ''` a plně kvalifikované reference. Všechno tohle mechanicky vynucuje pgTAP guard `00_naming_conventions.test.sql`.

`CONVENTIONS.md` žádá regenerovat typy při každé změně schématu (`npm run gen:types`). Tady je to no-op — funkce vracející `trigger` se do generovaných typů neemituje — ale spusť to a commitni případný diff, ať konvence platí bez výjimek.

- [ ] **Step 4: Rozděl skořápku od homepage**

Čtyři soubory, každý jeden krok. Pořadí nezáleží, ale musí být hotové všechny — po samotném vyprázdnění šablony by homepage zůstala bez meta úplně (`Home.tsx` má 15 řádků a `SeoTags` **nerenderuje**, viz komentář v `src/constants/publicRoutes.ts:8-9`).

**Nestěhuje se jen canonical [4. kolo].** Argument „jeden canonical nemůže být správný pro
prerenderovanou homepage i pro SPA skořápku" platí úplně stejně pro `title`, `description`
a `og:*`. Kdyby v šabloně zůstaly, nesla by je dál každá neprerenderovaná adresa — a `keepLast()`
v `prerender.mjs:96-98` ošetřuje `meta[name]`, `meta[property]` a `link[rel=canonical]`, ale
`<title>` **ne**, takže by v HTML zůstaly dva. Stěhuje se proto celý blok.

**1.** V `index.html` smaž **řádky 6-17** — celý blok meta homepage od `<title>` po `canonical`:

```html
    <title>Cesty (bez) mapy - Cestovní itineráře a inspirace na cesty</title>
    <meta name="description" content="Místo, kde najdeš inspiraci, itineráře i tipy na místa, která se do běžných průvodců nevešla. Přidej se a nech se vést světem." />
    <meta property="og:title" content="Cesty (bez) mapy - Cestovní itineráře a inspirace na cesty" />
    <meta property="og:description" content="Místo, kde najdeš inspiraci, itineráře i tipy na místa, která se do běžných průvodců nevešla. Přidej se a nech se vést světem." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://www.cestybezmapy.cz/" />
    <meta property="og:image" content="https://www.cestybezmapy.cz/images/logo.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Cesty (bez) mapy - Cestovní itineráře a inspirace na cesty" />
    <meta name="twitter:description" content="Místo, kde najdeš inspiraci, itineráře i tipy na místa, která se do běžných průvodců nevešla." />
    <meta name="twitter:image" content="https://www.cestybezmapy.cz/images/logo.png" />
    <link rel="canonical" href="https://www.cestybezmapy.cz/" />
```

V `<head>` zůstane jen `charset`, `viewport`, `icon` a `apple-touch-icon` — tedy věci, které
platí pro každou adresu stejně.

**2.** V `src/pages/Home.tsx` doplň meta, kterou šabloně bereme. React 19 značky zvedne do `<head>` — ověřeno spuštěním nad nainstalovanou 19.2.6 — takže se dostanou i do prerenderovaného `dist/index.html`. **Tohle je celý obsah souboru**, včetně `displayName` a `export default`, které dnes na konci má:

```tsx
import { SITE_URL } from '../utils/blogSeo';
import Navigation from '../components/layout/Navigation';
import Hero from '../components/common/Hero';

const TITLE = 'Cesty (bez) mapy - Cestovní itineráře a inspirace na cesty';
const DESCRIPTION =
  'Místo, kde najdeš inspiraci, itineráře i tipy na místa, která se do běžných průvodců nevešla. Přidej se a nech se vést světem.';

const Home = () => {
  return (
    <div className="min-h-screen bg-white" data-prerender-ready="true">
      {/* Meta homepage patří sem, ne do index.html: ta šablona slouží i jako SPA
          skořápka, takže by ji dostala každá adresa, která projde rewritem.
          React 19 tyhle značky zvedne do <head> sám.

          Home schválně nepoužívá SeoTags — ta komponenta staví na per-route meta
          objektu (`ProductMeta` a spol.), zatímco homepage má vlastní ručně psané
          texty a žádný takový objekt pro ni neexistuje. */}
      <title>{TITLE}</title>
      <meta name="description" content={DESCRIPTION} />
      <meta property="og:title" content={TITLE} />
      <meta property="og:description" content={DESCRIPTION} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={`${SITE_URL}/`} />
      <meta property="og:image" content={`${SITE_URL}/images/logo.png`} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={TITLE} />
      <meta
        name="twitter:description"
        content="Místo, kde najdeš inspiraci, itineráře i tipy na místa, která se do běžných průvodců nevešla."
      />
      <meta name="twitter:image" content={`${SITE_URL}/images/logo.png`} />
      <link rel="canonical" href={`${SITE_URL}/`} />
      <Navigation />
      <Hero />
    </div>
  );
};

Home.displayName = 'Home';

export default Home;
```

**3.** Ve `vercel.json` přesměruj rewrite na samostatnou skořápku:

```json
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/app-shell"
    }
  ],
```

Tvar bez přípony je správně: Vercel dokumentuje, že „if `cleanUrls` is set to `true`, do not
include the file extension in the source or destination path".

A do pole `headers` přidej **jako první položku**, před stávající blok pro `/(.*)`:

```json
    {
      "source": "/app-shell",
      "headers": [{ "key": "X-Robots-Tag", "value": "noindex" }]
    },
```

Proč hlavička, a ne až `Disallow` v `robots.txt` při launchi (rozhodnutí uživatele 2026-08-18):
`/app-shell` je veřejná adresa vracející 200 a prázdnou stránku. Google k `robots.txt` výslovně
píše, že *„a page that's disallowed in robots.txt can still be indexed if linked to from other
sites"* a jako správné řešení uvádí právě `noindex`. Hlavička navíc funguje okamžitě a nespoléhá
na to, že si na ni někdo při launchi vzpomene. Scoping je bezpečný: Vercel zpracovává **Headers
před** File System Routes i Rewrites, takže se pravidlo uplatní jen na přímý požadavek na
`/app-shell`, ne na adresy, které na skořápku teprve spadnou rewritem.

**4.** V `scripts/prerender.mjs` ulož čistou skořápku **dřív**, než ji prerender homepage přepíše. Na začátek `run()`, před smyčku přes routy:

```js
  // `/` se prerenderuje do dist/index.html, takže by se skořápka jinak ztratila.
  // Odkládáme ji stranou, aby rewrite `/(.*) → /app-shell` servíroval HTML BEZ
  // meta homepage — klientský kód si ji pak smí nastavit sám.
  //
  // `DIST`, ne `distDir`: `distDir` je jen název parametru `outputPathForRoute`
  // a ve `run()` neexistuje. (Doslovná kopie s `distDir` shodí build na
  // ReferenceError — ověřeno spuštěním.)
  //
  // Titulek doplňujeme, protože ho šablona po Step 4.1 už nemá: bez něj by
  // prohlížeč na neprerenderovaných adresách ukazoval v záložce holou URL,
  // dokud nedoběhne React.
  const template = await fs.readFile(path.posix.join(DIST, 'index.html'), 'utf8');
  if (template.includes('rel="canonical"')) {
    // V tuhle chvíli má být dist/index.html čerstvý výstup `vite build`, tedy bez
    // canonicalu. Když ho obsahuje, běží prerender nad UŽ prerenderovanou homepage
    // (typicky opakované `npm run build:novite`, které samo `vite build` nespouští)
    // a do skořápky by se uložila homepage — přesně stav, který tenhle krok ruší.
    throw new Error(
      'dist/index.html už je prerenderovaný — spusť `vite build` před prerenderem, jinak by app-shell.html dostal meta homepage.',
    );
  }
  const shell = template.replace('</head>', '  <title>Cesty (bez) mapy</title>\n  </head>');
  await fs.writeFile(path.posix.join(DIST, 'app-shell.html'), shell);
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test:run && npm run type-check
supabase db reset && supabase test db
```
Expected: PASS. Plnou sadu spouštíme proto, že `index.html` je sdílená šablona všech rout.
`supabase test db` musí projít **celý**, včetně naming guardu — kdyby si stěžoval na `search_path` nebo prefix triggeru, je chyba v migraci, ne v guardu.

- [ ] **Step 6: Ověř rozdělení nad reálným buildem**

```bash
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy
set -a; . .env.local; set +a; npm run build
echo "-- homepage canonical --"; grep -c 'rel="canonical"' dist/index.html
echo "-- homepage cíl       --"; grep -o 'rel="canonical" href="[^"]*"' dist/index.html
echo "-- homepage title     --"; grep -c '<title>' dist/index.html
echo "-- homepage og:url    --"; grep -c 'property="og:url"' dist/index.html
echo "-- skořápka canonical --"; grep -c 'rel="canonical"' dist/app-shell.html
echo "-- skořápka og        --"; grep -c 'property="og:' dist/app-shell.html
echo "-- skořápka title     --"; grep -c '<title>' dist/app-shell.html
echo "-- produkt            --"; grep -o 'rel="canonical" href="[^"]*"' dist/cestovni-pruvodci/*/index.html | head -3
```

Expected:
- `dist/index.html` — **právě jeden** canonical na `https://www.cestybezmapy.cz/`, **právě jeden** `<title>` a **jeden** `og:url`. Víc než jeden je problém: React 19 meta/link per routu nededuplikuje, a `keepLast()` v `prerender.mjs` sice `meta` a `canonical` uklidí, ale `<title>` **ne**. Dvojka u titulku znamená, že v `index.html` zůstal ten původní.
- `dist/app-shell.html` — canonical **0**, `og:` **0**, `<title>` **1** (ten neutrální, který skript dopisuje).
- detail produktu — jeden canonical na sebe sama, beze změny.

Ověření, že rewrite skořápku opravdu servíruje, patří až na preview deploy (Task 13 Step 6) — lokálně to nejde, `vercel.json` se v `vite preview` neuplatňuje.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations index.html src/pages/Home.tsx vercel.json scripts/prerender.mjs src/utils/sourceCanonical.test.ts supabase/tests/database/04_reviews.test.sql
git commit -m "fix(seo): rebuild on review changes, split the SPA shell from the homepage

Reviews pages are prerendered, so a product with no approved reviews ships a
noindex in its source HTML and the page count is baked in at build time. Both
went stale as soon as a review was approved, and nothing triggered a rebuild:
only blog_posts had a deploy hook. A stale noindex is not recoverable
client-side either, because Google may skip rendering when it sees one.

index.html was doing two jobs at once: the prerendered homepage and the SPA
shell every rewritten URL falls back to. One canonical cannot be right for
both, so the shell now lives in its own file carrying none at all, which is
exactly the arrangement Google's guidance asks for when the source cannot
hold the right value. The homepage renders its own instead."
```

**Nasazení migrace na produkci není součástí tohohle tasku** — děje se až v Tasku 13 a jen s výslovným svolením.

---

### Task 12: Repo-wide oprava vnořeného `<main>`

`Layout.tsx:86` renderuje `<main id="main-content">`. Uvnitř něj vzniká **osmnáct** druhých hlavních oblastí, ve dvou různých podobách:

- **16 stránek** renderuje vlastní `<main>` (18 elementů — `OrderConfirmation` má tři návratové větve),
- **2 stránky** (`MyStory`, `Collaboration`) renderují `<section role="main">`, což je pro čtečku totéž. Grep na `<main` je nenajde, takže se na ně snadno zapomene — a ověřeno spuštěním, obě dnes hlásí dva `main` landmarky.

WHATWG to zakazuje dvakrát: hierarchická korektnost i „a document must not have more than one main element that does not have the hidden attribute". Prakticky: čtečka nabídne dvě „hlavní oblasti" a skip-link `href="#main-content"` míří na ten vnější, takže uživatele vysadí nad obsahem stránky.

Task 8 tuhle chybu u nové stránky nezavádí; tenhle task uklidí zbytek.

**Files:**
- Modify: `src/pages/ReviewSubmit.tsx:170`, `Stahnout.tsx:109`, `SalzburgItinerary.tsx:127`, `TravelInspiration.tsx:123`, `Checkout.tsx:202`, `Contact.tsx:174`, `OrderConfirmation.tsx:146,164,427`, `CustomItineraryPreview.tsx:254`, `Privacy.tsx:12`, `BlogPostDetail.tsx:133`, `CustomItineraryDetail.tsx:100`, `CustomItineraryForm.tsx:1165`, `TravelGuides.tsx:618`, `Reviews.tsx:36`, `ProductDetail.tsx:340`, `FAQ.tsx:209`
- Modify: `src/pages/MyStory.tsx:28`, `src/pages/Collaboration.tsx:169` — jen smazat řádek `role="main"`; `aria-labelledby` zůstává, takže `<section>` je dál pojmenovaný landmark `region`
- Modify: `src/pages/FAQ.test.tsx:7-10,18-21` (řádek 6 je prázdný)
- Create: `src/pages/layoutLandmarks.test.ts`

Čísla řádků platí k výchozímu stavu. `ProductDetail.tsx` se posune, protože ho mění Task 9 — hledej podle tagu, ne podle čísla.

**Interfaces:**
- Consumes: nic
- Produces: nic — čistě strukturální oprava

- [ ] **Step 1: Write the failing test**

Vytvoř `src/pages/layoutLandmarks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

describe('orientační body stránek', () => {
  it('žádná stránka nerenderuje vlastní <main> — Layout ho už má', () => {
    // Layout.tsx renderuje <main id="main-content">. Druhý <main> uvnitř něj je
    // nevalidní HTML, dá čtečce dvě „hlavní oblasti" a skip-link pak míří nad obsah.
    // Hledáme obě podoby: `<main>` i `role="main"` na jiném prvku. Samotné
    // `includes('<main')` by minulo `<section role="main">` v MyStory a Collaboration.
    const offenders = readdirSync('src/pages')
      .filter((file) => file.endsWith('.tsx') && !file.includes('.test.'))
      .filter((file) => /<main|role=["']main["']/.test(readFileSync(`src/pages/${file}`, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/pages/layoutLandmarks.test.ts`
Expected: FAIL — vypíše seznam **18** souborů (16 s `<main>`, 2 s `role="main"`).

Kdyby jich bylo 19 a navíc byl v seznamu `ProductReviewsPage.tsx`, znamená to, že v něm zůstal z Tasku 8 komentář s doslovným zápisem toho tagu. Ta stránka žádnou druhou hlavní oblast nerenderuje — hledej v komentáři, ne v JSX **[4. kolo]**.

- [ ] **Step 3: Nahraď `<main>` v každé stránce**

Ve všech souborech ze seznamu nahraď otevírací `<main …>` za `<div …>` a odpovídající `</main>` za `</div>`. Zároveň **zahoď `role="main"`** (na `<div>` by z něj byl znovu druhý orientační bod, a na `<main>` byl stejně redundantní). Třídy zůstávají beze změny.

Tři soubory potřebují víc než záměnu tagu:

1. **`BlogPostDetail.tsx:133`** má na `<main>` atribut `data-prerender-ready="true"`. Ten **musí zůstat** na náhradním `<div>`, jinak prerender u článků vyprší na `waitForSelector` a build spadne.
2. **`TravelGuides.tsx:618`** a **`TravelInspiration.tsx:123`** mají `aria-label`. Na `<div>` by pojmenování zmizelo do prázdna, protože `div` žádnou roli nemá. Použij `<section aria-label="…">` — pojmenovaná `section` je landmark `region`, takže popisek zůstane funkční:

```tsx
<section className="py-16 px-5 max-w-7xl mx-auto" aria-label="Seznam cestovních průvodců" style={{ overflowAnchor: 'none' }}>
```

3. **`OrderConfirmation.tsx`** má tři výskyty (řádky 146, 164, 427) ve třech samostatných komponentách — projdi všechny.

A dva soubory **nemají `<main>` vůbec**, jen `role="main"` na `<section>`: `MyStory.tsx:28` a `Collaboration.tsx:169`. Tam smaž pouze ten jeden atribut a nech `<section aria-labelledby=…>` být.

- [ ] **Step 4: Srovnej `FAQ.test.tsx` s novou skutečností**

**Aserce testu se nemění a prošly by i beze změny** — `screen.getAllByRole('main')` vrátí nově
jediný prvek a `mains[mains.length - 1]` je právě on. Co se mění, jsou dva komentáře, které po
opravě lžou, a teď už zbytečné braní „posledního z několika". Obojí jsou doslovné náhrady.

Nejdřív komentář nad `describe` (řádky 7-10) — z:

```tsx
// FAQ je obalený Layoutem, který renderuje Navigation -> CartButton (potřebuje CartProvider).
// Dotazujeme se jen v rámci <main role="main">, protože Navigation obsahuje vlastní
// mobile-menu-button s aria-controls (jiný a11y pattern, inert místo hidden) — bez scope
// by .find() vždy vrátil tlačítko mobilního menu, ne FAQ accordion.
```

na:

```tsx
// FAQ je obalený Layoutem, který renderuje Navigation -> CartButton (potřebuje CartProvider).
// Dotazujeme se jen v rámci hlavní oblasti, kterou renderuje Layout, protože Navigation
// obsahuje vlastní mobile-menu-button s aria-controls (jiný a11y pattern, inert místo
// hidden) — bez scope by .find() vždy vrátil tlačítko mobilního menu, ne FAQ accordion.
```

Pak uvnitř testu (řádky 18-21) — z:

```tsx
    // Layout renderuje vlastní <main id="main-content"> a FAQ uvnitř něj svůj <main role="main">
    // (nested) — vezmeme ten vnitřní/poslední, abychom nezachytili Navigation mimo něj.
    const mains = screen.getAllByRole('main');
    const main = mains[mains.length - 1];
```

na:

```tsx
    // Layout renderuje jedinou hlavní oblast (id="main-content") a Navigation je mimo ni.
    // Dřív jich bylo víc, protože FAQ renderovalo vlastní — proto se tu braly všechny
    // a používala se poslední.
    const main = screen.getByRole('main');
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test:run && npm run type-check && npm run lint
```
Expected: PASS. Kdyby padal `FAQ.test.tsx`, znamená to, že v některé stránce zůstal druhý `main`.

- [ ] **Step 6: Ověř prerender článků**

```bash
set -a; . .env.local; set +a; npm run build
```
Expected: build projde. Kdyby vypršel na routě `/inspirace/<slug>`, spadl `data-prerender-ready` z `BlogPostDetail`.

- [ ] **Step 7: Commit**

```bash
git add src/pages
git commit -m "fix(a11y): stop pages nesting a second main landmark

Layout already renders <main id=\"main-content\">, and eighteen pages put a
second one inside it: sixteen with their own <main>, two with role=\"main\" on
a section, which a grep for the tag alone would miss. That is two main
landmarks in one document, which the spec forbids, and it made the skip-link
land above the page content rather than at it. Pages that carried an
aria-label become labelled sections so the name still has a role to attach
to."
```

---

### Task 13: Ověření celku

**Files:** žádné změny — jen ověření.

**Předpoklad: testovací data [4. kolo].** Většina kroků níž je nad produkční databází, jak
vypadá dnes, **neproveditelná** — jediný produkt s recenzí (`italie-roadtrip`) má recenzi jednu,
takže `collectRoutes` vyrobí `ceil(1/10) = 1` stranu, `/recenze/strana/2` vůbec nevznikne
a `ReviewsPagination` se při `totalPages <= 1` nevykreslí. Padlo by tím ověření hloubky cest,
stránkování i změřená výška sekce.

Před spuštěním tasku proto musí existovat:

| Role | Slug | Podmínka |
|---|---|---|
| Produkt s víc stranami | `test-toskansko` | **≥ 11 schválených** recenzí (2 strany) |
| Produkt bez recenzí | `test-korsika` | 0 schválených recenzí, `is_active = true` |

Obojí naseeduje uživatel (resp. Claude na jeho pokyn) **mimo tenhle plán**, protože jde o zápis
do produkční databáze. Oba slugy jsou existující testovací produkty určené ke smazání před
spuštěním webu — nezanáší se tím recenze k reálnému produktu. Kdyby se slugy lišily, uprav si
proměnné `SLUG` a `EMPTY` níž, ale **nenechávej v příkazech zástupné symboly**: `SLUG=<něco>`
je v bashi přesměrování a skončí syntaktickou chybou.

- [ ] **Step 1: Celá sada testů, typy, lint**

```bash
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy
npm run test:run && npm run type-check && npm run lint
```

Expected: vše PASS.

- [ ] **Step 2: Build s prerenderem a kontrola vygenerovaného HTML**

Prerender vyžaduje proměnné prostředí v prostředí (Vite si je bere z `.env.local` sám, Node skripty ne). Pracovní adresář **musí** být adresář frontendu — jinak vite servíruje `dist` druhého repa a stránka jen visí na `Loading…`:

```bash
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy
set -a; . .env.local; set +a; npm run build
```

Pak nad výstupem produktu, který recenzi má:

```bash
SLUG='test-toskansko'
grep -c "Recenze —" "dist/cestovni-pruvodci/$SLUG/recenze/index.html"
grep -o 'rel="canonical" href="[^"]*"' "dist/cestovni-pruvodci/$SLUG/recenze/index.html"
grep -c '"offers"' "dist/cestovni-pruvodci/$SLUG/recenze/index.html"
grep -o '"ratingValue":"[^"]*"' "dist/cestovni-pruvodci/$SLUG/recenze/index.html"
grep -c 'name="robots"' "dist/cestovni-pruvodci/$SLUG/recenze/index.html"
grep -o '"@id":"[^"]*"' "dist/cestovni-pruvodci/$SLUG/recenze/index.html"
# druhá strana musí existovat jako vlastní soubor
test -f "dist/cestovni-pruvodci/$SLUG/recenze/strana/2/index.html" && echo "strana 2 OK"
grep -o 'rel="canonical" href="[^"]*"' "dist/cestovni-pruvodci/$SLUG/recenze/strana/2/index.html"
```

Expected: nadpis přítomen; **právě jeden** canonical mířící na `…/$SLUG/recenze`; **žádné**
`"offers"` (0); `ratingValue` s jedním desetinným místem a shodné s číslem v souhrnu na stránce;
**žádný** `robots` (0); `@id` mířící na **detail** produktu (`…/cestovni-pruvodci/$SLUG#product`),
tedy shodné s uzlem na detailu; soubor strany 2 existuje a jeho canonical míří **sám na sebe**,
ne na stranu 1.

Pozor na `grep -c '"offers"'` s uvozovkami uvnitř: hledáme klíč v JSON-LD, ne slovo kdekoli
v HTML.

A nad produktem **bez** recenzí:

```bash
EMPTY='test-korsika'
grep -o 'name="robots" content="[^"]*"' "dist/cestovni-pruvodci/$EMPTY/recenze/index.html"
grep -c '"@type":"Product"' "dist/cestovni-pruvodci/$EMPTY/recenze/index.html"
grep -c '"@type":"Organization"' "dist/cestovni-pruvodci/$EMPTY/recenze/index.html"
grep -c "$EMPTY/recenze" dist/sitemap.xml
```

Expected: `noindex`; **žádný** `Product` uzel (0) — `Product` bez `review`/`aggregateRating`/`offers`
je neplatný; **jeden** `Organization` uzel (1); a **žádný** výskyt v sitemapě (0).

**Nekontroluj `grep -c 'application/ld+json'` a nečekej nulu [4. kolo].** `Footer.tsx:251` vydává
`Organization` JSON-LD na **každé** stránce webu, takže by ten příkaz vrátil 1 vždycky a vypadalo
by to jako chyba implementace. Testuje se nepřítomnost `Product` uzlu, ne nepřítomnost JSON-LD
jako takového.

- [ ] **Step 3: Změř dopad na výšku sekce**

Ověř slibované číslo v prohlížeči nad produkčním buildem. Ulož si skript do adresáře pro dočasné soubory (ne do repa) a spusť ho **z adresáře frontendu**:

```js
// measure.mjs
const ROOT = '/Users/janparma/Desktop/Projekty/cesty-bez-mapy';
const { preview } = await import(`${ROOT}/node_modules/vite/dist/node/index.js`);
const { chromium } = await import(`${ROOT}/node_modules/playwright/index.mjs`);
const server = await preview({ appType: 'spa', preview: { port: 4187, strictPort: false, open: false } });
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch();
for (const [label, viewport] of [['mobil', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 900 }]]) {
  const page = await browser.newPage({ viewport });
  await page.goto(`${base}/cestovni-pruvodci/test-toskansko`, { waitUntil: 'load' });
  await page.waitForSelector('section[aria-label="Recenze produktu"]');
  const height = await page.evaluate(() =>
    Math.round(document.querySelector('section[aria-label="Recenze produktu"]').getBoundingClientRect().height));
  console.log(label, height);
  await page.close();
}
await browser.close();
await server.close();
```

Expected: se třemi a víc recenzemi (což `test-toskansko` po naseedování má) vyjde na mobilu ~1 341 px a na desktopu ~615 px, protože tři karty vyplní jeden řádek beze zbytku. Výchozím stavem pro porovnání je **dnešních 2 430 px na mobilu** při šesti kartách. U produktu s jedinou recenzí by sekce měřila kolem 615 px na obou a číslo by nic nedokazovalo — proto se měří nad naseedovaným produktem **[4. kolo]**.

- [ ] **Step 4: Projdi stránku očima**

Otevři `/cestovni-pruvodci/test-toskansko/recenze` a zkontroluj: nadpis, souhrn hodnocení **bez** odkazu, **perex produktu a náhledový obrázek** (musí tam být — JSON-LD je posílá), disclosure, plný text recenze bez ořezu, datum s dnem, odkaz zpět na průvodce. Vlož do recenze v testovacích datech dlouhou URL bez mezer a ověř, že se zalomí a nezmizí za okrajem karty.

Fokus — čtyři situace, každá jiná **[4. kolo]**:

1. **Příchod z detailu produktu** (klik na souhrn hodnocení): fokus **nesmí** skočit na nadpis. Byl by to `PUSH`, ale je to první render — guard na `isFirstRender` to má chytit.
2. **Přepnutí strany** klikem ve stránkování: fokus **skončí na nadpisu** a prstenec je **vidět**. Zkontroluj to i **myší**, nejen klávesnicí — proto se používá `focus:ring`, ne `focus-visible:ring`.
3. **Přímý vstup** na `/…/recenze/strana/2` z adresního řádku: fokus **nikam neskočí**.
4. **Přesměrování** z `/…/recenze/strana/99`: skončíš na poslední platné straně a fokus **nikam neskočí**.

Pozor na Safari: `Tab` na odkazy nesahá, dokud není v systému zapnutý „Full Keyboard Access" (macOS ho má ve výchozím stavu vypnutý). Klávesovou část ověř v Chrome, nebo si to nastavení zapni — jinak to vypadá jako chyba stránky.

Na detailu produktu zkontroluj souhrn pod nadpisem jako odkaz a tři karty vedle sebe na desktopu.

- [ ] **Step 5: Rich Results Test ručně**

Nemá veřejné API, takže tenhle krok nejde zautomatizovat. Vezmi vyrenderované HTML stránky recenzí, vlož ho do <https://search.google.com/test/rich-results> (záložka „Code") a potvrď, že `Product` bez `offers` projde. `offers` se smí objevit jako **doporučení**, ne jako chyba — v tabulce vlastností je vedené jako Recommended.

- [ ] **Step 6: Smoke na Vercel preview — hloubka cest**

**Tenhle krok nejde přeskočit** a ověřuje dvě nové věci naráz.

*(a) Hloubka cest.* Vercel dokumentace potvrzuje, že se filesystem uplatní před rewrity („precedence is given to the filesystem prior to rewrites being applied"), ale o adresářových indexech u `cleanUrls` **mlčí na jakékoli hloubce**. V tomhle projektu je mechanismus prokázaný jen do hloubky 2 (`/cestovni-pruvodci/:slug`); stránka recenzí je hloubka 3 a `…/recenze/strana/2/index.html` dokonce **5**.

*(b) Rozdělená skořápka.* Změna `destination` ve `vercel.json` se lokálně ověřit nedá — `vite preview` konfiguraci Vercelu neuplatňuje.

**Tenhle krok NEPROVÁDÍ implementující subagent [4. kolo].** Nemá přístup k nasazení ani
k přihlašovacím údajům. Preview nasazuje a smoke provádí orchestrátor (Claude v hlavní session)
přes Vercel CLI; uživatel rozhodl 2026-08-18. Subagent tenhle krok jen nahlásí jako čekající.

Nasaď preview a ověř, že se servíruje prerenderovaný soubor, ne SPA skořápka:

```bash
PREVIEW='https://<url z vercel deploy>'
AUTH='<uživatel:heslo pro předlaunchový Basic auth>'
SLUG='test-toskansko'

curl -sS -u "$AUTH" "$PREVIEW/cestovni-pruvodci/$SLUG/recenze" | grep -c "Recenze —"
curl -sS -u "$AUTH" "$PREVIEW/cestovni-pruvodci/$SLUG/recenze/strana/2" | grep -c "Recenze —"
```

Expected: obojí ≥ 1. Kdyby vyšla 0, dostáváš skořápku přes rewrite a prerender se neuplatňuje — zastav se a řeš to, celý SEO přínos stojí na tomhle. Druhý příkaz je hloubka **5** a je jediný způsob, jak ji ověřit; proto musí mít `$SLUG` aspoň 11 schválených recenzí.

Pak ověř samotné rozdělení skořápky:

```bash
# neexistující adresa musí spadnout na skořápku BEZ meta homepage
curl -sS -u "$AUTH" "$PREVIEW/tahle-adresa-neexistuje" | grep -c 'rel="canonical"'
curl -sS -u "$AUTH" "$PREVIEW/tahle-adresa-neexistuje" | grep -c 'property="og:'
# homepage naopak canonical i og mít musí
curl -sS -u "$AUTH" "$PREVIEW/" | grep -o 'rel="canonical" href="[^"]*"'
curl -sS -u "$AUTH" "$PREVIEW/" | grep -c 'property="og:url"'
# skořápka sama musí nést noindex hlavičku
curl -sSI -u "$AUTH" "$PREVIEW/app-shell" | grep -i 'x-robots-tag'
```

Expected: první dva příkazy vrátí **0**, třetí **jeden** canonical na `https://www.cestybezmapy.cz/`, čtvrtý **1**. Kdyby neexistující adresa canonical nesla, rewrite pořád míří na homepage a rozdělení se neuplatnilo.

Poslední příkaz je ošemetný: `vercel.json` posílá `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` na **všechny** odpovědi (předlaunchová ochrana), takže hlavička tam bude tak jako tak. Ověřuj, že se **na `/app-shell` neztratila** — a skutečné potvrzení, že scoped pravidlo funguje samostatně, přijde až po launchi, kdy plošná hlavička zmizí. Zapiš si to do launch checklistu.

Pozor: web i admin jsou za předlaunchovým Basic auth (realm „cesty-bez-mapy"), takže `curl` potřebuje `-u`.

- [ ] **Step 7: Nasazení migrace — jen s výslovným svolením**

Migrace z Tasku 11 mění produkční databázi. **Neprováděj bez potvrzení uživatele.**

```bash
supabase db push
```

Pak ověř, že trigger existuje **na produkci**. `supabase test db` bez `--db-url` se připojuje
na lokální databázi a o produkčním stavu neřekne nic — ale **nepouštěj proti produkci ani celou
pgTAP sadu [4. kolo]**: `04_reviews.test.sql` používá absolutní počty řádků napříč tabulkou
(`count(*) = 1`, `= 5`), takže by proti produkčním datům červenala bez ohledu na migraci
a vypadalo by to jako selhání nasazení. Ověřeno spuštěním: naseedovaná data shodila přesně
testy 20, 25, 26 a 28.

Místo toho cílený dotaz na produkční schéma (jen čtení):

```sql
select tgname from pg_trigger
 where tgrelid = 'public.reviews'::regclass and not tgisinternal;

select proname from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and proname = 'notify_vercel_reviews_change';
```

Expected: `trg_reviews_deploy_hook` je v prvním výpisu, `notify_vercel_reviews_change` ve druhém.

Nakonec v Supabase dashboardu schval jednu čekající recenzi (nebo ji odschval a znovu schval) a v Vercelu zkontroluj, že se do minuty rozjel nový build. **Tohle je jediné ověření, že deploy hook opravdu odejde** — lokální pgTAP to dokázat nemůže, protože `vault.secrets` je prázdný a větev s `net.http_post` se nikdy nevykoná.

- [ ] **Step 8: Commit (jen pokud kroky odhalily opravu)**

Pokud kroky 1–7 nic neodhalily, není co commitovat.

---

## Co ověřit až při launchi

**1. Předlaunchová hlavička.** `vercel.json:23` posílá na všechny odpovědi `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`. Dokud tam je, canonical, `robots` meta ani JSON-LD z téhle práce **pro Google** nic neovlivní. Po jejím odstranění projdi Search Console: report „Product snippets" nesmí hlásit chyby a stránky recenzí se musí objevit v indexu.

**2. Seznam se tou hlavičkou neřídí.** SeznamBot `X-Robots-Tag` ignoruje a stáhne celou URL; pro něj je `<meta name="robots">` v HTML jediný funkční mechanismus. Dnes web chrání jen Basic auth. Prakticky to znamená, že zastaralý prerenderovaný `noindex` by poškodil i Seznam — což je další důvod pro deploy hook z Tasku 11.

**3. Skořápku chrání hlavička, ne `robots.txt` [4. kolo].** `/app-shell` je veřejná adresa
vracející 200 a prázdnou stránku. Task 11 pro ni zavádí scoped `X-Robots-Tag: noindex`
ve `vercel.json`. Až se při launchi odstraní plošná předlaunchová hlavička, **ověř, že to
scoped pravidlo zůstalo a funguje samostatně**:

```bash
curl -sSI "https://www.cestybezmapy.cz/app-shell" | grep -i 'x-robots-tag'   # → noindex
curl -sSI "https://www.cestybezmapy.cz/kontakt"   | grep -i 'x-robots-tag'   # → nic
```

Druhý příkaz je důležitý: kdyby hlavička odcházela i na běžné stránky, znamenalo by to,
že se pravidlo neaplikovalo scoped, a vyindexoval by se celý web.

**Do `robots.txt` `Disallow: /app-shell` nepřidávej.** Zakázaný crawl by robotovi zabránil
přečíst si `noindex` — Google k tomu píše, že *„a page that's disallowed in robots.txt can
still be indexed if linked to from other sites"*, takže by ochrana byla slabší, ne silnější.
U Seznamu platí totéž výslovně: *„Pokud zakážete stahování v souboru robots.txt, SeznamBot
si informaci o zákazu indexování již nepřečte."*

## Poznámky mimo rozsah

Tyto věci plán **záměrně neřeší**, jsou zapsané ve specu a patří do samostatných úkolů:

1. `src/pages/NotFound.tsx` nemá `robots` meta → po Tasku 6 to je jednořádková oprava, ale patří k samostatnému úkolu o měkkých 404.
2. `fetchReviewStats` v `src/lib/reviews.ts:52` stahuje všechna hodnocení bez limitu.
3. `src/pages/Reviews.tsx:24` má `<Layout ready>` napevno, takže prerender nečeká na recenze.
4. Složený index `(product_id, created_at DESC)` — až počet recenzí poroste.
5. `fetchApprovedReviews` posílá `count: 'exact'` i tam, kde `total` nikdo nepoužívá (stránka recenzí počítá strany z `review_count`). Exact COUNT nad `reviews` při každém načtení strany je při dnešním objemu bez dopadu, ale je to zároveň jediná příčina odpovědí 416. Odstranit by šlo jen rozdělením funkce, protože globální `/recenze` `total` potřebuje.
6. `productReviewsPath()` skládá cestu natvrdo, zatímco `ROUTES.PRODUCT_REVIEWS` drží tentýž tvar jako pattern — dvě verze pravdy pro jednu cestu. Sjednotit by chtělo pomocnou funkci nad `ROUTES`, což je zásah do všech rout, ne jen recenzí.
7. `reviewBody` v JSON-LD detailu nese plný text, který karta vizuálně ořezává `line-clamp-6`. Text v DOMu je, takže o skrytý obsah nejde, ale je to další důvod, proč `review` markup lépe sedí na stránce s plným zněním.
