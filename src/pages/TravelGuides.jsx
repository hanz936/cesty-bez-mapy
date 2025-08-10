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
    title: '20 denní roadtrip Itálií – kompletně naplánovaná cesta od severu až na jih',
    description: 'Od jezer na severu až po moře v Kalábrii. Navštívíš slavná místa jako Benátky, Řím, Cinque Terre, Amalfi, ale taky méně známé perly, které turisté často míjejí. A vše máš přehledně den po dni.',
    price: '699 Kč',
    duration: '20 dní',
    rating: 4.9,
    image: `${BASE_PATH}/images/guide-italy-roadtrip.png`,
    alt: 'Malebná italská krajina s cestou vedoucí mezi kopci',
    badge: 'Roadtrip',
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
        <h3 className="text-lg font-medium text-black mb-2 leading-snug overflow-hidden" 
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}>
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
        
        <p className="text-sm text-black leading-relaxed mt-2 flex-grow overflow-hidden" 
           style={{
             display: '-webkit-box',
             WebkitLineClamp: 6,
             WebkitBoxOrient: 'vertical'
           }}>
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

        {/* Sorting Bar */}
        <div className="mb-12 p-6 bg-white rounded-xl border border-gray-100 shadow-sm">
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