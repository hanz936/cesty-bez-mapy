import { describe, it, expect } from 'vitest';
import {
  buildProductMeta,
  buildProductReviewsMeta,
  productDetailCrumbs,
  productDisplayName,
  productReviewsCrumbs,
} from './productSeo';

const product = {
  title: 'Toskánsko průvodce',
  detail_title: 'Toskánsko: kompletní průvodce',
  hero_subtitle: 'Vše, co potřebuješ pro cestu do Toskánska.',
  slug: 'toskansko',
  price: 349,
  image_url: 'https://cdn.example/tos.jpg',
};

describe('buildProductMeta', () => {
  it('skládá title/description/canonical/ogImage', () => {
    const m = buildProductMeta(product, undefined, 'https://x.cz');
    expect(m.title).toBe('Toskánsko: kompletní průvodce');
    expect(m.description).toBe('Vše, co potřebuješ pro cestu do Toskánska.');
    expect(m.canonical).toBe('https://x.cz/cestovni-pruvodci/toskansko');
    expect(m.ogImage).toBe('https://cdn.example/tos.jpg');
  });
  it('JSON-LD je validní Product s Offer (celé CZK, CZK měna)', () => {
    const m = buildProductMeta(product, undefined, 'https://x.cz');
    expect(m.jsonLd['@type']).toBe('Product');
    // `name` nese to, co uživatel VIDÍ (`detail_title`) — `product.title` je interní
    // pojmenování, které se na detailu nikde nevykresluje.
    expect(m.jsonLd.name).toBe('Toskánsko: kompletní průvodce');
    expect(m.jsonLd.image).toEqual(['https://cdn.example/tos.jpg']);
    expect(m.jsonLd.offers.price).toBe('349');
    expect(m.jsonLd.offers.priceCurrency).toBe('CZK');
    expect(m.jsonLd.offers.availability).toBe('https://schema.org/InStock');
    expect(m.jsonLd.offers.url).toBe('https://x.cz/cestovni-pruvodci/toskansko');
  });
  // `''` je důvod, proč builder používá `||`, ne `??` — sloupec je nullable text bez
  // CHECKu. Bez toho případu by „úklid" na `??` prošel sadou (audit T-4, ověřeno mutací).
  it.each([null, ''])('fallback obrázku, když image_url je %j', (imageUrl) => {
    const m = buildProductMeta({ ...product, image_url: imageUrl }, undefined, 'https://x.cz');
    expect(m.ogImage).toBe('https://x.cz/images/placeholder-guide.jpg');
    expect(m.jsonLd.image).toEqual(['https://x.cz/images/placeholder-guide.jpg']);
  });
});

const PRODUCT = {
  detail_title: 'Salzburg na víkend',
  title: 'Salzburg',
  hero_subtitle: 'Víkendový itinerář',
  slug: 'salzburg-vikend',
  image_url: null,
  price: 499,
};

describe('buildProductMeta aggregateRating', () => {
  it('bez recenzí JSON-LD neobsahuje aggregateRating ani review', () => {
    const meta = buildProductMeta(PRODUCT);
    expect('aggregateRating' in meta.jsonLd).toBe(false);
    expect('review' in meta.jsonLd).toBe(false);
  });

  it('s recenzemi přidá aggregateRating + review', () => {
    const meta = buildProductMeta(PRODUCT, {
      rating: { average: 4.5, count: 2 },
      reviews: [
        { author: 'Jana N.', rating: 5, text: 'Skvělý průvodce.', datePublished: '2026-07-01' },
        { author: 'Petr K.', rating: 4, text: 'Moc pomohl s plánem.', datePublished: '2026-06-15' },
      ],
    });
    expect(meta.jsonLd.aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: '4.5',
      reviewCount: 2,
    });
    expect(meta.jsonLd.review).toHaveLength(2);
    expect(meta.jsonLd.review?.[0]).toEqual({
      '@type': 'Review',
      author: { '@type': 'Person', name: 'Jana N.' },
      reviewRating: { '@type': 'Rating', ratingValue: '5' },
      reviewBody: 'Skvělý průvodce.',
      datePublished: '2026-07-01',
    });
  });

  it('rating.count === 0 markup nepřidá', () => {
    const meta = buildProductMeta(PRODUCT, { rating: { average: 0, count: 0 }, reviews: [] });
    expect('aggregateRating' in meta.jsonLd).toBe(false);
  });

  it('ratingValue zaokrouhlí dvoumístný DB průměr na jedno desetinné místo', () => {
    // Schválně NENÍ 4.5 jako jinde v souboru: `String(4.5)` a `ratingValueJsonLd(4.5)`
    // vrátí totéž, takže by test prošel i beze skutečné opravy zaokrouhlení.
    const meta = buildProductMeta(PRODUCT, { rating: { average: 4.67, count: 3 }, reviews: [] });
    expect(meta.jsonLd.aggregateRating?.ratingValue).toBe('4.7');
  });
});

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

describe('productDisplayName', () => {
  it('detail_title null spadne na title', () => {
    expect(productDisplayName({ detail_title: null, title: 'Roadtrip po Itálii' })).toBe('Roadtrip po Itálii');
  });

  it('detail_title jen z mezer spadne na title (`??` by tenhle případ nezachytilo)', () => {
    expect(productDisplayName({ detail_title: '   ', title: 'Roadtrip po Itálii' })).toBe('Roadtrip po Itálii');
  });
});

describe('buildProductReviewsMeta', () => {
  // Stejné pravidlo jako u `buildProductMeta` výš — a stejná mutace by ho jinak tiše vrátila.
  it.each([null, ''])('fallback obrázku, když image_url je %j', (imageUrl) => {
    const meta = buildProductReviewsMeta(
      { ...REVIEWS_PRODUCT, image_url: imageUrl },
      { page: 1, reviews: reviewsFixture },
      'https://x.cz',
    );
    expect(meta.ogImage).toBe('https://x.cz/images/placeholder-guide.jpg');
    expect(meta.jsonLd?.image).toEqual(['https://x.cz/images/placeholder-guide.jpg']);
  });

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
    // DB drží průměr na 12 desetinných míst (třeba 4.666666666667); souhrn na stránce zobrazí 4,7.
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

  it('nevydá aggregateRating ani index, když strana žádnou recenzi nezobrazuje', () => {
    // Závod: `review_count` říká 12, ale dotaz na recenze vrátil prázdno (moderace
    // nebo refund mezi oběma dotazy). Stránka pak VIDITELNĚ píše „zatím nemá recenzi".
    // Kdyby se markup držel `review_count`, tvrdil by strojově pravý opak a prerender
    // by ten rozpor zapekl do statického HTML. Google: „Don't mark up content that is
    // not visible to readers of the page."
    const meta = buildProductReviewsMeta(REVIEWS_PRODUCT, { page: 1, reviews: [] }, 'https://x.cz');

    expect(meta.jsonLd).toBeUndefined();
    expect(meta.robots).toBe('noindex');
    expect(meta.description).toMatch(/zatím nemá recenzi/);
  });

  it('se recenzemi noindex nenastavuje', () => {
    const meta = buildProductReviewsMeta(REVIEWS_PRODUCT, { page: 1, reviews: reviewsFixture }, 'https://x.cz');
    expect(meta.robots).toBeUndefined();
  });

  it('titulek a canonical se shodnou i pro neceločíselnou stranu', () => {
    // page 2.5 není platná strana — sdílený `isPagedPage` predikát ji musí v obou
    // místech (canonical i titulek) vyhodnotit stejně jako „nestránkovaná".
    const meta = buildProductReviewsMeta(REVIEWS_PRODUCT, { page: 2.5, reviews: reviewsFixture }, 'https://x.cz');
    expect(meta.title).toBe('Recenze — Roadtrip po Itálii na 20 dní');
    expect(meta.canonical).toBe('https://x.cz/cestovni-pruvodci/italie-roadtrip/recenze');
  });
});

describe('BreadcrumbList (audit M-2)', () => {
  // Pravidlo, které tyhle testy hlídají: markup smí popisovat jen cestu, kterou
  // uživatel na stránce VIDÍ. Google: „Don't mark up content that is not visible
  // to readers of the page." Proto se všude porovnává JSON-LD proti `*Crumbs()` —
  // proti téže funkci, ze které se vykresluje viditelná drobečková navigace.

  it('detail nese dvě položky: výpis průvodců a sám sebe', () => {
    // Obojí je na detailu vidět — tlačítko „Cestovní průvodci" a název v <h1>.
    // Dvě položky jsou zároveň Googlem požadované minimum.
    const meta = buildProductMeta(product, undefined, 'https://x.cz');
    expect(meta.breadcrumbJsonLd['@type']).toBe('BreadcrumbList');
    expect(meta.breadcrumbJsonLd.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Cestovní průvodci',
        item: 'https://x.cz/cestovni-pruvodci',
      },
      { '@type': 'ListItem', position: 2, name: 'Toskánsko: kompletní průvodce' },
    ]);
  });

  it('detail: poslední položka nese TÝŽ název jako <h1>, ne interní title', () => {
    const meta = buildProductMeta(product, undefined, 'https://x.cz');
    const last = meta.breadcrumbJsonLd.itemListElement.at(-1);
    expect(last?.name).toBe(productDisplayName(product));
    expect(last?.name).not.toBe(product.title);
  });

  it('stránka recenzí nese tři položky a prostřední odkazuje na detail', () => {
    const meta = buildProductReviewsMeta(REVIEWS_PRODUCT, { page: 1, reviews: reviewsFixture }, 'https://x.cz');
    expect(meta.breadcrumbJsonLd.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Cestovní průvodci',
        item: 'https://x.cz/cestovni-pruvodci',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Roadtrip po Itálii na 20 dní',
        item: 'https://x.cz/cestovni-pruvodci/italie-roadtrip',
      },
      { '@type': 'ListItem', position: 3, name: 'Recenze' },
    ]);
  });

  it('strana 2 má TOTÉŽ pořadí položek — poslední bez `item`, takže ukazuje sama na sebe', () => {
    // Kdyby poslední položka `item` měla, mířila by na stranu 1 a odporovala by
    // canonicalu strany 2, který ukazuje sám na sebe.
    const page1 = buildProductReviewsMeta(REVIEWS_PRODUCT, { page: 1, reviews: reviewsFixture }, 'https://x.cz');
    const page2 = buildProductReviewsMeta(REVIEWS_PRODUCT, { page: 2, reviews: reviewsFixture }, 'https://x.cz');
    expect(page2.breadcrumbJsonLd).toEqual(page1.breadcrumbJsonLd);
    expect(page2.breadcrumbJsonLd.itemListElement.at(-1)).not.toHaveProperty('item');
    expect(page2.canonical).toBe('https://x.cz/cestovni-pruvodci/italie-roadtrip/recenze/strana/2');
  });

  it('markup nese PŘESNĚ to, co vykreslí viditelná navigace', () => {
    // Tenhle test je smyslem celého nálezu M-2. Kdyby někdo změnil jen jednu ze
    // dvou stran, spadne to tady.
    const meta = buildProductReviewsMeta(REVIEWS_PRODUCT, { page: 1, reviews: reviewsFixture }, 'https://x.cz');
    expect(meta.breadcrumbJsonLd.itemListElement.map((i) => i.name)).toEqual(
      productReviewsCrumbs(REVIEWS_PRODUCT).map((c) => c.name),
    );
    const detail = buildProductMeta(product, undefined, 'https://x.cz');
    expect(detail.breadcrumbJsonLd.itemListElement.map((i) => i.name)).toEqual(
      productDetailCrumbs(product).map((c) => c.name),
    );
  });

  it('produkt bez recenzí breadcrumb MÁ, i když Product JSON-LD ne', () => {
    // Navigace je na stránce vidět vždycky, takže markup je vždycky pravdivý —
    // na rozdíl od `Product`, který bez recenzí nemá čím být platný.
    const meta = buildProductReviewsMeta(REVIEWS_PRODUCT, { page: 1, reviews: [] }, 'https://x.cz');
    expect(meta.jsonLd).toBeUndefined();
    expect(meta.robots).toBe('noindex');
    expect(meta.breadcrumbJsonLd.itemListElement).toHaveLength(3);
  });

  it('bez načteného produktu vypadne prostřední položka, ne prázdný název', () => {
    // Stav během načítání stránky recenzí. Dvě položky = pořád nad Googlem
    // požadovaným minimem, a prázdný řádek se nikde neukáže.
    expect(productReviewsCrumbs(null)).toEqual([
      { name: 'Cestovní průvodci', path: '/cestovni-pruvodci' },
      { name: 'Recenze' },
    ]);
  });
});
