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

const FEATURES = [
  {
    icon: '📅',
    title: 'Kompletní plán',
    description: 'Přesně rozplánovaných 20 dní – žádné zmatky, kam zítra.',
    accent: 'from-blue-500 to-blue-600'
  },
  {
    icon: '⏰',
    title: 'Denní harmonogram',
    description: 'Co kdy stihneš, kolik času kde strávit.',
    accent: 'from-purple-500 to-purple-600'
  },
  {
    icon: '🛣️',
    title: 'Trasy a navigace',
    description: 'Trasy, vzdálenosti, časy přejezdů, parkování.',
    accent: 'from-orange-500 to-orange-600'
  },
  {
    icon: '💡',
    title: 'Insider tipy',
    description: 'Osobní tipy z reálné cesty – co fakt stojí za to a co klidně vynechat.',
    accent: 'from-emerald-500 to-emerald-600'
  },
  {
    icon: '🏨',
    title: 'Ubytování & strava',
    description: 'Tipy na ubytování, restaurace i koupání.',
    accent: 'from-pink-500 to-pink-600'
  },
  {
    icon: '🗺️',
    title: 'Mapy a odkazy',
    description: 'Mapy a odkazy, díky kterým se neztratíš.',
    accent: 'from-cyan-500 to-cyan-600'
  }
];

const WHY_REASONS = [
  'Itálii jsme projeli na vlastní kůži – žádná data z internetu, ale reálné zkušenosti.',
  'Nemusíš trávit hodiny na internetu a Google Maps. Itinerář je navržený tak, aby ti šetřil čas i nervy – a zároveň jsi toho viděl/a co nejvíc bez vyčerpání.',
  'Každý den je logicky sestavený – žádné zbytečné kličky nebo zmatky s přejezdy.',
  'Užiješ si to – bez chaosu a přehnaných očekávání. Víš, co tě čeká. A to je na cestě k nezaplacení.'
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
        <section className="relative pt-6 pb-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Breadcrumb */}
            <nav className="mb-8">
              <button 
                onClick={handleBackToGuides}
                className="flex items-center text-sm text-gray-600 hover:text-green-700 transition-colors group"
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
                <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mb-6">
                  ⭐ Nejprodávanější itinerář
                </div>
                
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black leading-tight mb-4">
                  20 denní roadtrip Itálií
                </h1>
                <h2 className="text-xl sm:text-2xl text-slate-600 font-medium mb-8">
                  Kompletně naplánovaná cesta od severu až na jih
                </h2>
                
                <div className="space-y-6 mb-10">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border-l-4 border-blue-400">
                    <p className="text-lg text-slate-700 leading-relaxed font-medium">
                      <span className="text-blue-600 font-bold">Chceš projet celou Itálii bez hodin strávených nad mapou a plánováním?</span><br />
                      Přesně pro tebe jsem připravila tento detailní itinerář – ověřený, projížděný, vyzkoušený.
                    </p>
                  </div>
                  
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border-l-4 border-green-500">
                    <p className="text-lg text-slate-800 leading-relaxed">
                      <span className="text-green-600 font-semibold">Od jezer na severu až po moře v Kalábrii.</span><br />
                      Navštívíš slavná místa jako Benátky, Řím, Cinque Terre, Amalfi, ale taky méně známé perly, které turisté často míjejí. A vše máš přehledně den po dni.
                    </p>
                  </div>
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
              <div className="order-1 lg:order-2 lg:mt-16">
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
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                      4.9 hodnocení
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-black mb-4">
                Co získáš
              </h2>
              <p className="text-xl text-black max-w-2xl mx-auto">
                Vše potřebné pro perfektní cestu Itálií v jednom balíčku
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((feature, index) => (
                <div key={index} className="group relative bg-white rounded-3xl p-8 border border-slate-200/50 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 overflow-hidden">
                  {/* Gradient accent */}
                  <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${feature.accent}`}></div>
                  
                  <div className="relative">
                    <div className="flex items-center mb-6">
                      <div className={`w-16 h-16 bg-gradient-to-r ${feature.accent} rounded-2xl flex items-center justify-center mr-4 text-2xl shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        {feature.icon}
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:bg-clip-text group-hover:from-slate-700 group-hover:to-slate-900 transition-all duration-300">
                        {feature.title}
                      </h3>
                    </div>
                    
                    <p className="text-slate-600 leading-relaxed text-base">
                      {feature.description}
                    </p>
                  </div>
                  
                  {/* Subtle hover effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why Section */}
        <section className="py-20 bg-gradient-to-br from-green-50 to-emerald-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-3xl sm:text-4xl font-bold text-black mb-4">
                  Proč právě tento itinerář?
                </h2>
                <p className="text-xl text-black">
                  Založeno na reálných zkušenostech, navrženo pro maximální užitek
                </p>
              </div>
              
              <div className="grid gap-8">
                {WHY_REASONS.map((reason, index) => (
                  <div key={index} className="bg-white rounded-2xl p-8 shadow-sm border border-white/50">
                    <div className="flex items-start">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-6 flex-shrink-0 mt-1">
                        <span className="text-green-600 font-bold text-sm">{index + 1}</span>
                      </div>
                      <p className="text-lg text-black leading-relaxed">
                        {reason}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Enhanced Bonus Section */}
        <section className="py-20 bg-white relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-50">
            <div className="w-full h-full bg-gradient-to-br from-slate-100/20 to-transparent"></div>
          </div>
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full mb-6 shadow-xl">
                  <span className="text-3xl">🎁</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-black mb-4">
                  Bonus pro tebe
                </h2>
                <div className="w-24 h-1 bg-gradient-to-r from-yellow-400 to-orange-500 mx-auto rounded-full"></div>
              </div>
              
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-12 shadow-2xl border border-white/50 relative">
                
                <div className="space-y-8 text-center">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-8 border-l-4 border-blue-400">
                    <p className="text-xl text-slate-700 leading-relaxed font-medium">
                      💎 Kupuješ víc než jen plán cesty. Kupuješ si <span className="text-blue-600 font-bold">klid v hlavě</span> a <span className="text-blue-600 font-bold">zážitky bez zbytečných starostí</span>.
                    </p>
                  </div>
                  
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-8 border-l-4 border-green-400">
                    <p className="text-xl text-slate-700 leading-relaxed font-medium">
                      🌟 Tento itinerář je ideální pro ty, co chtějí cestovat <span className="text-green-600 font-bold">efektivně, pohodlně a naplno</span> – a bez cestovky.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>
    </Layout>
  );
};

ItalyRoadtripDetail.displayName = 'ItalyRoadtripDetail';

export default ItalyRoadtripDetail;