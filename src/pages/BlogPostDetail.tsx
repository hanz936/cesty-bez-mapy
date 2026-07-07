import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { Button } from '../components/ui';
import { ROUTES } from '../constants';
import {
  fetchPostBySlug,
  fetchPreviewPost,
  fetchRelatedPosts,
  fetchTags,
  fetchExistingProductSlugs,
  tagNameMap,
} from '../lib/blog';
import { readingTimeMinutes, extractProductSlugs } from '../utils/blogContent';
import { buildBlogMeta } from '../utils/blogSeo';
import BlogContentRenderer from '../components/blog/BlogContentRenderer';
import SeoTags from '../components/common/SeoTags';

type BlogPost = NonNullable<Awaited<ReturnType<typeof fetchPostBySlug>>>;
type BlogTag = Awaited<ReturnType<typeof fetchTags>>[number];
type RelatedPost = Awaited<ReturnType<typeof fetchRelatedPosts>>[number];

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

const BlogPostDetail = () => {
  // react-router's useParams() types every value as `string | undefined` (params are
  // inherently dynamic to the type system); the INSPIRATION_DETAIL route ('/inspirace/:slug')
  // guarantees `slug` is present whenever this component renders, so it is asserted here
  // (no runtime check existed before, none added).
  const { slug } = useParams() as { slug: string };
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isPreview = searchParams.get('preview') === '1';
  const previewToken = searchParams.get('token');

  const [post, setPost] = useState<BlogPost | null>(null);
  const [tags, setTags] = useState<BlogTag[]>([]);
  const [related, setRelated] = useState<RelatedPost[]>([]);
  const [validProductSlugs, setValidProductSlugs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { window.scrollTo(0, 0); }, [slug]);

  useEffect(() => {
    let isMounted = true;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- pre-existing fire-and-forget async IIFE inside useEffect (useEffect callbacks can't be async)
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data =
          isPreview && previewToken
            ? await fetchPreviewPost(slug, previewToken)
            : await fetchPostBySlug(slug);
        if (!isMounted) return;
        if (!data) {
          setError('Článek nebyl nalezen.');
          return;
        }
        setPost(data);

        const [tagsData, relatedData, productSlugs] = await Promise.all([
          fetchTags(),
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' kept unchanged (tag_ids is never falsy other than null; equivalent to ??, not rewritten per convention)
          fetchRelatedPosts(data.tag_ids || [], data.id),
          fetchExistingProductSlugs(extractProductSlugs(data.content || '')),
        ]);
        if (!isMounted) return;
        setTags(tagsData);
        setRelated(relatedData);
        setValidProductSlugs(productSlugs);
      } catch (err) {
        if (!isMounted) return;
        console.error('Chyba načítání článku:', err);
        setError('Článek se nepodařilo načíst.');
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, [slug, isPreview, previewToken]);

  const tagNameById = useMemo(() => tagNameMap(tags), [tags]);

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-700 mb-4"></div>
            <p className="text-gray-600">Načítám článek…</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !post) {
    return (
      <Layout>
        <div className="min-h-screen bg-white flex items-center justify-center px-4">
          <div className="max-w-md text-center">
            <div className="mb-6"><span className="text-6xl">😔</span></div>
            {/* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' kept unchanged (error is never empty-string in practice; equivalent to ??, not rewritten per convention) */}
            <h1 className="text-2xl font-bold text-gray-900 mb-4">{error || 'Článek nebyl nalezen'}</h1>
            {/* eslint-disable-next-line @typescript-eslint/no-misused-promises -- react-router NavigateFunction returns void | Promise<void>; onClick expects void, fire-and-forget navigation is the pre-existing JS behavior */}
            <Button onClick={() => navigate(ROUTES.INSPIRATION)} variant="green" size="lg">
              Zpět na inspiraci
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const meta = buildBlogMeta(post);
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' kept unchanged (tag_ids is never falsy other than null; equivalent to ??, not rewritten per convention)
  const postTagNames = (post.tag_ids || []).map((id) => tagNameById.get(id)).filter(Boolean);
  const minutes = readingTimeMinutes(post.content);

  return (
    <Layout>
      <SeoTags meta={meta} type="article" />

      {isPreview && (
        <div className="bg-yellow-100 border-b border-yellow-300 text-yellow-900 text-sm text-center py-2 px-4">
          Náhled konceptu — tento článek {post.published_at ? 'je publikovaný' : 'ještě není veřejně publikovaný'}.
        </div>
      )}

      <main className="min-h-screen bg-white" data-prerender-ready="true">
        {post.image_url && (
          <div
            className="w-full h-64 sm:h-80 bg-center bg-cover"
            style={{ backgroundImage: `url("${encodeURI(post.image_url)}")` }}
            role="img"
            aria-label={post.title}
          />
        )}

        <article className="max-w-2xl mx-auto px-5 py-10">
          <nav className="mb-6">
            <Link to={ROUTES.INSPIRATION} className="text-sm text-gray-600 hover:text-green-700">
              ← Inspirace na cesty
            </Link>
          </nav>

          <div className="text-xs text-gray-500 mb-2">
            {formatDate(post.published_at)} · ⏱ {minutes} min čtení
          </div>
          {postTagNames.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {postTagNames.map((name) => (
                <span key={name} className="bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full text-xs">
                  #{name}
                </span>
              ))}
            </div>
          )}
          <h1 className="text-3xl sm:text-4xl font-bold text-black leading-tight mb-6">{post.title}</h1>

          <BlogContentRenderer html={post.content} validProductSlugs={validProductSlugs} />
        </article>

        {related.length > 0 && (
          <section className="max-w-4xl mx-auto px-5 pb-16">
            <hr className="border-gray-200 mb-8" />
            <h2 className="text-sm text-gray-500 mb-4">Mohlo by se ti líbit</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {related.map((r) => (
                <Link
                  key={r.id}
                  to={`/inspirace/${r.slug}`}
                  className="card-base card-hover flex flex-col cursor-pointer group no-underline"
                >
                  <div className="relative w-full h-36 overflow-hidden">
                    {r.image_url ? (
                      <img src={r.image_url} alt={r.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full bg-green-100" />
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="text-sm font-medium text-black line-clamp-3">{r.title}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </Layout>
  );
};
BlogPostDetail.displayName = 'BlogPostDetail';

export default BlogPostDetail;
