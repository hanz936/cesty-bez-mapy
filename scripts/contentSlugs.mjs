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

/** @returns {Promise<ProductSlugRow[]>} */
export function fetchProductSlugs() {
  // `review_count` je potřeba pro routy recenzí (počet stran) — viz prerender.mjs.
  return getJson('products?select=slug,review_count&is_active=eq.true&is_deleted=eq.false');
}
