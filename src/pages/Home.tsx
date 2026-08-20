import { SITE_URL } from '../utils/blogSeo';
import Navigation from '../components/layout/Navigation';
import Hero from '../components/common/Hero';

const TITLE = 'Cesty (bez) mapy - Cestovní itineráře a inspirace na cesty';
const DESCRIPTION =
  'Místo, kde najdeš inspiraci, itineráře i tipy na místa, která se do běžných průvodců nevešla. Přidej se a nech se vést světem.';

const Home = () => {
  return (
    <div className="min-h-screen bg-white" data-prerender-ready="true">
      {/* Meta homepage patří sem, ne do index.html: ta šablona slouží i jako SPA
          skořápka, takže by ji dostala každá adresa, která projde rewritem.
          React 19 tyhle značky zvedne do <head> sám.

          Home schválně nepoužívá SeoTags — ta komponenta staví na per-route meta
          objektu (`ProductMeta` a spol.), zatímco homepage má vlastní ručně psané
          texty a žádný takový objekt pro ni neexistuje. Navíc by k titulku připojila
          „ | Cesty bez mapy" a nevydala `twitter:image`, takže by přepsala meta,
          kterou tenhle task jen stěhuje. */}
      <title>{TITLE}</title>
      <meta name="description" content={DESCRIPTION} />
      <meta property="og:title" content={TITLE} />
      <meta property="og:description" content={DESCRIPTION} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={`${SITE_URL}/`} />
      <meta property="og:image" content={`${SITE_URL}/images/logo.png`} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={TITLE} />
      <meta
        name="twitter:description"
        content="Místo, kde najdeš inspiraci, itineráře i tipy na místa, která se do běžných průvodců nevešla."
      />
      <meta name="twitter:image" content={`${SITE_URL}/images/logo.png`} />
      <link rel="canonical" href={`${SITE_URL}/`} />
      <Navigation />
      <Hero />
    </div>
  );
};

Home.displayName = 'Home';

export default Home;
