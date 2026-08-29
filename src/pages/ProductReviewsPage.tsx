import { useState, useEffect, useRef } from 'react';
import { Link, Navigate, NavigationType, useNavigationType, useParams } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import Layout from '../components/layout/Layout';
import SeoTags from '../components/common/SeoTags';
import ReviewCard from '../components/ui/ReviewCard';
import ReviewsPagination from '../components/reviews/ReviewsPagination';
import ProductRatingSummary from '../components/reviews/ProductRatingSummary';
import { formatReviewDate, reviewDateIso } from '../components/reviews/formatReviewDate';
import { REVIEWS_PAGE_SIZE, clampPage, isPagedPage, productReviewsPath, reviewPageRange } from '../constants/reviews';
import { BASE_PATH, productDetailPath } from '../constants';
import { fetchApprovedReviews, fetchProductForReviews } from '../lib/reviews';
import type { ProductForReviews, PublicReview } from '../lib/reviews';
import { buildProductReviewsMeta, productDisplayName } from '../utils/productSeo';
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
    //    oznámil holé „Recenze“ bez názvu produktu a doplnění názvu už by neoznámil.
    //    Navíc by fokus přeskočil odkaz „Zpět na průvodce“, který je v DOMu NAD
    //    nadpisem, takže by se k němu dopředným tabováním nešlo dostat.
    //    (Ověřeno spuštěním.)
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

  // `StrictMode` (main.tsx) simuluje remount: v dev módu proběhne mount → cleanup →
  // mount znovu. `isFirstRender` je `useRef`, takže simulovaný remount ho neresetuje —
  // bez tohohle efektu by první „mount" nastavil `isFirstRender.current` na `false`
  // a druhý (ten skutečný) by strážce nahoře přeskočil, takže by fokus v dev módu
  // naskočil přesně ve chvíli, které měl strážce zabránit. Prázdné závislosti: přepnutí
  // strany se ho nesmí dotknout. Při opravdovém unmountu/remountu (ne StrictMode) je
  // znovunastavení na `true` taky správné chování — komponenta se otevírá nanovo.
  useEffect(
    () => () => {
      isFirstRender.current = true;
    },
    [],
  );

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
        const totalPages = reviewPageRange(count).totalPages;
        const currentPage = clampPage(strana, totalPages);

        // Adresa neodpovídá platné straně (mimo rozsah, nečíselná, nebo /strana/1)
        // → přesměrujeme, ať tentýž obsah nežije pod víc adresami. Porovnáváme
        // parametr, ne `location.pathname`: pathname v závislostech efektu by při
        // každém přesměrování znovu natáhl produkt a k rozhodnutí nic nepřidává.
        const canonicalStrana = isPagedPage(currentPage) ? String(currentPage) : undefined;
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
  const totalPages = reviewPageRange(count).totalPages;
  const productTitle = product ? productDisplayName(product) : '';
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string image_url must fall through to fallback, stejně jako v buildProductReviewsMeta
  const imageSrc = product?.image_url || `${BASE_PATH}/images/placeholder-guide.jpg`;
  const meta = product
    ? buildProductReviewsMeta(product, {
        page,
        reviews: reviews.map((r) => ({
          author: r.reviewer_name,
          rating: r.rating,
          text: r.review_text,
          datePublished: reviewDateIso(r.created_at),
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
        <Link to={productDetailPath(slug!)} className="text-green-800 underline underline-offset-4">
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
          {productTitle ? `Recenze — ${productTitle}` : 'Recenze'}
        </h1>

        {product && count > 0 && (
          <ProductRatingSummary average={product.average_rating ?? 0} count={count} className="mb-4" />
        )}

        {/* Perex a náhledový obrázek nejsou dekorace: JSON-LD je posílá
            v `description` a `image`, a Google zakazuje markovat obsah, který
            na stránce vidět není. Kdyby odsud zmizely, musí zmizet i
            z `buildProductReviewsMeta` — a naopak.
            `src` schválně NENÍ `meta.ogImage`: ten je vždy absolutní produkční URL
            (i pro placeholder), a `public/images/placeholder-guide.jpg` v repu
            vůbec neexistuje — u produktu bez vlastního obrázku by <img> mířil na
            cizí origin, který je do launche za Basic autentizací. Relativní cesta
            přes `BASE_PATH` tenhle cross-origin dotaz obchází; pro produkt
            s vlastním `image_url` je hodnota stejná jako v JSON-LD, protože ten
            samotný sloupec je už absolutní URL do Storage. `loading="lazy"` schválně
            chybí — obrázek je nad ohybem, hned pod nadpisem. */}
        {product?.hero_subtitle?.trim() && (
          <p className="text-lg text-gray-700 mb-6">{product.hero_subtitle}</p>
        )}
        {meta && (
          <img
            src={imageSrc}
            alt={`Průvodce ${productTitle}`}
            className="w-full max-h-64 object-cover rounded-2xl mb-8"
          />
        )}


        {loading && <p data-loading="true" className="text-center text-gray-600">Načítám recenze…</p>}

        {!loading && error && (
          <p className="text-center text-gray-600">Recenze se nepodařilo načíst. Zkus to prosím později.</p>
        )}

        {/* `reviews.length === 0` vedle `count === 0` schválně: moderace může mezi
            dotazem na produkt (review_count) a dotazem na recenze schválenou recenzi
            smazat nebo odschválit. Bez týhle podmínky by stránka ukázala prázdný
            `<ul>` i stránkování a neřekla by nic — stejný prázdný stav je pro
            uživatele pravdivější než tichá prázdnota. */}
        {!loading && !error && (count === 0 || reviews.length === 0) && (
          <p className="text-center text-gray-600">
            Tenhle průvodce zatím recenzi nemá. Buď první, kdo se podělí o zkušenost!
          </p>
        )}

        {!loading && !error && count > 0 && reviews.length > 0 && (
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
