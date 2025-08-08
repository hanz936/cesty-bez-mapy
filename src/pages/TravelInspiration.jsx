import React, { useState, useCallback } from 'react';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import logger from '../utils/logger';

class TravelInspirationErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('TravelInspiration Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Něco se pokazilo
            </h1>
            <p className="text-gray-600 mb-6">
              Stránka se nedá načíst. Zkuste prosím obnovit stránku.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
            >
              Obnovit stránku
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

TravelInspirationErrorBoundary.displayName = 'TravelInspirationErrorBoundary';

// Blog data podle vzoru
const BLOG_POSTS = [
  {
    id: 1,
    title: 'Kam na víkend? 10 tipů na místa, kde si odpočineš i zažiješ něco nového',
    tag: '#víkend',
    excerpt: 'Nemáš dovolenou, ale potřebuješ vypadnout? Připravila jsem 10 mých oblíbených destinací v Česku i Evropě, kam si můžeš odskočit na víkend – a přitom si to opravdu užít. Ať už hledáš klid, výhledy, kavárny nebo městskou atmosféru, najdeš tu přesně to, co potřebuješ. Stačí sbalit batoh a vyrazit.',
    image: '/cesty-bez-mapy/images/blog1.png',
    alt: 'Fotka s popisem užij si víkend',
    link: '/blog/article1'
  },
  {
    id: 2,
    title: 'Lago di Garda v létě je krásné, ale mimo sezónu je kouzelné',
    tag: '#itálie',
    excerpt: 'Ticho, světlo, atmosféra a klid, který ti v červenci nenabídne. V článku ti ukážu, proč jaro a podzim u italského jezera dávají cestování úplně jiný rozměr.',
    image: '/cesty-bez-mapy/images/blog2.png',
    alt: 'Fotka z Lago di Garda',
    link: '/blog/article2'
  },
  {
    id: 3,
    title: 'Cestování s lehkým kufrem či batohem je radost',
    tag: '#cestování',
    excerpt: 'V tomhle článku ti ukážu, jak balím minimalisticky, ale chytře – tak, abych měla vše, co potřebuju, ale nemusela se tahat s věcmi, které stejně zůstanou na dně kufru.',
    image: '/cesty-bez-mapy/images/blog3.png',
    alt: 'Fotka balení kufru',
    link: '/blog/article3'
  },
  {
    id: 4,
    title: 'Cestování bez cestovky? Proč ne!',
    tag: '#cestování',
    excerpt: 'Pokud víš, co si zjistit a jak začít plánovat, čeká tě spousta svobody a nezapomenutelných zážitků. Článek ti ukáže, jak se připravit, abys mohl/a jet na vlastní pěst bez stresu.',
    image: '/cesty-bez-mapy/images/blog4.png',
    alt: 'Ukázka mapy světa s různými věcmi položenými na ní',
    link: '/blog/article4'
  },
  {
    id: 5,
    title: 'Koupila jsem letenku jen pro sebe. Do Paříže. A změnilo mi to život.',
    tag: '#paříž',
    excerpt: 'V článku sdílím, co mi moje první sólo cesta dala – odvahu, klid a pocit, že sama sobě dokážu být tím nejlepším parťákem.',
    image: '/cesty-bez-mapy/images/blog5.png',
    alt: 'Fotka z Paříže s pohledem na Eifelovu věž',
    link: '/blog/article5'
  },
  {
    id: 6,
    title: 'Cestování není jen o fotkách s výhledem',
    tag: '#cestování',
    excerpt: 'Taky o promočeném stanu, staveništi místo ubytování a mořském ježkovi, kterého opravdu nechceš potkat. Tady jsou moje příběhy, kdy šlo všechno jinak – a přesto (nebo právě proto) nezapomenutelně.',
    image: '/cesty-bez-mapy/images/blog6.png',
    alt: 'Fotka z Paříže s pohledem na Eifelovu věž',
    link: '/blog/article6'
  }
];

const BlogCard = ({ post, onCardClick }) => {
  const [imageError, setImageError] = useState(false);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  const handleCardClick = useCallback(() => {
    onCardClick(post);
  }, [post, onCardClick]);

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col transition-all duration-300 ease-in-out hover:transform hover:-translate-y-1.5 hover:shadow-2xl border border-gray-100 min-h-[672px] max-h-[672px] cursor-pointer group"
         onClick={handleCardClick}>
      
      {/* Image Section */}
      <div className="relative w-full h-60 flex-shrink-0 overflow-hidden">
        {!imageError ? (
          <img 
            src={post.image} 
            alt={post.alt}
            className="w-full h-full object-cover"
            onError={handleImageError}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
            <span className="text-green-800 text-4xl font-bold">?</span>
          </div>
        )}
        
        {/* Tag Overlay */}
        <span className="absolute top-3 left-3 bg-white/60 backdrop-blur-sm text-gray-800 text-xs font-semibold px-2.5 py-1.5 rounded-full uppercase tracking-wider z-10">
          {post.tag}
        </span>
      </div>

      {/* Content Section */}
      <div className="p-7 flex flex-col flex-grow">
        <h3 className="text-lg font-medium text-gray-900 mb-2 leading-snug line-clamp-3 group-hover:text-green-800 transition-colors duration-200">
          {post.title}
        </h3>
        
        {/* Separator */}
        <div className="w-[70px] h-0.5 bg-gradient-to-r from-green-800 to-green-600 mx-auto my-3 rounded-full group-hover:w-[100px] transition-all duration-300 ease-in-out"></div>
        
        <p className="text-sm text-gray-600 leading-relaxed mt-2 line-clamp-8 flex-grow">
          {post.excerpt}
        </p>
        
        {/* Read More Button */}
        <button className="inline-block self-start mt-auto py-2 px-5 bg-green-800 text-white text-sm rounded transition-colors duration-300 hover:bg-green-900 supports-hover:focus-visible:ring-2 supports-hover:focus-visible:ring-green-600 supports-hover:focus-visible:ring-offset-2 focus:outline-none">
          Přečti si celý článek
        </button>
      </div>
    </div>
  );
};

BlogCard.displayName = 'BlogCard';

const TravelInspiration = () => {
  const [selectedPost, setSelectedPost] = useState(null);

  const handleCardClick = useCallback((post) => {
    // Pro teď jen console log, později routing
    console.log('Opening article:', post.title);
    setSelectedPost(post);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      
      {/* Hero Section */}
      <section 
        className="relative text-center py-24 px-5 bg-cover bg-center bg-no-repeat text-white overflow-hidden"
        style={{
          backgroundImage: 'url(/cesty-bez-mapy/images/blog-hero.jpg)'
        }}
      >
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/50 z-0"></div>
        
        {/* Content */}
        <div className="relative z-10">
          <h1 className="text-5xl font-bold mb-5">Inspirace na cesty</h1>
          <p className="text-xl max-w-3xl mx-auto text-gray-200">
            Hledáš tipy na víkend, útěk z města nebo malé dobrodružství? Tady najdeš články plné nápadů, pro cesty v Česku i Evropě.
          </p>
        </div>
      </section>

      {/* Blog Grid */}
      <section className="py-16 px-5 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {BLOG_POSTS.map((post) => (
            <BlogCard 
              key={post.id} 
              post={post} 
              onCardClick={handleCardClick}
            />
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
};

TravelInspiration.displayName = 'TravelInspiration';

const TravelInspirationWithErrorBoundary = () => (
  <TravelInspirationErrorBoundary>
    <TravelInspiration />
  </TravelInspirationErrorBoundary>
);

TravelInspirationWithErrorBoundary.displayName = 'TravelInspirationWithErrorBoundary';

export default TravelInspirationWithErrorBoundary;