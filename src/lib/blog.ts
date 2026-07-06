import { supabase } from './supabase';
import type { Tables } from '../types/database.types';

type BlogPostCard = Pick<
  Tables<'blog_posts'>,
  'id' | 'title' | 'slug' | 'excerpt' | 'image_url' | 'published_at' | 'tag_ids'
>;

type BlogPostFull = Pick<
  Tables<'blog_posts'>,
  | 'id'
  | 'title'
  | 'slug'
  | 'excerpt'
  | 'image_url'
  | 'content'
  | 'seo_title'
  | 'seo_description'
  | 'published_at'
  | 'updated_at'
  | 'tag_ids'
  | 'created_at'
>;

type BlogTagRow = Pick<Tables<'blog_tags'>, 'id' | 'name' | 'slug'>;

const CARD_FIELDS = 'id, title, slug, excerpt, image_url, published_at, tag_ids';
const FULL_FIELDS =
  'id, title, slug, excerpt, image_url, content, seo_title, seo_description, published_at, updated_at, tag_ids, created_at';

const nowIso = () => new Date().toISOString();

/** Publikované články pro výpis (nejnovější první). */
export async function fetchPublishedPosts(): Promise<BlogPostCard[]> {
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
export async function fetchPostBySlug(slug: string): Promise<BlogPostFull | null> {
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
export async function fetchTags(): Promise<BlogTagRow[]> {
  const { data, error } = await supabase
    .from('blog_tags')
    .select('id, name, slug')
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Související publikované články se sdíleným tagem (kromě aktuálního). */
export async function fetchRelatedPosts(
  tagIds: string[] | null | undefined,
  excludeId: string,
  limit = 3
): Promise<BlogPostCard[]> {
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
export async function fetchExistingProductSlugs(slugs: string[]): Promise<Set<string>> {
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
export async function fetchPreviewPost(slug: string, token: string): Promise<BlogPostFull | null> {
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
  // get-blog-preview Edge Function has no published TS types; the response is
  // asserted to the subset of fields this module reads (no runtime shape change,
  // same pattern as src/utils/ares.ts lookupIco).
  const json = (await res.json().catch(() => ({}))) as { post?: BlogPostFull | null };
  return json.post ?? null;
}

/** Mapa id → name z pole tagů (sdíleno výpisem i detailem). */
export function tagNameMap(
  tags: Pick<BlogTagRow, 'id' | 'name'>[] | null | undefined
): Map<string, string> {
  return new Map((tags ?? []).map((t) => [t.id, t.name]));
}
