import { useState, useCallback } from 'react';
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
  'Přesně rozplánovaných 20 dní – žádné zmatky, kam zítra.',
  'Denní harmonogram – co kdy stihneš, kolik času kde strávit.',
  'Trasy, vzdálenosti, časy přejezdů, parkování.',
  'Osobní tipy z reálné cesty – co fakt stojí za to a co klidně vynechat.',
  'Tipy na ubytování, restaurace i koupání.',
  'Mapy a odkazy, díky kterým se neztratíš.'
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

  const handlePurchase = useCallback(() => {
    alert('Přesměrování na platební bránu 💳');
  }, []);

  const handleBackToGuides = useCallback(() => {
    navigate(ROUTES.TRAVEL_GUIDES);
  }, [navigate]);

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

            <div className="grid lg:grid-cols-2 gap-12 xl:gap-20 items-center">
              {/* Left Column - Content */}
              <div className="order-2 lg:order-1">
                <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mb-6">
                  ⭐ Nejprodávanější itinerář
                </div>
                
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 leading-tight mb-6">
                  20 denní roadtrip <span className="text-green-700">Itálií</span> – kompletně naplánovaná cesta od severu až na jih
                </h1>
                
                <div className="space-y-6 mb-10 text-lg text-slate-600 leading-relaxed">
                  <p>
                    <strong className="text-slate-900">Chceš projet celou Itálii bez hodin strávených nad mapou a plánováním?</strong><br />
                    Přesně pro tebe jsem připravila tento detailní itinerář – ověřený, projížděný, vyzkoušený.
                  </p>
                  
                  <p>
                    <strong className="text-slate-900">Od jezer na severu až po moře v Kalábrii.</strong><br />
                    Navštívíš slavná místa jako Benátky, Řím, Cinque Terre, Amalfi, ale taky méně známé perly, které turisté často míjejí. A vše máš přehledně den po dni.
                  </p>
                </div>

                {/* CTA */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 flex-1">
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-3xl font-bold text-slate-900">699 Kč</span>
                      <span className="text-sm text-slate-500 line-through">999 Kč</span>
                    </div>
                    <div className="text-sm text-slate-600 space-y-1 mb-4">
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Okamžité stažení po zaplacení
                      </div>
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Vhodné i do mobilu/offline
                      </div>
                    </div>
                    <Button
                      onClick={handlePurchase}
                      variant="green"
                      size="lg"
                      className="w-full"
                    >
                      Koupit itinerář
                    </Button>
                  </div>
                </div>
              </div>

              {/* Right Column - Gallery */}
              <div className="order-1 lg:order-2">
                <div className="relative">
                  <div className="aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl bg-slate-100">
                    {!imageError ? (
                      <img 
                        src={GALLERY_IMAGES[currentImageIndex].src}
                        alt={GALLERY_IMAGES[currentImageIndex].alt}
                        className="w-full h-full object-cover"
                        onError={handleImageError}
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-4xl mb-2">🇮🇹</div>
                          <div className="text-green-800 font-semibold">Itálie Gallery</div>
                        </div>
                      </div>
                    )}
                    
                    {/* Navigation arrows */}
                    <button 
                      onClick={handlePrevImage}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm hover:bg-white text-slate-800 rounded-full shadow-lg transition-all duration-200 flex items-center justify-center group"
                      aria-label="Předchozí obrázek"
                    >
                      <svg className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button 
                      onClick={handleNextImage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm hover:bg-white text-slate-800 rounded-full shadow-lg transition-all duration-200 flex items-center justify-center group"
                      aria-label="Následující obrázek"
                    >
                      <svg className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    
                    {/* Dots indicator */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                      {GALLERY_IMAGES.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentImageIndex(index)}
                          className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                            index === currentImageIndex 
                              ? 'bg-white scale-125 shadow-sm' 
                              : 'bg-white/60 hover:bg-white/80'
                          }`}
                          aria-label={`Zobrazit obrázek ${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Floating badge */}
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
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                Co získáš
              </h2>
              <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                Vše potřebné pro perfektní cestu Itálií v jednom balíčku
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {FEATURES.map((feature, index) => (
                <div key={index} className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mr-4 flex-shrink-0">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-slate-700 leading-relaxed">
                      {feature}
                    </p>
                  </div>
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
                <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                  Proč právě tento itinerář?
                </h2>
                <p className="text-xl text-slate-600">
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
                      <p className="text-lg text-slate-700 leading-relaxed">
                        {reason}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Bonus Section */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-8">
                Bonus pro tebe
              </h2>
              
              <div className="space-y-6 text-lg text-slate-700 leading-relaxed">
                <p>
                  Kupuješ víc než jen plán cesty. Kupuješ si klid v hlavě a zážitky bez zbytečných starostí.
                </p>
                <p>
                  Tento itinerář je ideální pro ty, co chtějí cestovat efektivně, pohodlně a naplno – a bez cestovky.
                </p>
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