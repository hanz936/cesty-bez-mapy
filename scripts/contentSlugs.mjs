/** Sdílené REST dotazy na publikované slugy (prerender + sitemap). Node prostředí. */
function supabaseEnv() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Chybí VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
  return { url, key };
}

async function getJson(path) {
  const { url, key } = supabaseEnv();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} (${path})`);
  return res.json();
}

export function fetchBlogSlugs() {
  return getJson(
    `blog_posts?select=slug&published_at=not.is.null&published_at=lte.${new Date().toISOString()}`,
  );
}

export function fetchProductSlugs() {
  // `review_count` je potřeba pro routy recenzí (počet stran) — viz prerender.mjs.
  return getJson('products?select=slug,review_count&is_active=eq.true&is_deleted=eq.false');
}
