import { supabase } from './supabase';

const CARD_FIELDS = 'id, title, slug, excerpt, image_url, published_at, tag_ids';
const FULL_FIELDS =
  'id, title, slug, excerpt, image_url, content, seo_title, seo_description, published_at, updated_at, tag_ids, created_at';

const nowIso = () => new Date().toISOString();

/** Publikované články pro výpis (nejnovější první). */
export async function fetchPublishedPosts() {
  const { data, error } = await supabase
    .from('blog_posts')
    .select(CARD_FIELDS)
    .not('published_at', 'is', null)
    .lte('published_at', nowIso())
    .order('published_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Jeden publikovaný článek podle slug (null, když není). */
export async function fetchPostBySlug(slug) {
  const { data, error } = await supabase
    .from('blog_posts')
    .select(FULL_FIELDS)
    .eq('slug', slug)
    .not('published_at', 'is', null)
    .lte('published_at', nowIso())
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Všechny tagy (id, name, slug). */
export async function fetchTags() {
  const { data, error } = await supabase
    .from('blog_tags')
    .select('id, name, slug')
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Související publikované články se sdíleným tagem (kromě aktuálního). */
export async function fetchRelatedPosts(tagIds, excludeId, limit = 3) {
  if (!tagIds || tagIds.length === 0) return [];
  const { data, error } = await supabase
    .from('blog_posts')
    .select(CARD_FIELDS)
    .not('published_at', 'is', null)
    .lte('published_at', nowIso())
    .overlaps('tag_ids', tagIds)
    .neq('id', excludeId)
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Množina slugů produktů, které reálně existují (pro bezpečné CTA). */
export async function fetchExistingProductSlugs(slugs) {
  const unique = [...new Set(slugs)].filter(Boolean);
  if (unique.length === 0) return new Set();
  const { data, error } = await supabase
    .from('products')
    .select('slug')
    .in('slug', unique)
    .eq('is_deleted', false);
  if (error) throw error;
  return new Set((data ?? []).map((p) => p.slug));
}

/** Náhled konceptu přes Edge funkci (service-role, token-gated). */
export async function fetchPreviewPost(slug, token) {
  const base = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const res = await fetch(`${base}/functions/v1/get-blog-preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    body: JSON.stringify({ slug, token }),
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => ({}));
  return json.post ?? null;
}
