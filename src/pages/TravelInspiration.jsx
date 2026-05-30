import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import PageHero from '../components/common/PageHero';
import { BASE_PATH } from '../constants';
import { fetchPublishedPosts, fetchTags } from '../lib/blog';

const BlogCard = ({ post, tagNames }) => {
  const [imageError, setImageError] = useState(false);
  return (
    <Link
      to={`/inspirace/${post.slug}`}
      className="card-base card-hover flex flex-col ease-in-out min-h-[672px] max-h-[672px] cursor-pointer group no-underline"
      aria-label={`Zobrazit článek: ${post.title}`}
    >
      <div className="relative w-full h-60 flex-shrink-0 overflow-hidden">
        {post.image_url && !imageError ? (
          <img
            src={post.image_url}
            alt={post.title}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
            loading="eager"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
            <span className="text-green-800 text-4xl font-bold">?</span>
          </div>
        )}
        {tagNames[0] && (
          <span className="absolute top-3 left-3 bg-white/60 backdrop-blur-sm text-gray-800 text-xs font-semibold px-2.5 py-1.5 rounded-full uppercase tracking-wider z-10">
            #{tagNames[0]}
          </span>
        )}
      </div>
      <div className="p-7 flex flex-col flex-grow">
        <h3 className="text-lg font-medium text-black mb-2 leading-snug line-clamp-3">
          {post.title}
        </h3>
        <div className="w-[70px] h-0.5 bg-gradient-to-r from-green-800 to-green-600 mx-auto my-3 rounded-full group-hover:w-[100px] transition-all duration-300 ease-in-out"></div>
        <p className="text-sm text-black leading-relaxed mt-2 flex-grow line-clamp-8">
          {post.excerpt}
        </p>
        <span className="self-start mt-auto inline-block bg-green-800 group-hover:bg-green-900 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          Přečti si celý článek
        </span>
      </div>
    </Link>
  );
};
BlogCard.displayName = 'BlogCard';

const TravelInspiration = () => {
  const [posts, setPosts] = useState([]);
  const [tags, setTags] = useState([]);
  const [activeTag, setActiveTag] = useState(null); // tag id nebo null
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [postsData, tagsData] = await Promise.all([fetchPublishedPosts(), fetchTags()]);
        if (!isMounted) return;
        setPosts(postsData);
        setTags(tagsData);
      } catch (err) {
        if (!isMounted) return;
        console.error('Chyba načítání článků:', err);
        setError('Články se nepodařilo načíst.');
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const tagNameById = useMemo(() => {
    const map = new Map();
    tags.forEach((t) => map.set(t.id, t.name));
    return map;
  }, [tags]);

  // Zobrazíme jen tagy, které mají aspoň jeden publikovaný článek.
  const usedTags = useMemo(() => {
    const used = new Set();
    posts.forEach((p) => (p.tag_ids || []).forEach((id) => used.add(id)));
    return tags.filter((t) => used.has(t.id));
  }, [posts, tags]);

  const visiblePosts = useMemo(
    () => (activeTag ? posts.filter((p) => (p.tag_ids || []).includes(activeTag)) : posts),
    [posts, activeTag],
  );

  const tagNamesFor = useCallback(
    (post) => (post.tag_ids || []).map((id) => tagNameById.get(id)).filter(Boolean),
    [tagNameById],
  );

  return (
    <Layout>
      <PageHero
        backgroundImage={`${BASE_PATH}/images/blog-hero.jpg`}
        title="Inspirace na cesty"
        subtitle="Hledáš tipy na víkend, útěk z města nebo malé dobrodružství? Tady najdeš články plné nápadů, pro cesty v Česku i Evropě."
        overlayOpacity={0.5}
        ariaLabel="Hero sekce s názvem stránky"
      />

      <main className="py-16 px-5 max-w-6xl mx-auto" role="main" aria-label="Seznam článků o cestování" style={{ overflowAnchor: 'none' }} {...(!loading ? { 'data-prerender-ready': 'true' } : {})}>
        {usedTags.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center mb-10">
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${activeTag === null ? 'bg-green-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Vše
            </button>
            {usedTags.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTag(t.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${activeTag === t.id ? 'bg-green-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                #{t.name}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="text-center py-20 text-gray-600">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-green-700 mb-4"></div>
            <p>Načítám články…</p>
          </div>
        )}

        {!loading && error && (
          <p className="text-center py-20 text-gray-600">{error}</p>
        )}

        {!loading && !error && visiblePosts.length === 0 && (
          <p className="text-center py-20 text-gray-600">Zatím tu nejsou žádné články. Brzy přibydou!</p>
        )}

        {!loading && !error && visiblePosts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {visiblePosts.map((post) => (
              <BlogCard key={post.id} post={post} tagNames={tagNamesFor(post)} />
            ))}
          </div>
        )}
      </main>
    </Layout>
  );
};
TravelInspiration.displayName = 'TravelInspiration';

export default TravelInspiration;
