import { useState, useEffect, useRef } from 'react';
import { Navigate, NavigationType, useNavigationType, useParams } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import Layout from '../components/layout/Layout';
import SeoTags from '../components/common/SeoTags';
import ReviewCard from '../components/ui/ReviewCard';
import ReviewsPagination from '../components/reviews/ReviewsPagination';
import ProductRatingSummary from '../components/reviews/ProductRatingSummary';
import Breadcrumbs from '../components/common/Breadcrumbs';
import { formatReviewDate, reviewDateIso } from '../components/reviews/formatReviewDate';
import { REVIEWS_PAGE_SIZE, clampPage, isPagedPage, productReviewsPath, reviewPageRange } from '../constants/reviews';
import { BASE_PATH } from '../constants';
import { fetchApprovedReviews, fetchProductForReviews } from '../lib/reviews';
import type { ProductForReviews, PublicReview } from '../lib/reviews';
import { buildProductReviewsMeta, productDisplayName, productReviewsCrumbs, productReviewsHeading } from '../utils/productSeo';
import NotFound from './NotFound';

/** Výsledek dotazu na produkt, vždy s adresou (`slug`), ke které patří. */
type ProductResult =
  | { slug: string; status: 'found'; product: ProductForReviews }
  | { slug: string; status: 'notFound' }
  | { slug: string; status: 'error' };

/** Výsledek dotazu na recenze; `key` = produkt + strana, pro které se ptalo. */
type ReviewsResult =
  | { key: string; productId: string; status: 'ok'; reviews: PublicReview[] }
  | { key: string; productId: string; status: 'error' };

function reportLoadError(err: unknown) {
  // Rozsah mimo data (416) se sem už nedostane — `fetchApprovedReviews` ho
  // překládá na prázdný výsledek. Obal na Error tu ale zůstává: PostgREST
  // umí odpovědět chybou s prázdným tělem, ze které postgrest-js vyrobí
  // prostý objekt bez stacku, a Sentry by z toho udělal
  // „Non-Error exception captured" bez jakékoli informace.
  const cause = err instanceof Error ? err : new Error(JSON.stringify(err));
  Sentry.captureException(cause, { tags: { area: 'reviews', component: 'ProductReviewsPage' } });
}

const ProductReviewsPage = () => {
  // `useParams()` typuje každou hodnotu jako `string | undefined`. Obě routy stránky
  // (`ROUTES.PRODUCT_REVIEWS` i `PRODUCT_REVIEWS_PAGED`) `:slug` nesou vždy, `:strana` jen ta
  // druhá — proto aserce na jednom místě, stejně jako v `BlogPostDetail`, místo `!`
  // rozesetých po volacích místech (audit T-9).
  const { slug, strana } = useParams() as { slug: string; strana?: string };
  const navigationType = useNavigationType();
  // Výsledky obou dotazů si pamatujeme i s klíčem, ke kterému patří (slug, resp.
  // produkt + strana). Jestli se právě načítá, se pak nedrží v dalším stavu, ale
  // odvodí při renderu porovnáním klíče s adresou — takže stránka nikdy neukáže
  // produkt z předchozí adresy a efekty nemusí nic nulovat (react.dev, „You Might
  // Not Need an Effect": co jde spočítat při renderu, nepatří do stavu).
  const [productResult, setProductResult] = useState<ProductResult | null>(null);
  const [reviewsResult, setReviewsResult] = useState<ReviewsResult | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isFirstRender = useRef(true);

  const productLoaded = productResult?.slug === slug ? productResult : null;
  const product = productLoaded?.status === 'found' ? productLoaded.product : null;
  const count = product?.review_count ?? 0;
  // Stránkování NEOŘEZÁVÁME na `MAX_PRERENDERED_REVIEW_PAGES` [4. kolo]. Strop je
  // jen limit prerenderu, ne limit produktu — kdybychom o něj zkrátili odkazy,
  // uživatel by se nad 200 recenzemi na hlubší strany vůbec nedostal. Nad stropem
  // tedy vzniknou odkazy na strany bez statického HTML; crawler tam dostane
  // skořápku a obsah uvidí až po vykonání JavaScriptu. Je to vědomý kompromis
  // ve prospěch uživatele. Prerender na překročení stropu upozorní v logu
  // (Task 10), takže se strop dá včas zvednout.
  const totalPages = reviewPageRange(count).totalPages;
  // Strana se počítá z adresy, ne drží ve stavu (audit T-6). Dřív ji nastavoval
  // efekt až po doběhnutí dotazu, takže po kliku na jinou stranu `<title>`
  // i `canonical` ještě chvíli popisovaly tu předchozí.
  const page = clampPage(strana, totalPages);
  // Adresa neodpovídá platné straně (mimo rozsah, nečíselná, nebo /strana/1)
  // → přesměrujeme, ať tentýž obsah nežije pod víc adresami. Rozhodnout jde až
  // se známým produktem, protože rozsah stran určuje jeho počet recenzí.
  const canonicalStrana = isPagedPage(page) ? String(page) : undefined;
  const redirectTo = product && strana !== canonicalStrana ? productReviewsPath(slug, page) : null;
  // Recenze se ptáme jen u produktu s recenzemi. Klíč nese už ořezanou stranu,
  // takže na přesměrovávané adrese (/strana/99) jde dotaz rovnou na cílovou
  // stranu a po přesměrování se klíč nezmění — nic se neptá dvakrát ani mimo rozsah.
  const reviewsKey = product && count > 0 ? `${product.id}:${page}` : null;
  const reviewsLoaded = reviewsKey !== null && reviewsResult?.key === reviewsKey ? reviewsResult : null;
  const loading = !productLoaded || (reviewsKey !== null && !reviewsLoaded);
  const error = productLoaded?.status === 'error' || reviewsLoaded?.status === 'error';
  // Mezi stranami TÉHOŽ produktu zůstávají zobrazené poslední načtené recenze, dokud
  // nedorazí nové — seznam je během načítání stejně skrytý, ale souhrn hodnocení
  // nahoře se řídí jejich počtem a jinak by při každém přepnutí strany problikl.
  // Recenze jiného produktu se neukážou nikdy.
  const reviews =
    count > 0 && reviewsResult?.status === 'ok' && reviewsResult.productId === product?.id
      ? reviewsResult.reviews
      : [];

  useEffect(() => {
    // Fokus přesouváme jen po skutečném přepnutí strany UVNITŘ téhle stránky.
    // Obě podmínky jsou nutné, každá chytá jiný případ:
    //
    // 1. Ne při prvním renderu. Příchod z detailu produktu je totiž taky `PUSH`,
    //    jenže efekt běží dřív, než doběhne `fetchProductForReviews` — odečítač by
    //    oznámil holé „Recenze“ bez názvu produktu a doplnění názvu už by neoznámil.
    //    Navíc by fokus přeskočil drobečkovou navigaci, která je v DOMu NAD
    //    nadpisem, takže by se k ní dopředným tabováním nešlo dostat.
    //    (Ověřeno spuštěním ještě na odkazu „Zpět na průvodce“, který na tomtéž
    //    místě stál před ní — pozice v DOMu se nezměnila, jen počet odkazů.)
    // 2. Jen `PUSH`. `POP` = mount, reload i tlačítko zpět; `REPLACE` = naše
    //    vlastní přesměrování na kanonickou stranu. V obou případech si uživatel
    //    stránku právě otevřel a sebrat mu fokus doprostřed by bylo překvapení.
    //
    // Komponenta se mezi `/recenze` a `/recenze/strana/2` NEODMONTOVÁVÁ (obě routy
    // renderují tentýž typ, React je odsesouhlasí na stejné pozici), takže si
    // `isFirstRender` mezi stranami udrží hodnotu — ověřeno spuštěním.
    //
    // Závislost je `strana` z adresy, ne odvozená `page`: ta se při přímém vstupu
    // na /strana/2 vyšplhá z 1 na 2, jakmile doběhne produkt (dřív ho rozsah stran
    // nezná), a efekt by zbytečně běžel znovu. `strana` se mění jen s adresou.
    //
    // NEPOUŽÍVAT `location.key === 'default'`: klíč je 'default' jen na mountu
    // kanonické adresy. Po přesměrování z /strana/99 je náhodný a po F5 přežije
    // v `history.state`, takže by guard v obou případech neplatil (ověřeno spuštěním).
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
  }, [strana, navigationType]);

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

  // Dva efekty, protože jde o dva nezávislé procesy (react.dev, „Lifecycle of
  // Reactive Effects": „Each Effect in your code should represent a separate and
  // independent synchronization process"). Produkt závisí jen na `slug`, takže se
  // při přepnutí strany už znovu nenačítá — dřív to byly 2 dotazy na stranu
  // místo 1 (audit T-7).
  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const found = await fetchProductForReviews(slug);
        if (!isMounted) return;
        setProductResult(found ? { slug, status: 'found', product: found } : { slug, status: 'notFound' });
      } catch (err) {
        if (isMounted) setProductResult({ slug, status: 'error' });
        reportLoadError(err);
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- fire-and-forget load v useEffect
    load();
    return () => {
      isMounted = false;
    };
  }, [slug]);

  const productId = product?.id;
  useEffect(() => {
    if (reviewsKey === null || productId === undefined) return;
    let isMounted = true;
    async function load(key: string, forProduct: string) {
      try {
        const result = await fetchApprovedReviews({
          productId: forProduct,
          limit: REVIEWS_PAGE_SIZE,
          offset: (page - 1) * REVIEWS_PAGE_SIZE,
          withProduct: false,
        });
        if (isMounted) setReviewsResult({ key, productId: forProduct, status: 'ok', reviews: result.reviews });
      } catch (err) {
        if (isMounted) setReviewsResult({ key, productId: forProduct, status: 'error' });
        reportLoadError(err);
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- fire-and-forget load v useEffect
    load(reviewsKey, productId);
    return () => {
      isMounted = false;
    };
  }, [reviewsKey, productId, page]);

  // Ani jedna z těchhle dvou větví nevykreslí Layout s `ready`, takže je prerender
  // neuloží — `waitForSelector('[data-prerender-ready]')` vyprší a build spadne.
  // Je to ZÁMĚR: obě jsou během buildu dosažitelné jen závodem (produkt se deaktivuje
  // nebo mu ubudou recenze mezi načtením seznamu rout a návštěvou stránky). Hlasitý
  // pád je lepší než tiše nasazená 404 nebo přesměrování na platné adrese.
  if (productLoaded?.status === 'notFound') return <NotFound />;
  // `replace`, aby se neplatná adresa nezanesla do historie prohlížeče. Pozor: je to
  // history.replaceState, ne `window.location` — Googlebot to nevidí jako přesměrování,
  // ale jako obsah pod PŮVODNÍ adresou. Proto tyhle adresy nikde neodkazujeme ani
  // nedáváme do sitemapy; kanonickou stranu pak označí `canonical` cílové stránky.
  //
  // Nemá smysl sem přidávat <meta name="robots" content="noindex">: React 19 by ji
  // sice zvedl do <head>, ale `Navigate` komponentu hned odmountuje a značka zmizí
  // dřív, než ji renderující crawler stihne vidět (ověřeno spuštěním).
  if (redirectTo) return <Navigate to={redirectTo} replace />;

  // Kolik recenzí smíme TVRDIT. `count` je agregát z jiného dotazu; když se rozejde
  // se skutečně vrácenými recenzemi, nesmí stránka zároveň psát „zatím nemá recenzi"
  // a ukazovat souhrn ze dvanácti. Stránkování zůstává na `count` schválně —
  // prázdný stav pagination stejně nevykresluje a přepočet by hnul přesměrováním.
  const effectiveCount = reviews.length > 0 ? count : 0;
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
        {/* Nahradilo odkaz „← Zpět na průvodce“ na tomtéž místě v DOMu. Cestu bere
            z `productReviewsCrumbs` — z TÉŽE funkce, ze které `buildProductReviewsMeta`
            skládá `BreadcrumbList`, takže markup nemůže popisovat jinou cestu, než
            jaká je vidět. Google to zakazuje („Don't mark up content that is not
            visible to readers of the page“).
            Dokud se produkt načítá, `product` je null a položka s názvem průvodce
            vypadne — v tu chvíli ale neexistuje ani `meta`, tedy ani JSON-LD. */}
        <Breadcrumbs crumbs={productReviewsCrumbs(product)} />

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
          {/* Tatáž funkce skládá i `<title>` v `buildProductReviewsMeta`. */}
          {productReviewsHeading(product)}
        </h1>

        {/* Souhrn se řídí `effectiveCount`, ne `review_count` — jinak by nad prázdným
            stavem svítilo „5,0 · 12 recenzí". Tentýž důvod jako v `buildProductReviewsMeta`. */}
        {product && effectiveCount > 0 && (
          <ProductRatingSummary average={product.average_rating ?? 0} count={effectiveCount} className="mb-4" />
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
              buildHref={(target) => productReviewsPath(slug, target)}
              className="mt-10"
            />
          </>
        )}
      </div>
    </Layout>
  );
};

export default ProductReviewsPage;
