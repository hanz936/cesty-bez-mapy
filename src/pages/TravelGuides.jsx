import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import PageHero from '../components/common/PageHero';
import { Button } from '../components/ui';
import { BASE_PATH, ROUTES } from '../constants';


// Cestovní průvodce (testovací data)
const TOP_ITINERARIES = [
  {
    id: 1,
    title: 'Roadtrip po Itálii na 20 dní – kompletně naplánovaná cesta od severu až na jih',
    description: 'Od jezer na severu až po moře v Kalábrii. Navštívíš slavná místa jako Benátky, Řím, Cinque Terre, Amalfi, ale taky méně známé perly, které turisté často míjejí. A vše máš přehledně den po dni.',
    price: '699 Kč',
    duration: '20 dní',
    rating: 4.9,
    image: `${BASE_PATH}/images/guide-italy-roadtrip.png`,
    alt: 'Malebná italská krajina s cestou vedoucí mezi kopci',
    badge: 'Roadtrip',
    category: 'Dlouhodobé cesty'
  },
  {
    id: 2,
    title: 'Backpacking Dolomity – túry s noclehy v rifugio',
    description: 'Týdenní trek s batohem přes nejkrásnější vrcholy Dolomit. Tre Cime di Lavaredo, Seceda, Alpe di Siusi, nocleh v horských rifugio, mapy tras a tipy na balení. Pro milovníky hor a aktivního cestování.',
    price: '649 Kč',
    duration: '7 dní',
    rating: 4.8,
    image: `${BASE_PATH}/images/dolomity-dest.png`,
    alt: 'Horské vrcholy Dolomit s alpskými loukami',
    badge: 'Backpacking',
    category: 'Dobrodružné cesty'
  },
  {
    id: 3,
    title: 'Týden v Paříži – od Eiffelovky po skryté perličky',
    description: 'Celý týden v městě lásky a světel. Navštívíte všechna slavná místa, ale také objevíte autentické kavárny, skryté galerie a místní trhy. S tipy na nejlepší restaurace a večerní program.',
    price: '549 Kč',
    duration: '7 dní',
    rating: 4.8,
    image: `${BASE_PATH}/images/montmartre-vyhled.png`,
    alt: 'Výhled z Montmartru na Paříž při západu slunce',
    badge: 'Městský',
    category: 'Městské pobyty'
  },
  {
    id: 4,
    title: 'Dobrodružství v Jeseníkách – adrenalin v českých horách',
    description: 'Víkendový adrenalinový program v adventure paradise ČR. Nejdelší koloběžková trasa v ČR (17km), mountain biking, zip line, vysoké lanovky, jeskyně Špičák (350 mil. let), nejvyšší vodopád Jeseníků a výstup na Praděd. Pro milovníky adrenalinu.',
    price: '399 Kč',
    duration: '3 dny',
    rating: 4.7,
    image: `${BASE_PATH}/images/jeseniky.png`,
    alt: 'Horské vrcholy Jeseníků s výhledem a adventure aktivitami',
    badge: 'Dobrodružný',
    category: 'Dobrodružné cesty'
  },
  {
    id: 5,
    title: 'Gastronomický Milán – od osteria po Michelin',
    description: 'Pětidenní cesta světem milánské gastronomie. Enrico Bartolini, Cracco, tradiční Trattoria Milanese, místní trhy, cookingová workshop a degustace v oblasti Navigli. Kompletní průvodce food scénou.',
    price: '899 Kč',
    duration: '5 dní',
    rating: 4.9,
    image: `${BASE_PATH}/images/milan.png`,
    alt: 'Milánské Duomo s elegantními uličkami plnými kaváren',
    badge: 'Gastro',
    category: 'Gastronomické zážitky'
  },
  {
    id: 6,
    title: 'Víkend v Krakov – historie, kultura a gastro',
    description: 'Dvoudenní intenzivní program v jednom z nejkrásnějších měst Evropy. Wawelský hrad, Stare Miasto, Kazimierz, tradiční pierogi a kielbasa, židovská čtvrť a underground bary. Kompaktní městský zážitek.',
    price: '349 Kč',
    duration: '2 dny',
    rating: 4.5,
    image: `${BASE_PATH}/images/krakov.png`,
    alt: 'Historické centrum Krakova s barevnými budovami',
    badge: 'Městský',
    category: 'Víkendové výlety'
  }
];

const GuideCard = ({ guide, onCardClick }) => {
  const [imageError, setImageError] = useState(false);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  const handleCardClick = useCallback(() => {
    onCardClick(guide);
  }, [guide, onCardClick]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick();
    }
  }, [handleCardClick]);

  return (
    <div className="card-base card-hover flex flex-col ease-in-out min-h-[720px] max-h-[720px] cursor-pointer group"
         onClick={handleCardClick}
         role="button"
         tabIndex={0}
         onKeyDown={handleKeyDown}
         aria-label={`Cestovní průvodce: ${guide.title}`}>
      
      {/* Image Section */}
      <div className="relative w-full h-64 flex-shrink-0 overflow-hidden">
        {!imageError ? (
          <img 
            src={guide.image} 
            alt={guide.alt}
            className="w-full h-full object-cover"
            onError={handleImageError}
            loading="eager"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
            <span className="text-green-800 text-4xl font-bold">🗺️</span>
          </div>
        )}
        
        {/* Tag Overlay */}
        <span className="absolute top-3 left-3 bg-white/60 backdrop-blur-sm text-gray-800 text-xs font-semibold px-2.5 py-1.5 rounded-full uppercase tracking-wider z-10">
          {guide.badge}
        </span>
      </div>

      {/* Content Section */}
      <div className="p-7 flex flex-col flex-grow">
        <h3 className="text-lg font-medium text-black mb-2 leading-snug line-clamp-2">
          {guide.title}
        </h3>
        
        {/* Guide Info */}
        <div className="flex justify-between items-center mb-3 text-sm text-gray-600">
          <span className="flex items-center">
            📅 {guide.duration}
          </span>
          <div className="flex items-center gap-2">
            <div className="flex">
              {[1,2,3,4,5].map(star => {
                const isFull = star <= Math.floor(guide.rating);
                const isHalf = star === Math.ceil(guide.rating) && guide.rating % 1 !== 0;
                
                return (
                  <div key={star} className="relative">
                    {/* Background (empty) star */}
                    <svg className="w-4 h-4 text-gray-200" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    {/* Foreground (filled) star */}
                    {(isFull || isHalf) && (
                      <svg className="w-4 h-4 text-yellow-400 absolute top-0 left-0" fill="currentColor" viewBox="0 0 24 24" style={{ clipPath: isHalf ? 'inset(0 50% 0 0)' : 'none' }}>
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
            <span className="text-sm text-gray-600 font-medium">{guide.rating}</span>
          </div>
        </div>
        
        {/* Separator */}
        <div className="w-[70px] h-0.5 bg-gradient-to-r from-green-800 to-green-600 mx-auto my-3 rounded-full group-hover:w-[100px] transition-all duration-300 ease-in-out"></div>
        
        <p className="text-sm text-black leading-relaxed mt-2 flex-grow line-clamp-6">
          {guide.description}
        </p>
        
        {/* Price and Button */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl font-bold text-green-800">{guide.price}</span>
            <span className="text-sm text-gray-500">včetně DPH</span>
          </div>
          
          <div className="flex gap-3 items-center">
            <Button variant="green" size="md" className="flex-1">
              Zobrazit průvodce
            </Button>
            
            <Button variant="secondary" className="p-3" aria-label="Přidat do košíku">
              <img 
                src={`${BASE_PATH}/images/shopping-cart.svg`} 
                alt="Košík" 
                className="w-5 h-5"
              />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

GuideCard.displayName = 'GuideCard';

const TravelGuides = () => {
  const [activeSortOption, setActiveSortOption] = useState('Nejprodávanější');
  const navigate = useNavigate();

  const sortOptions = [
    'Nejprodávanější',
    'Nejdražší', 
    'Nejlevnější',
    'Dle hodnocení',
    'Nejnovější'
  ];

  const handleSortChange = useCallback((option) => {
    setActiveSortOption(option);
    // Zde bude později sorting logika
  }, []);

  const handleCardClick = useCallback((guide) => {
    // Navigace na detail stránku podle ID průvodce
    if (guide.id === 1) {
      navigate(ROUTES.ITALY_ROADTRIP_DETAIL);
      // Okamžité posčrollování na vrchol stránky
      window.scrollTo(0, 0);
    }
    // Pro budoucí průvodce zde bude obecná logika
  }, [navigate]);

  return (
    <Layout>
      
      {/* Hero Section */}
      <PageHero 
        backgroundImage={`${BASE_PATH}/images/blog-hero-cestovni-pruvodci.png`}
        title="Cestovní průvodci"
        subtitle="Zde najdeš všechno, co ti můžu nabídnout."
        overlayOpacity={0.5}
        ariaLabel="Hero sekce cestovních průvodců"
      />

      {/* Guides Section */}
      <main className="py-16 px-5 max-w-7xl mx-auto" role="main" aria-label="Seznam cestovních průvodců" style={{ overflowAnchor: 'none' }}>

        {/* Search & Sorting Bar */}
        <div className="mb-12 p-6 bg-white rounded-xl border border-gray-100 shadow-sm">
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative max-w-md mx-auto">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Vyhledat průvodce..."
                className="input-base w-full pl-9 pr-4 py-2 text-sm"
              />
            </div>
          </div>
          
          {/* Sorting Options */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <span className="text-sm font-medium text-black mb-2 sm:mb-0 sm:mr-4">
              Seřadit podle
            </span>
            
            <div className="flex flex-wrap items-center justify-center gap-2">
              {sortOptions.map((option) => (
                <Button
                  key={option}
                  onClick={() => handleSortChange(option)}
                  variant={activeSortOption === option ? "green" : "secondary"}
                  size="sm"
                  className={activeSortOption === option ? "" : "hover:text-green-800"}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Guides Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {TOP_ITINERARIES.map((guide) => (
            <GuideCard 
              key={guide.id} 
              guide={guide} 
              onCardClick={handleCardClick}
            />
          ))}
        </div>
      </main>

    </Layout>
  );
};

TravelGuides.displayName = 'TravelGuides';

export default TravelGuides;