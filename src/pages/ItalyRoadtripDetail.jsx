import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { Button } from '../components/ui';
import { BASE_PATH, ROUTES } from '../constants';

const GALLERY_IMAGES = [
  {
    src: `${BASE_PATH}/images/italy-roadmap-slide-1.png`,
    alt: 'Itálie - severoitalská jezera a horská scenérie'
  },
  {
    src: `${BASE_PATH}/images/italy-roadmap-slide-2.png`, 
    alt: 'Benátky - gondoly na Grand Canal s historickou architekturou'
  },
  {
    src: `${BASE_PATH}/images/italy-roadmap-slide-3.png`,
    alt: 'Cinque Terre - barevné domky na útesu u moře'
  }
];

const CARDS = [
  {
    title: 'Co získáš',
    items: [
      'Kompletně připravený plán cesty',
      'Tipy na parkování, ubytování a restaurace',
      'Doporučená místa a zážitky, které opravdu stojí za to',
      'Mapy, které otevřeš v mobilu'
    ]
  },
  {
    title: 'Proč právě tento itinerář',
    items: [
      'Ověřený na vlastní kůži - žádná data z internetu, ale reálné zkušenosti.',
      'Ušetří ti hodiny plánování a hledání',
      'Logicky poskládané trasy bez zbytečných přejezdů',
      'Vyhneš se turistickým pastím a zklamání'
    ]
  },
  {
    title: 'Podpora pro tebe',
    items: [
      'Konzultace k itineráři zdarma – zeptáš se na cokoliv',
      'Podpora přes WhatsApp během tvé cesty',
      'Vše připravené i offline - vezmeš s sebou do mobilu nebo vytiskneš',
      'Okamžité stažení po zaplacení'
    ]
  }
];

const ItalyRoadtripDetail = () => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const navigate = useNavigate();
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  const handlePrevImage = useCallback(() => {
    setCurrentImageIndex(prev => 
      prev === 0 ? GALLERY_IMAGES.length - 1 : prev - 1
    );
  }, []);

  const handleNextImage = useCallback(() => {
    setCurrentImageIndex(prev => 
      prev === GALLERY_IMAGES.length - 1 ? 0 : prev + 1
    );
  }, []);

  // Touch handlers for swipe functionality
  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      handleNextImage();
    }
    if (isRightSwipe) {
      handlePrevImage();
    }
  }, [handleNextImage, handlePrevImage]);

  const handlePurchase = useCallback(() => {
    alert('Přesměrování na platební bránu 💳');
  }, []);

  const handleBackToGuides = useCallback(() => {
    navigate(ROUTES.TRAVEL_GUIDES);
  }, [navigate]);

  // Automatické posčrollování na vrchol při načtení stránky
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <Layout>
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        {/* Hero Section with Breadcrumb */}
        <section className="relative pt-6 pb-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Breadcrumb */}
            <nav className="mb-8">
              <button 
                onClick={handleBackToGuides}
                className="flex items-center text-sm sm:text-base text-gray-600 hover:text-green-700 transition-colors group"
              >
                <svg className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Cestovní průvodci
              </button>
            </nav>

            <div className="grid lg:grid-cols-2 gap-12 xl:gap-16 items-start">
              {/* Left Column - Content */}
              <div className="order-2 lg:order-1">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black leading-tight mb-4">
                  20 denní roadtrip Itálií
                </h1>
                <h2 className="text-xl sm:text-2xl text-black font-medium mb-8">
                  Kompletně naplánovaná cesta od severu až na jih
                </h2>
                
                <div className="mb-10">
                  <ul className="space-y-4">
                    <li className="text-base sm:text-lg text-black leading-relaxed">
                      <div className="font-bold mb-1 text-green-800">Chceš projet celou Itálii bez hodin strávených nad mapou a plánováním?</div>
                      <div>Přesně pro tebe jsem připravila tento detailní itinerář – ověřený, projížděný, vyzkoušený.</div>
                    </li>
                    <li className="text-base sm:text-lg text-black leading-relaxed">
                      <div className="font-bold mb-1 text-green-800">Od jezer na severu až po moře v Kalábrii.</div>
                      <div>Navštívíš slavná místa jako Benátky, Řím, Cinque Terre, Amalfi, ale taky méně známé perly, které turisté často míjejí. A vše máš přehledně den po dni.</div>
                    </li>
                  </ul>
                </div>

                {/* Premium CTA */}
                <div className="relative">
                  <div className="bg-gradient-to-br from-white via-green-50 to-emerald-50 rounded-3xl p-8 shadow-2xl border border-green-200/50 backdrop-blur-sm">
                    <div className="flex items-baseline gap-3 mb-6">
                      <span className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                        699 Kč
                      </span>
                      <span className="text-lg text-slate-500 line-through">999 Kč</span>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center">
                        <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-3">
                          <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-slate-700 font-medium">Okamžité stažení po zaplacení</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <span className="text-slate-700 font-medium">Vhodné i do mobilu/offline</span>
                      </div>
                    </div>
                    
                    <Button
                      onClick={handlePurchase}
                      variant="green"
                      size="xl"
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
                    >
                      Koupit itinerář
                    </Button>
                  </div>
                </div>
              </div>

              {/* Right Column - Enhanced Gallery */}
              <div className="order-1 lg:order-2 mt-3">
                <div className="relative">
                  <div 
                    className="aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl bg-slate-100 ring-1 ring-black/5 touch-pan-x"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  >
                    {!imageError ? (
                      <img 
                        src={GALLERY_IMAGES[currentImageIndex].src}
                        alt={GALLERY_IMAGES[currentImageIndex].alt}
                        className="w-full h-full object-cover select-none"
                        onError={handleImageError}
                        loading="lazy"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-4xl mb-2">🇮🇹</div>
                          <div className="text-green-800 font-semibold">Itálie Gallery</div>
                        </div>
                      </div>
                    )}
                    
                    {/* Modern Navigation arrows */}
                    <button 
                      onClick={handlePrevImage}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/60 backdrop-blur-md text-slate-700 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 flex items-center justify-center group/btn hover:scale-110 hover:bg-white/95"
                      aria-label="Předchozí obrázek"
                    >
                      <svg className="w-6 h-6 group-hover/btn:-translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button 
                      onClick={handleNextImage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/60 backdrop-blur-md text-slate-700 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 flex items-center justify-center group/btn hover:scale-110 hover:bg-white/95"
                      aria-label="Následující obrázek"
                    >
                      <svg className="w-6 h-6 group-hover/btn:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    
                    {/* Enhanced Dots indicator */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 bg-black/20 backdrop-blur-md px-4 py-2 rounded-full">
                      {GALLERY_IMAGES.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentImageIndex(index)}
                          className={`w-3 h-3 rounded-full transition-all duration-300 ${
                            index === currentImageIndex 
                              ? 'bg-white scale-125 shadow-lg' 
                              : 'bg-white/60 hover:bg-white/90 hover:scale-110'
                          }`}
                          aria-label={`Zobrazit obrázek ${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div className="absolute -bottom-4 -left-4 bg-green-600 text-white px-4 py-2 rounded-full shadow-lg">
                    <div className="flex items-center gap-2 text-sm sm:text-base font-medium">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                      4.9 hodnocení
                    </div>
                  </div>
                </div>
                
                {/* Budget and Season Indicators */}
                <div className="mt-10 space-y-6">
                  <div className="flex items-center gap-2">
                    <span className="text-sm sm:text-base text-black font-medium">Finanční náročnost:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-500 text-base sm:text-lg">$</span>
                      <span className="text-yellow-500 text-base sm:text-lg">$</span>
                      <span className="text-yellow-500 text-base sm:text-lg">$</span>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm sm:text-base text-black font-medium mb-3">Nejlepší období pro cestu :</h3>
                    <ul className="space-y-2 sm:space-y-3">
                      <li className="text-sm sm:text-base text-black flex items-start gap-2">
                        <span className="text-base sm:text-lg leading-none flex-shrink-0 mt-0.5 sm:mt-1">🌸</span>
                        <span><strong>Jaro:</strong> Rozkvetlé Toskánsko, příjemné počasí v Římě i Cinque Terre, méně turistů.</span>
                      </li>
                      <li className="text-sm sm:text-base text-black flex items-start gap-2">
                        <span className="text-base sm:text-lg leading-none flex-shrink-0 mt-0.5 sm:mt-1">☀️</span>
                        <span><strong>Léto:</strong> Teplé moře u Amalfi a Kalábrie, živá města, ale davy a vyšší ceny.</span>
                      </li>
                      <li className="text-sm sm:text-base text-black flex items-start gap-2">
                        <span className="text-base sm:text-lg leading-none flex-shrink-0 mt-0.5 sm:mt-1">🍂</span>
                        <span><strong>Podzim:</strong> Víno v Toskánsku, klidnější památky v Římě, stále příjemné počasí na jihu.</span>
                      </li>
                      <li className="text-sm sm:text-base text-black flex items-start gap-2">
                        <span className="text-base sm:text-lg leading-none flex-shrink-0 mt-0.5 sm:mt-1">❄️</span>
                        <span><strong>Zima:</strong> Zasněžené hory, Benátky a Řím bez davů, Amalfi a jih mimo sezónu.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Cards Section */}
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
              {CARDS.map((card, index) => (
                <div key={index} className="bg-gradient-to-br from-white via-green-50 to-emerald-50 rounded-2xl p-6 sm:p-8 shadow-2xl border border-green-200/50 backdrop-blur-sm">
                  <h3 className="text-lg sm:text-xl font-bold text-green-800 mb-4 sm:mb-6">
                    {card.title}
                  </h3>
                  <ul className="space-y-3">
                    {card.items.map((item, itemIndex) => (
                      <li key={itemIndex} className="text-sm sm:text-base text-black flex items-start gap-3">
                        <div className="w-2 h-2 bg-green-800 rounded-full flex-shrink-0 mt-2"></div>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>
    </Layout>
  );
};

ItalyRoadtripDetail.displayName = 'ItalyRoadtripDetail';

export default ItalyRoadtripDetail;