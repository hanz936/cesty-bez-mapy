/** Sdílené REST dotazy na publikované slugy (prerender + sitemap). Node prostředí. */

/**
 * Řádek `blog_posts`, jak ho vrací dotaz ve `fetchBlogSlugs`.
 * @typedef {{ slug: string }} BlogSlugRow
 */

/**
 * Řádek `products` z `fetchProductSlugs`. `review_count` je volitelný i nullable:
 * PostgREST ho u produktu bez recenzí vrací jako null a `reviewPageRange` s tím počítá.
 * @typedef {{ slug: string, review_count?: number | null }} ProductSlugRow
 */

function supabaseEnv() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Chybí VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
  return { url, key };
}

/**
 * Adresa Supabase projektu. Prerender podle ní pouští požadavky stránek — viz
 * `createPrerenderPage`.
 * @returns {string}
 */
export function supabaseUrl() {
  return supabaseEnv().url;
}

/**
 * @template T
 * @param {string} path REST cesta včetně query (bez `/rest/v1/` prefixu)
 * @returns {Promise<T>}
 */
async function getJson(path) {
  const { url, key } = supabaseEnv();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} (${path})`);
  // `res.json()` je podle typů Promise<unknown> — tvar odpovídá `select=` v dotazu
  // a hlídají ho volající přes svůj @returns, ne runtime validace.
  return /** @type {Promise<T>} */ (res.json());
}

/** @returns {Promise<BlogSlugRow[]>} */
export function fetchBlogSlugs() {
  return getJson(
    `blog_posts?select=slug&published_at=not.is.null&published_at=lte.${new Date().toISOString()}`,
  );
}

/**
 * Aktivní produkty pro prerender, sitemapu a routy recenzí.
 *
 * Prázdná odpověď je tvrdá chyba, ne platný výsledek. `getJson` vyhodí jen na
 * `!res.ok`, takže `200 []` (změna RLS pro anon roli, hromadná deaktivace,
 * výpadek schema-cache PostgRESTu) projde jako legitimní data a celý zbytek
 * řetězu — `collectRoutes` → prerender → sitemapa → `verify-dist` — se prostě
 * dohodne na menším světě a ohlásí úspěch. Vznikl by zelený build, který nasadí
 * web bez jediné stránky produktu, a sitemapa ty adresy Googlu oznámí jako
 * smazané.
 *
 * Když build spadne, produkce zůstane na poslední funkční verzi — což je proti
 * tichému přepsání ochozeným webem ta výrazně lepší z obou možností.
 *
 * Blog tuhle mez schválně NEMÁ: web bez jediného článku je legitimní stav
 * (a chvíli jím opravdu byl), kdežto e-shop bez jediného produktu ne.
 *
 * @returns {Promise<ProductSlugRow[]>}
 */
export async function fetchProductSlugs() {
  // `review_count` je potřeba pro routy recenzí (počet stran) — viz prerender.mjs.
  /** @type {ProductSlugRow[]} */
  const products = await getJson(
    'products?select=slug,review_count&is_active=eq.true&is_deleted=eq.false',
  );
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error(
      'Supabase vrátila 0 aktivních produktů. E-shop bez jediného produktu není platný stav buildu — ' +
        'zastavuji, aby nasazení nepřepsalo funkční web ochozenou verzí. Zkontroluj products (is_active, is_deleted) a RLS pro anon roli.',
    );
  }
  return products;
}
