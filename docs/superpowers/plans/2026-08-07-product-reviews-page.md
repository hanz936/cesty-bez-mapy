# Dedikovaná stránka recenzí pro produkt — implementační plán

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dát recenzím každého produktu vlastní stránku s plnými texty a stránkováním v cestě; na detailu produktu nechat klikatelný souhrn hodnocení a tři ukázkové recenze.

**Architecture:** Nová routa `/cestovni-pruvodci/:slug/recenze` (+ `/strana/:strana` pro strany 2+). Stránka dohledá produkt podle slugu, spočítá počet stran z `products.review_count`, ořízne stranu do platného rozsahu **ještě před** dotazem a načte jednu stranu přes existující `fetchApprovedReviews`. Detail produktu dostane souhrnný proužek s hvězdičkami, který na tuhle stránku odkazuje. Strukturovaná data se rozdělí: detail zůstává merchant listing (`offers` + `aggregateRating` + 3 `review`), stránka recenzí je product snippet (`Product` bez `offers`, `aggregateRating` + `review` odpovídající zobrazené straně).

**Tech Stack:** React 19, TypeScript, React Router 7 (declarative), Tailwind 4, Supabase JS 2, Vitest 3 + Testing Library, Playwright (prerender), Vite 7.

**Spec:** [`docs/superpowers/specs/2026-08-07-product-reviews-page-design.md`](../specs/2026-08-07-product-reviews-page-design.md)

## Global Constraints

- **Veškerý text v UI česky.** Kód, commity a názvy souborů anglicky.
- **Žádná databázová migrace.** `products.average_rating` i `review_count` udržuje trigger `refresh_product_rating`.
- **Recenze mají column-level GRANT jen na 6 sloupců pro `anon`.** Vždy používat `REVIEW_COLUMNS` z `src/lib/reviews.ts`; `select('*')` vrátí 42501.
- **Počet stran se počítá z `products.review_count`, nikdy z `count` stránkovaného dotazu.** PostgREST vrací na `Range` mimo rozsah HTTP 416 a `fetchApprovedReviews` na chybu vyhazuje výjimku.
- **Limit recenzí na detailu produktu je jedna sdílená konstanta.** Dnes je hodnota na dvou místech (`ProductReviews.tsx:12` a natvrdo `limit: 6` v `ProductDetail.tsx:111`).
- **`REVIEWS_DISCLOSURE` musí být na každé stránce, kde recenze zobrazujeme.** Povinnost dle § 5a odst. 5 zákona č. 634/1992 Sb.
- **Recenzí na stranu: 10.** Konstanta `REVIEWS_PAGE_SIZE`.
- **Recenzí na detailu produktu: 3.** Konstanta `PRODUCT_REVIEWS_LIMIT`.
- **Chyba se nikdy nevydává za prázdno.** Selhání načtení → vlastní hláška; nula recenzí → prázdný stav.
- **Sentry:** `Sentry.captureException(err, { tags: { area: 'reviews', component: '<Jméno>' } })`.
- Testy se spouští `npm run test:run`, typová kontrola `npm run type-check`, lint `npm run lint`.

---

### Task 1: `ReviewCard` — režimy `teaser`/`full`, oprava ořezu a překryvu

Karta má dnes textový box s pevnou výškou `h-32` (128 px) a na odstavci `line-clamp-6`. Do boxu se vejde jen 4,92 řádku, takže se výpustka nikdy neukáže a text se ustřihne uprostřed řádku. Zároveň má karta v základní třídě `h-[400px]`, což dnes přebíjí `h-full` od volajících — na nové stránce (jeden sloupec, `h-full` se nepředává) by to plný text ořízlo.

**Files:**
- Modify: `src/components/ui/ReviewCard.tsx`
- Create: `src/components/ui/ReviewCard.test.tsx`

**Interfaces:**
- Consumes: nic
- Produces: `ReviewCardProps` s novou vlastností `variant?: 'teaser' | 'full'` (výchozí `'teaser'`). Používají Task 8 (`variant="full"`) a Task 9 (`variant="teaser"`).

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
            variant === 'teaser' ? 'line-clamp-6' : 'whitespace-pre-line'
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
Expected: PASS, 5 testů.

- [ ] **Step 5: Ověř, že nic jiného nespadlo**

Run: `npm run test:run && npm run type-check`
Expected: PASS. `ReviewsSection` i `ProductReviews` předávají `className="h-full …"`, takže odstranění `h-[400px]` jejich mřížky nerozbije — výšku dál řídí `h-full` + roztažení řádku mřížky.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/ReviewCard.tsx src/components/ui/ReviewCard.test.tsx
git commit -m "fix(reviews): let review text clamp with a visible ellipsis

The text box was pinned to h-32 (128px) while the paragraph asked for
line-clamp-6; only 4.92 lines fit, so the clamp never engaged and
overflow-hidden cut the text mid-line. Drop the fixed height, add a full
variant that renders the whole review, and stop the base class forcing
400px on callers that do not pass h-full.

Also lift the verified badge above the decorative quote circle, which
overlapped it at every width, not just on mobile."
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
- Create: `src/components/reviews/ProductRatingSummary.tsx`
- Create: `src/components/reviews/ProductRatingSummary.test.tsx`

**Interfaces:**
- Consumes: `reviewCountLabel` (Task 2)
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

  it('skloňuje počet recenzí', () => {
    const { rerender } = renderIn(<ProductRatingSummary average={5} count={3} />);
    expect(screen.getByText(/3 recenze/)).toBeInTheDocument();
    rerender(<MemoryRouter><ProductRatingSummary average={5} count={9} /></MemoryRouter>);
    expect(screen.getByText(/9 recenzí/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/reviews/ProductRatingSummary.test.tsx`
Expected: FAIL — komponenta neexistuje.

- [ ] **Step 3: Write minimal implementation**

Vytvoř `src/components/reviews/ProductRatingSummary.tsx`:

```tsx
import { Link } from 'react-router-dom';
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

  const formattedAverage = average.toFixed(1).replace('.', ',');
  const label = `${count} ${reviewCountLabel(count)}`;
  const body = (
    <>
      <Stars average={average} />
      <span className="font-semibold text-gray-900">{formattedAverage}</span>
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/components/reviews/ProductRatingSummary.test.tsx`
Expected: PASS, 5 testů.

- [ ] **Step 5: Commit**

```bash
git add src/components/reviews/ProductRatingSummary.tsx src/components/reviews/ProductRatingSummary.test.tsx
git commit -m "feat(reviews): add rating summary strip

Google requires the aggregateRating value to be visible on any page whose
markup declares it; the product page currently ships aggregateRating in
JSON-LD without showing an average anywhere. Renders as a link when given
an href, as static text otherwise."
```

---

### Task 4: `lib/reviews.ts` — rozhodující druhý klíč řazení a dohledání produktu

**Files:**
- Modify: `src/lib/reviews.ts:38-48`
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

Do stávajícího `src/lib/reviews.test.ts` přidej na konec souboru nový blok, který ohlídá řazení:

```ts
describe('fetchApprovedReviews řazení', () => {
  it('řadí created_at DESC a id DESC jako rozhodující klíč', async () => {
    // Bez druhého klíče může offsetové stránkování při shodných časech
    // (dávkové schválení, import) řádek zopakovat nebo přeskočit.
    const orderCalls: unknown[][] = [];
    const builder = {
      order: (...args: unknown[]) => { orderCalls.push(args); return builder; },
      eq: () => builder,
      range: () => Promise.resolve({ data: [], count: 0, error: null }),
    };
    vi.doMock('./supabase', () => ({ supabase: { from: () => ({ select: () => builder }) } }));
    const { fetchApprovedReviews } = await import('./reviews');
    await fetchApprovedReviews({ limit: 10, offset: 0 });
    expect(orderCalls).toEqual([
      ['created_at', { ascending: false }],
      ['id', { ascending: false }],
    ]);
  });
});
```

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
 * Produkt pro stránku recenzí — jen pole potřebná pro souhrn, nadpis a JSON-LD.
 * `null` = produkt neexistuje nebo není veřejný (PGRST116). Jakákoli jiná chyba
 * se vyhazuje, aby se výpadek nevydával za „produkt nenalezen".
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

- [ ] **Step 5: Ověř, že přidané řazení nerozbilo stávající testy**

Run: `npm run test:run && npm run type-check`
Expected: PASS. Pokud některý existující test v `reviews.test.ts` počítal s jediným voláním `.order()`, uprav ho na dvě volání — chování dotazu je záměrná změna.

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
- Consumes: `ProductForReviews` (Task 4)
- Produces:
  ```ts
  export interface ProductReviewsMeta {
    title: string;
    description: string;
    canonical: string;
    ogImage: string;
    robots?: string;
    jsonLd: ProductReviewsJsonLd;
  }
  export function buildProductReviewsMeta(
    product: ProductForReviews,
    options: {
      page: number;
      reviews: { author: string; rating: number; text: string; datePublished: string }[];
    },
    siteUrl?: string,
  ): ProductReviewsMeta;
  ```
  Používá Task 8.

- [ ] **Step 1: Write the failing test**

Do `src/utils/productSeo.test.ts` přidej:

```ts
import { buildProductReviewsMeta } from './productSeo';

const product = {
  id: 'p1',
  title: 'Roadtrip po Itálii',
  detail_title: 'Roadtrip po Itálii na 20 dní',
  hero_subtitle: 'Kompletně naplánovaná cesta',
  slug: 'italie-roadtrip',
  image_url: 'https://cdn.example/italie.jpg',
  average_rating: 4.5,
  review_count: 12,
};
const reviews = [
  { author: 'Jana N.', rating: 5, text: 'Skvělé.', datePublished: '2026-07-01' },
  { author: 'Petr K.', rating: 4, text: 'Dobré.', datePublished: '2026-06-20' },
];

describe('buildProductReviewsMeta', () => {
  it('JSON-LD je Product BEZ offers (stránka není prodejní)', () => {
    const meta = buildProductReviewsMeta(product, { page: 1, reviews }, 'https://x.cz');
    expect(meta.jsonLd['@type']).toBe('Product');
    expect(meta.jsonLd).not.toHaveProperty('offers');
  });

  it('review[] odpovídá počtu recenzí na zobrazené straně', () => {
    const meta = buildProductReviewsMeta(product, { page: 1, reviews }, 'https://x.cz');
    expect(meta.jsonLd.review).toHaveLength(2);
    expect(meta.jsonLd.review?.[0].author.name).toBe('Jana N.');
  });

  it('nese aggregateRating s průměrem a počtem', () => {
    const meta = buildProductReviewsMeta(product, { page: 1, reviews }, 'https://x.cz');
    expect(meta.jsonLd.aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: '4.5',
      reviewCount: 12,
    });
  });

  it('canonical strany 1 je bez segmentu /strana', () => {
    const meta = buildProductReviewsMeta(product, { page: 1, reviews }, 'https://x.cz');
    expect(meta.canonical).toBe('https://x.cz/cestovni-pruvodci/italie-roadtrip/recenze');
  });

  it('canonical strany 2 míří sám na sebe, ne na stranu 1', () => {
    const meta = buildProductReviewsMeta(product, { page: 2, reviews }, 'https://x.cz');
    expect(meta.canonical).toBe('https://x.cz/cestovni-pruvodci/italie-roadtrip/recenze/strana/2');
  });

  it('titulek strany 2 se liší od strany 1', () => {
    const first = buildProductReviewsMeta(product, { page: 1, reviews }, 'https://x.cz');
    const second = buildProductReviewsMeta(product, { page: 2, reviews }, 'https://x.cz');
    expect(first.title).toBe('Recenze — Roadtrip po Itálii');
    expect(second.title).toBe('Recenze — Roadtrip po Itálii (strana 2)');
  });

  it('bez recenzí nese noindex a vynechá aggregateRating i review', () => {
    const meta = buildProductReviewsMeta(
      { ...product, average_rating: 0, review_count: 0 },
      { page: 1, reviews: [] },
      'https://x.cz',
    );
    expect(meta.robots).toBe('noindex, follow');
    expect(meta.jsonLd).not.toHaveProperty('aggregateRating');
    expect(meta.jsonLd).not.toHaveProperty('review');
  });

  it('se recenzemi noindex nenastavuje', () => {
    const meta = buildProductReviewsMeta(product, { page: 1, reviews }, 'https://x.cz');
    expect(meta.robots).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/utils/productSeo.test.ts`
Expected: FAIL — `buildProductReviewsMeta` neexistuje.

- [ ] **Step 3: Write minimal implementation**

V `src/utils/productSeo.ts` přidej import typu na začátek:

```ts
import type { ProductForReviews } from '../lib/reviews';
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
 * (na rozdíl od „merchant listing" na detailu produktu) a jeho vzorový příklad
 * „Product review page" `offers` NEOBSAHUJE — koupit se tu nedá a stránka tak
 * nekonkuruje detailu produktu o roli prodejní stránky.
 */
export interface ProductReviewsJsonLd {
  '@context': string;
  '@type': 'Product';
  name: string;
  description: string;
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
  jsonLd: ProductReviewsJsonLd;
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
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string title must fall through to fallback
  const productTitle = product.detail_title?.trim() || product.title;
  const count = product.review_count ?? 0;
  const suffix = options.page > 1 ? ` (strana ${options.page})` : '';
  const title = `Recenze — ${productTitle}${suffix}`;
  const description = count > 0
    ? `Recenze od ověřených zákazníků k průvodci ${productTitle}. Přečti si, co říkají ti, kteří s ním už cestovali.`
    : `Průvodce ${productTitle} zatím nemá recenzi. Buď první, kdo se podělí o zkušenost.`;
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string image_url must fall through to fallback
  const image = product.image_url || `${siteUrl}/images/placeholder-guide.jpg`;

  const jsonLd: ProductReviewsJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description,
    image: [image],
  };

  if (count > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: String(product.average_rating ?? 0),
      reviewCount: count,
    };
    if (options.reviews.length > 0) {
      jsonLd.review = toReviewJsonLd(options.reviews);
    }
  }

  return {
    title,
    description,
    canonical: `${siteUrl}${productReviewsPath(product.slug, options.page)}`,
    ogImage: image,
    robots: count === 0 ? 'noindex, follow' : undefined,
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

Google's own 'Product review page' example carries Product + aggregateRating
+ review and no offers, which keeps the reviews page from competing with the
product page as the sellable listing. Each page canonicalises to itself
because Google forbids pointing a paginated sequence at page one."
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
    render(<SeoTags meta={{ ...base, robots: 'noindex, follow' }} />);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, follow');
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
  /** Např. 'noindex, follow' pro stránky, které nemají do indexu. */
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

Vytvoř `src/components/reviews/ReviewsPagination.test.tsx`:

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

  it('aktuální strana má aria-current a není odkaz', () => {
    renderAt(2, 3);
    const current = screen.getByText('2');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current.tagName).not.toBe('A');
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

Run: `npm run test:run -- src/components/reviews/ReviewsPagination.test.tsx`
Expected: FAIL — komponenta neexistuje.

- [ ] **Step 3: Write minimal implementation**

Vytvoř `src/components/reviews/ReviewsPagination.tsx`:

```tsx
import { Link } from 'react-router-dom';

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
 */
const ReviewsPagination = ({ currentPage, totalPages, buildHref, className = '' }: ReviewsPaginationProps) => {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

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
        {pages.map((page) => (
          <li key={page}>
            {page === currentPage ? (
              <span className={currentClass} aria-current="page">
                {page}
              </span>
            ) : (
              <Link to={buildHref(page)} className={linkClass} aria-label={`Strana ${page}`}>
                {page}
              </Link>
            )}
          </li>
        ))}
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

Run: `npm run test:run -- src/components/reviews/ReviewsPagination.test.tsx`
Expected: PASS, 6 testů.

- [ ] **Step 5: Commit**

```bash
git add src/components/reviews/ReviewsPagination.tsx src/components/reviews/ReviewsPagination.test.tsx
git commit -m "feat(reviews): add link-based pagination nav

Crawlers follow anchors, not button clicks, so paging has to be real links
for the deeper pages to be discoverable at all."
```

---

### Task 8: `ProductReviewsPage` — samotná stránka

**Files:**
- Create: `src/pages/ProductReviewsPage.tsx`
- Create: `src/pages/ProductReviewsPage.test.tsx`
- Modify: `src/constants/routes.ts`
- Modify: `src/App.tsx:108`

**Interfaces:**
- Consumes: `fetchProductForReviews`, `ProductForReviews`, `fetchApprovedReviews` (Task 4); `buildProductReviewsMeta`, `productReviewsPath` (Task 5); `SeoTags` s `robots` (Task 6); `ReviewsPagination` (Task 7); `ProductRatingSummary` (Task 3); `ReviewCard` s `variant="full"` (Task 1)
- Produces: `REVIEWS_PAGE_SIZE = 10`; routy `ROUTES.PRODUCT_REVIEWS` a `ROUTES.PRODUCT_REVIEWS_PAGED`. Používá Task 9 a Task 10.

- [ ] **Step 1: Write the failing test**

Vytvoř `src/pages/ProductReviewsPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

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

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationSpy />
      <Routes>
        <Route path="/cestovni-pruvodci/:slug/recenze" element={<ProductReviewsPage />} />
        <Route path="/cestovni-pruvodci/:slug/recenze/strana/:strana" element={<ProductReviewsPage />} />
        <Route path="/cestovni-pruvodci/:slug" element={<div>DETAIL PRODUKTU</div>} />
        <Route path="*" element={<div>NENALEZENO</div>} />
      </Routes>
    </MemoryRouter>,
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

  it('po přechodu na jinou stranu přesune fokus na nadpis, ale ne při prvním načtení', async () => {
    fetchProductForReviewsMock.mockResolvedValue(product);
    fetchApprovedReviewsMock.mockResolvedValue({ reviews: [review('r1')], total: 12 });
    const { rerender } = renderAt('/cestovni-pruvodci/italie/recenze');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument());
    expect(document.activeElement).not.toBe(screen.getByRole('heading', { level: 1 }));

    rerender(
      <MemoryRouter initialEntries={['/cestovni-pruvodci/italie/recenze/strana/2']}>
        <LocationSpy />
        <Routes>
          <Route path="/cestovni-pruvodci/:slug/recenze" element={<ProductReviewsPage />} />
          <Route path="/cestovni-pruvodci/:slug/recenze/strana/:strana" element={<ProductReviewsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 })));
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/pages/ProductReviewsPage.test.tsx`
Expected: FAIL — stránka neexistuje.

- [ ] **Step 3: Přidej routy do konstant**

V `src/constants/routes.ts` přidej do `ROUTES` za `CUSTOM_ITINERARY_PREVIEW`:

```ts
  PRODUCT_REVIEWS: '/cestovni-pruvodci/:slug/recenze',
  PRODUCT_REVIEWS_PAGED: '/cestovni-pruvodci/:slug/recenze/strana/:strana',
```

- [ ] **Step 4: Write the page**

Vytvoř `src/pages/ProductReviewsPage.tsx`:

```tsx
import { useState, useEffect, useRef } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import Layout from '../components/layout/Layout';
import SeoTags from '../components/common/SeoTags';
import ReviewCard from '../components/ui/ReviewCard';
import ReviewsPagination from '../components/reviews/ReviewsPagination';
import ProductRatingSummary from '../components/reviews/ProductRatingSummary';
import { REVIEWS_DISCLOSURE } from '../components/reviews/disclosure';
import { formatReviewDate } from '../components/reviews/formatReviewDate';
import { fetchApprovedReviews, fetchProductForReviews } from '../lib/reviews';
import type { ProductForReviews, PublicReview } from '../lib/reviews';
import { buildProductReviewsMeta, productReviewsPath } from '../utils/productSeo';
import NotFound from './NotFound';

export const REVIEWS_PAGE_SIZE = 10;

/**
 * Ořízne stranu do platného rozsahu. Musí se stát PŘED dotazem: PostgREST
 * odpovídá na `Range` mimo rozsah stavem 416 a `fetchApprovedReviews` na chybu
 * vyhazuje, takže z takové odpovědi bychom se `count` nikdy nedozvěděli.
 * Počet stran proto plyne z `products.review_count`.
 */
export function clampPage(raw: string | undefined, totalPages: number): number {
  const parsed = Number(raw);
  if (!raw || !Number.isInteger(parsed) || parsed < 1) return 1;
  return Math.min(parsed, Math.max(totalPages, 1));
}

const ProductReviewsPage = () => {
  const { slug, strana } = useParams();
  const location = useLocation();
  const [product, setProduct] = useState<ProductForReviews | null>(null);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Fokus se přesouvá jen při skutečné změně strany, ne při prvním načtení —
  // jinak bychom uživateli sebrali fokus hned po příchodu na stránku.
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [page]);

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
        // → přesměrujeme, ať tentýž obsah nežije pod víc adresami. Recenze se
        // načtou až po přesměrování, na správné adrese.
        const canonicalPath = productReviewsPath(slug!, currentPage);
        if (location.pathname !== canonicalPath) {
          setRedirectTo(canonicalPath);
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
        Sentry.captureException(err, { tags: { area: 'reviews', component: 'ProductReviewsPage' } });
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- fire-and-forget load v useEffect
    load();
    return () => {
      isMounted = false;
    };
  }, [slug, strana, location.pathname]);

  if (notFound) return <NotFound />;
  // `replace`, aby se neplatná adresa nezanesla do historie prohlížeče. Pozor:
  // je to history.replaceState, ne `window.location` — Googlebot to nevidí jako
  // přesměrování, ale jako obsah pod původní adresou. Tyhle adresy proto nikde
  // neodkazujeme ani nedáváme do sitemapy.
  if (redirectTo) return <Navigate to={redirectTo} replace />;

  const count = product?.review_count ?? 0;
  const totalPages = Math.ceil(count / REVIEWS_PAGE_SIZE);
  const productTitle = product?.detail_title?.trim() ?? product?.title ?? '';
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
    <Layout ready={!loading && !!product}>
      {meta && <SeoTags meta={meta} />}
      <main className="max-w-4xl mx-auto px-5 py-16" role="main">
        <Link to={`/cestovni-pruvodci/${slug}`} className="text-green-800 underline underline-offset-4">
          ← Zpět na průvodce
        </Link>

        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-3xl sm:text-4xl font-bold text-green-800 mt-6 mb-4 focus:outline-none"
        >
          Recenze — {productTitle}
        </h1>

        {product && count > 0 && (
          <ProductRatingSummary average={product.average_rating ?? 0} count={count} className="mb-4" />
        )}

        <p className="text-sm text-gray-500 mb-10">{REVIEWS_DISCLOSURE}</p>

        {loading && <p className="text-center text-gray-500">Načítám recenze…</p>}

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
      </main>
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

A k importům stránek (mezi ostatní `import` stránek, ne mezi `lazy`):

```tsx
import ProductReviewsPage from './pages/ProductReviewsPage';
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test:run -- src/pages/ProductReviewsPage.test.tsx`
Expected: PASS, 12 testů.

- [ ] **Step 7: Ověř typy a lint**

Run: `npm run type-check && npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/pages/ProductReviewsPage.tsx src/pages/ProductReviewsPage.test.tsx src/constants/routes.ts src/App.tsx
git commit -m "feat(reviews): add per-product reviews page

Full review texts, ten per page, paginated through the path so each page can
carry its own canonical in prerendered HTML. The page count comes from
products.review_count and the requested page is clamped before the query
runs, because PostgREST answers an out-of-range Range header with 416 and the
paged query could then never report a total to clamp against."
```

---

### Task 9: Detail produktu — 3 recenze, sdílená konstanta, souhrn hodnocení

Dnes je limit na dvou místech: `PRODUCT_REVIEWS_LIMIT = 6` v `ProductReviews.tsx:12` a **natvrdo `limit: 6`** v `ProductDetail.tsx:111`. Změna jen konstanty by se na detailu vůbec neprojevila.

**Files:**
- Create: `src/components/reviews/productReviewsLimit.ts`
- Modify: `src/components/reviews/ProductReviews.tsx:12,80,118,132-138`
- Modify: `src/pages/ProductDetail.tsx:54,111,335,357-362`
- Modify: `src/components/reviews/ProductReviews.test.tsx`

**Interfaces:**
- Consumes: `ProductRatingSummary` (Task 3), `productReviewsPath` (Task 5), `ReviewCard` `variant` (Task 1)
- Produces: `PRODUCT_REVIEWS_LIMIT = 3` v `src/components/reviews/productReviewsLimit.ts`

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
import { PRODUCT_REVIEWS_LIMIT } from '../components/reviews/productReviewsLimit';

it('preload recenzí používá sdílenou konstantu, ne vlastní číslo', () => {
  expect(PRODUCT_REVIEWS_LIMIT).toBe(3);
  // Regrese: ProductDetail měl limit napevno, takže změna konstanty se neprojevila.
  const source = readFileSync(new URL('./ProductDetail.tsx', import.meta.url), 'utf8');
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
Expected: FAIL — limit je 6, modul `productReviewsLimit` neexistuje, odkaz míří na `/recenze`.

- [ ] **Step 3: Vytvoř sdílenou konstantu**

Vytvoř `src/components/reviews/productReviewsLimit.ts`:

```ts
/**
 * Kolik recenzí ukazuje detail produktu. Musí zůstat JEDNO číslo: hodnotu čte
 * jak ProductReviews (vykreslení), tak ProductDetail (preload + JSON-LD), a
 * Google vyžaduje, aby se počet recenzí v markupu rovnal počtu viditelných.
 */
export const PRODUCT_REVIEWS_LIMIT = 3;
```

- [ ] **Step 4: Uprav `ProductReviews`**

V `src/components/reviews/ProductReviews.tsx`:

Nahraď řádek 12 (`const PRODUCT_REVIEWS_LIMIT = 6;`) importem — přidej k ostatním importům:

```tsx
import { PRODUCT_REVIEWS_LIMIT } from './productReviewsLimit';
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

- [ ] **Step 5: Uprav `ProductDetail`**

V `src/pages/ProductDetail.tsx`:

Přidej k importům:

```tsx
import ProductRatingSummary from '../components/reviews/ProductRatingSummary';
import { PRODUCT_REVIEWS_LIMIT } from '../components/reviews/productReviewsLimit';
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

Pod `<h1>` v „Title Section" (řádky 357-362) přidej souhrn hodnocení:

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

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test:run -- src/components/reviews/ProductReviews.test.tsx src/pages/ProductDetail.seo.test.tsx`
Expected: PASS.

- [ ] **Step 7: Ověř celou sadu**

Run: `npm run test:run && npm run type-check && npm run lint`
Expected: PASS. JSON-LD detailu teď nese nejvýš 3 `review`, což odpovídá třem zobrazeným kartám.

- [ ] **Step 8: Commit**

```bash
git add src/components/reviews/productReviewsLimit.ts src/components/reviews/ProductReviews.tsx src/components/reviews/ProductReviews.test.tsx src/pages/ProductDetail.tsx src/pages/ProductDetail.seo.test.tsx
git commit -m "feat(reviews): show three teasers and a linked rating summary on product pages

The review limit lived in two places — a constant in ProductReviews and a
hardcoded 6 in ProductDetail — so changing one alone did nothing. Collapse it
to a single shared constant at 3, which keeps the JSON-LD review array equal
to what is actually visible, and drops the section from a measured 2430px to
1341px on a 390px viewport while filling the desktop row exactly."
```

---

### Task 10: Prerender a sitemap — routy recenzí včetně dalších stran

Neprerenderovaná adresa dostane přes Vercel rewrite `index.html`, jehož zdroj nese `canonical` na homepage (`index.html:17`) — a JS by ho pak přepisoval, což Google zakazuje. Proto se prerenderují routy recenzí pro **všechny aktivní produkty**, včetně těch bez recenzí (ty nesou `noindex` už ve zdrojovém HTML).

**Files:**
- Modify: `scripts/contentSlugs.mjs:24-26`
- Modify: `scripts/prerender.mjs:11-16`
- Modify: `scripts/sitemap.mjs:33-42`
- Modify: `scripts/prerender.test.js`
- Modify: `scripts/sitemap.test.js`

**Interfaces:**
- Consumes: `REVIEWS_PAGE_SIZE` (Task 8) — v Node skriptech se nedá importovat z `.tsx`, proto se hodnota 10 duplikuje jako `REVIEWS_PAGE_SIZE` v `prerender.mjs` s komentářem odkazujícím na zdroj pravdy.
- Produces: `collectRoutes(blogPosts, products)` nově generuje i routy recenzí.

- [ ] **Step 1: Write the failing test**

V `scripts/prerender.test.js` nahraď blok `describe('collectRoutes', …)`:

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
});
```

V `scripts/sitemap.test.js` přidej:

```js
import { collectSitemapPaths } from './sitemap.mjs';

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

V `scripts/prerender.mjs` nahraď `collectRoutes`:

```js
/** Musí odpovídat REVIEWS_PAGE_SIZE v src/pages/ProductReviewsPage.tsx (Node skript nemůže importovat .tsx). */
const REVIEWS_PAGE_SIZE = 10;

/**
 * Statické veřejné routy + /inspirace/:slug + /cestovni-pruvodci/:slug
 * + stránky recenzí (bez duplikátů).
 *
 * Routa recenzí se generuje i pro produkt bez recenzí: neprerenderovaná adresa
 * by dostala přes rewrite index.html s canonicalem na homepage, který by pak
 * JavaScript přepisoval — a to Google zakazuje. Prázdná stránka nese noindex
 * už ve zdrojovém HTML.
 */
export function collectRoutes(blogPosts, productSlugs = []) {
  const blog = (blogPosts || []).map((p) => `/inspirace/${p.slug}`);
  const products = [];
  for (const product of productSlugs || []) {
    products.push(`/cestovni-pruvodci/${product.slug}`);
    products.push(`/cestovni-pruvodci/${product.slug}/recenze`);
    const totalPages = Math.ceil((product.review_count ?? 0) / REVIEWS_PAGE_SIZE);
    for (let page = 2; page <= totalPages; page++) {
      products.push(`/cestovni-pruvodci/${product.slug}/recenze/strana/${page}`);
    }
  }
  return [...new Set([...STATIC_ROUTES, ...blog, ...products])];
}
```

- [ ] **Step 5: Rozšiř `sitemap.mjs`**

V `scripts/sitemap.mjs` přidej nad `run()` exportovaný helper a použij ho:

```js
/** Musí odpovídat REVIEWS_PAGE_SIZE v src/pages/ProductReviewsPage.tsx. */
const REVIEWS_PAGE_SIZE = 10;

/**
 * Cesty do sitemapy. Stránka recenzí se uvádí jen u produktů, které recenzi mají —
 * prázdná nese noindex, takže do sitemapy nepatří.
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
    for (let page = 2; page <= totalPages; page++) {
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
grep -c 'offers' dist/cestovni-pruvodci/italie-roadtrip/recenze/index.html
```

Expected: nadpis přítomen; canonical míří na `…/italie-roadtrip/recenze` (ne na homepage a ne na detail); JSON-LD typu `Product`; **žádné `offers`** (poslední příkaz vrátí 0).

Pozor: `npm run build` spouštěj z adresáře frontendu. Když je pracovní adresář jiný, vite servíruje cizí `dist`.

- [ ] **Step 8: Commit**

```bash
git add scripts/contentSlugs.mjs scripts/prerender.mjs scripts/sitemap.mjs scripts/prerender.test.js scripts/sitemap.test.js
git commit -m "build(seo): prerender the reviews pages and list them in the sitemap

Every active product gets a prerendered reviews route, including products
with no reviews: an unprerendered URL is served index.html, whose source
canonical points at the homepage, and letting JavaScript rewrite that is
exactly what Google's canonicalisation guidance forbids. Empty pages carry
noindex in the source instead. Deeper pages are derived from review_count,
which fetchProductSlugs now returns."
```

---

### Task 11: Ověření celku

**Files:** žádné změny — jen ověření.

- [ ] **Step 1: Celá sada testů, typy, lint**

```bash
cd /Users/janparma/Desktop/Projekty/cesty-bez-mapy
npm run test:run && npm run type-check && npm run lint
```

Expected: vše PASS.

- [ ] **Step 2: Změř dopad na výšku sekce**

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
  await page.goto(`${base}/cestovni-pruvodci/italie-roadtrip`, { waitUntil: 'load' });
  await page.waitForSelector('section[aria-label="Recenze produktu"]');
  const height = await page.evaluate(() =>
    Math.round(document.querySelector('section[aria-label="Recenze produktu"]').getBoundingClientRect().height));
  console.log(label, height);
  await page.close();
}
await browser.close();
await server.close();
```

Expected: s jednou recenzí v databázi zůstane sekce kolem 615 px na obou; se třemi recenzemi má na mobilu vyjít ~1 341 px a na desktopu ~615 px (jeden řádek).

- [ ] **Step 3: Projdi stránku očima**

Otevři `/cestovni-pruvodci/italie-roadtrip/recenze` a zkontroluj: nadpis, souhrn hodnocení **bez** odkazu, disclosure, plný text recenze bez ořezu, odkaz zpět na průvodce. Na detailu produktu zkontroluj souhrn pod nadpisem jako odkaz a tři karty vedle sebe na desktopu.

- [ ] **Step 4: Rich Results Test ručně**

Nemá veřejné API, takže tenhle krok nejde zautomatizovat. Vezmi vyrenderované HTML stránky recenzí, vlož ho do <https://search.google.com/test/rich-results> (záložka „Code") a potvrď, že `Product` bez `offers` projde — `offers` je v dokumentaci uvedené jen jako doporučené, ne povinné. Chybějící `offers` se smí objevit jako doporučení, ne jako chyba.

- [ ] **Step 5: Commit (jen pokud kroky odhalily opravu)**

Pokud kroky 1–4 nic neodhalily, není co commitovat.

---

## Poznámky mimo rozsah

Tyto věci plán **záměrně neřeší**, jsou zapsané ve specu a patří do samostatných úkolů:

1. `src/pages/NotFound.tsx` nemá `robots` meta → po Tasku 6 to je jednořádková oprava, ale patří k samostatnému úkolu o měkkých 404.
2. `fetchReviewStats` v `src/lib/reviews.ts:52` stahuje všechna hodnocení bez limitu.
3. `src/pages/Reviews.tsx:24` má `<Layout ready>` napevno, takže prerender nečeká na recenze.
4. Složený index `(product_id, created_at DESC)` — až počet recenzí poroste.
