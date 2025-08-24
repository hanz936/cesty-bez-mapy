import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { Button } from '../components/ui';
import { BASE_PATH, ROUTES } from '../constants';

// Custom hook for cross-device scroll lock
const useScrollLock = (isLocked) => {
  useEffect(() => {
    if (!isLocked) return;
    
    const scrollY = window.scrollY;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    // CSS solution for desktop and Android
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    
    // iOS Safari fix - prevent touch events
    const preventTouch = (e) => {
      e.preventDefault();
    };
    
    if (isIOS) {
      document.addEventListener('touchmove', preventTouch, { passive: false });
    }
    
    // Cleanup function
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      
      if (isIOS) {
        document.removeEventListener('touchmove', preventTouch);
      }
      
      window.scrollTo(0, scrollY);
    };
  }, [isLocked]);
};

const GALLERY_IMAGES = [
  {
    src: `${BASE_PATH}/images/italy-roadmap-slide-1.png`,
    alt: 'Benátky - pohled z gondly na Benátky'
  },
  {
    src: `${BASE_PATH}/images/italy-roadmap-slide-2.png`, 
    alt: 'Řím - Fontána di Trevi'
  },
  {
    src: `${BASE_PATH}/images/italy-roadmap-slide-3.png`,
    alt: 'Florencie - katedrála Santa Maria del Fiore (Il Duomo)'
  }
];


const ItalyRoadtripDetail = () => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const modalTouchStartX = useRef(0);
  const modalTouchEndX = useRef(0);
  const previousFocusRef = useRef(null);
  const [showArrows, setShowArrows] = useState(false);
  const [useDesktopLayout, setUseDesktopLayout] = useState(false);

  // Use custom scroll lock hook
  useScrollLock(isModalOpen);

  // Detect if device supports hover for arrows and layout
  useEffect(() => {
    const hasHover = window.matchMedia('(hover: hover)').matches;
    // Desktop s myší = vždy zobrazit šipky + desktop layout
    setShowArrows(hasHover);
    setUseDesktopLayout(hasHover);
    
    const handleResize = () => {
      const hasHover = window.matchMedia('(hover: hover)').matches;
      setShowArrows(hasHover);
      setUseDesktopLayout(hasHover);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  const openModal = useCallback(() => {
    previousFocusRef.current = document.activeElement;
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    // Restore focus
    if (previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, []);

  const handleModalPrevImage = useCallback(() => {
    setCurrentImageIndex(prev => 
      prev === 0 ? GALLERY_IMAGES.length - 1 : prev - 1
    );
  }, []);

  const handleModalNextImage = useCallback(() => {
    setCurrentImageIndex(prev => 
      prev === GALLERY_IMAGES.length - 1 ? 0 : prev + 1
    );
  }, []);

  // Modal touch handlers
  const handleModalTouchStart = useCallback((e) => {
    modalTouchStartX.current = e.touches[0].clientX;
  }, []);

  const handleModalTouchMove = useCallback((e) => {
    modalTouchEndX.current = e.touches[0].clientX;
  }, []);

  const handleModalTouchEnd = useCallback(() => {
    if (!modalTouchStartX.current || !modalTouchEndX.current) return;
    
    const distance = modalTouchStartX.current - modalTouchEndX.current;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      handleModalNextImage();
    } else if (isRightSwipe) {
      handleModalPrevImage();
    }
    
    modalTouchStartX.current = 0;
    modalTouchEndX.current = 0;
  }, [handleModalNextImage, handleModalPrevImage]);

  // Modal keyboard and cleanup effects
  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
      if (e.key === 'ArrowLeft') {
        handleModalPrevImage();
      }
      if (e.key === 'ArrowRight') {
        handleModalNextImage();
      }
      // Focus trap - prevent tabbing outside modal
      if (e.key === 'Tab') {
        const modal = document.querySelector('[role="dialog"]');
        if (modal) {
          const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];

          if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    // Cleanup on unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Modern cleanup
      document.documentElement.classList.remove('modal-open');
    };
  }, [isModalOpen, closeModal, handleModalPrevImage, handleModalNextImage]);

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

            {/* Title Section */}
            <div className="text-center mb-5 pb-5 border-b border-gray-200">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black leading-tight">
                Roadtrip po Itálii na 20 dní
              </h1>
            </div>

            <div className="grid lg:grid-cols-2 gap-12 xl:gap-16 items-start">
              {/* Left Column - Content */}
              <div className="order-2 lg:order-1">
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
                      <span className="text-4xl font-bold text-green-800">
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
                      className="w-full"
                    >
                      Koupit itinerář
                    </Button>
                  </div>
                </div>
              </div>

              {/* Right Column - Enhanced Gallery */}
              <div className="order-1 lg:order-2 mt-1">
                <div className="relative group">
                  <div 
                    className="aspect-[4/3] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.25)] bg-gradient-to-br from-slate-50 to-slate-100 touch-pan-x cursor-pointer"
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onClick={openModal}
                  >
                    {!imageError ? (
                      <img 
                        src={GALLERY_IMAGES[currentImageIndex].src}
                        alt={GALLERY_IMAGES[currentImageIndex].alt}
                        className="w-full h-full object-cover select-none transition-transform duration-700"
                        onError={handleImageError}
                        loading="lazy"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-green-100 to-emerald-200 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-4xl mb-2">🇮🇹</div>
                          <div className="text-green-800 font-semibold">Itálie Gallery</div>
                        </div>
                      </div>
                    )}
                    
                    
                    {/* Navigation arrows - Smart device detection */}
                    {showArrows && (
                      <>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handlePrevImage(); }}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-16 h-16 text-white transition-all duration-300 flex items-center justify-center group/btn hover:scale-110 z-10 opacity-0 group-hover:opacity-100"
                          aria-label="Předchozí obrázek"
                          style={{filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.8))'}}
                        >
                          <svg className="w-14 h-14 group-hover/btn:-translate-x-0.5 transition-transform duration-200" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/>
                          </svg>
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleNextImage(); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-16 h-16 text-white transition-all duration-300 flex items-center justify-center group/btn hover:scale-110 z-10 opacity-0 group-hover:opacity-100"
                          aria-label="Následující obrázek"
                          style={{filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.8))'}}
                        >
                          <svg className="w-14 h-14 group-hover/btn:translate-x-0.5 transition-transform duration-200" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                          </svg>
                        </button>
                      </>
                    )}
                    
                    {/* Enhanced Dots indicator */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-full">
                      {GALLERY_IMAGES.map((_, index) => (
                        <button
                          key={index}
                          onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(index); }}
                          className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                            index === currentImageIndex 
                              ? 'bg-white scale-125 shadow-lg' 
                              : 'bg-white/60 hover:bg-white/90 hover:scale-110'
                          }`}
                          aria-label={`Zobrazit obrázek ${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                  
                </div>
                
                {/* Budget and Season Indicators */}
                <div className="mt-10 pl-6 border-l border-gray-200 space-y-6">
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
        <section className="py-6 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
              
              {/* Co získáš */}
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-gray-100">
                <h3 className="text-lg sm:text-xl font-bold text-green-800 mb-4 sm:mb-6">
                  Co získáš
                </h3>
                <ul className="space-y-3">
                  <li className="text-sm sm:text-base text-black flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-800 rounded-full flex-shrink-0 mt-2"></div>
                    <span><span className="font-bold">Kompletně</span> připravený plán cesty</span>
                  </li>
                  <li className="text-sm sm:text-base text-black flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-800 rounded-full flex-shrink-0 mt-2"></div>
                    <span><span className="font-bold">Tipy</span> na parkování, ubytování a restaurace</span>
                  </li>
                  <li className="text-sm sm:text-base text-black flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-800 rounded-full flex-shrink-0 mt-2"></div>
                    <span><span className="font-bold">Doporučená místa a zážitky</span>, které opravdu stojí za to</span>
                  </li>
                  <li className="text-sm sm:text-base text-black flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-800 rounded-full flex-shrink-0 mt-2"></div>
                    <span><span className="font-bold">Mapy</span>, které otevřeš v mobilu</span>
                  </li>
                </ul>
              </div>

              {/* Proč právě tento itinerář */}
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-gray-100">
                <h3 className="text-lg sm:text-xl font-bold text-green-800 mb-4 sm:mb-6">
                  Proč právě tento itinerář
                </h3>
                <ul className="space-y-3">
                  <li className="text-sm sm:text-base text-black flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-800 rounded-full flex-shrink-0 mt-2"></div>
                    <span><span className="font-bold">Ověřené na vlastní kůži</span> - žádná data z internetu, ale reálné zkušenosti.</span>
                  </li>
                  <li className="text-sm sm:text-base text-black flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-800 rounded-full flex-shrink-0 mt-2"></div>
                    <span><span className="font-bold">Ušetří</span> ti hodiny plánování a hledání</span>
                  </li>
                  <li className="text-sm sm:text-base text-black flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-800 rounded-full flex-shrink-0 mt-2"></div>
                    <span><span className="font-bold">Logicky</span> poskládané trasy bez zbytečných přejezdů</span>
                  </li>
                  <li className="text-sm sm:text-base text-black flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-800 rounded-full flex-shrink-0 mt-2"></div>
                    <span><span className="font-bold">Vyhneš</span> se turistickým pastím a zklamání</span>
                  </li>
                </ul>
              </div>

              {/* Podpora pro tebe */}
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-gray-100">
                <h3 className="text-lg sm:text-xl font-bold text-green-800 mb-4 sm:mb-6">
                  Podpora pro tebe
                </h3>
                <ul className="space-y-3">
                  <li className="text-sm sm:text-base text-black flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-800 rounded-full flex-shrink-0 mt-2"></div>
                    <span><span className="font-bold">Konzultace k itineráři zdarma</span> – zeptáš se na cokoliv</span>
                  </li>
                  <li className="text-sm sm:text-base text-black flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-800 rounded-full flex-shrink-0 mt-2"></div>
                    <span><span className="font-bold">Podpora přes WhatsApp</span> během tvé cesty</span>
                  </li>
                  <li className="text-sm sm:text-base text-black flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-800 rounded-full flex-shrink-0 mt-2"></div>
                    <span><span className="font-bold">Vše připravené i offline</span> - vezmeš s sebou do mobilu nebo vytiskneš</span>
                  </li>
                  <li className="text-sm sm:text-base text-black flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-800 rounded-full flex-shrink-0 mt-2"></div>
                    <span>Okamžité stažení po zaplacení</span>
                  </li>
                </ul>
              </div>

            </div>
          </div>
        </section>

        {/* Fullscreen Modal */}
        {isModalOpen && (
          <div 
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4"
            role="dialog" 
            aria-modal="true" 
            aria-labelledby="modal-title"
            onClick={closeModal}
            onTouchMove={(e) => e.preventDefault()}
            style={{touchAction: 'none'}}
          >
            {/* Close button - absolute to modal, true top-right corner */}
            <button
              onClick={closeModal}
              className="absolute top-2 right-2 w-16 h-16 text-white transition-all duration-300 hover:scale-110 flex items-center justify-center z-50"
              aria-label="Zavřít galerii"
              style={{filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.8))'}}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* CSS Grid Modal Layout - Clean & Simple */}
            <div 
              className={`relative w-full h-full max-w-7xl grid gap-0 ${
                useDesktopLayout 
                  ? 'grid-rows-[auto_1fr_auto_auto] p-4' 
                  : 'grid-rows-[auto_1fr_auto] p-1'
              }`}
              onTouchStart={handleModalTouchStart}
              onTouchMove={handleModalTouchMove}
              onTouchEnd={handleModalTouchEnd}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 1. Top spacer area - maintains grid structure */}
              <div className="h-16"></div>


              {/* 2. Mobile: Combined Image+Description area / Desktop: Image only */}
              <div className="flex items-center justify-center min-h-0">
                {/* Mobile: Image + Description together */}
                <div className={`flex flex-col items-center justify-center gap-3 w-full ${
                  useDesktopLayout ? 'hidden' : 'flex'
                }`}>
                  {!imageError ? (
                    <img
                      src={GALLERY_IMAGES[currentImageIndex].src}
                      alt={GALLERY_IMAGES[currentImageIndex].alt}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-96 h-64 bg-gradient-to-br from-green-100 to-emerald-200 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-6xl mb-4">🇮🇹</div>
                        <div className="text-green-800 font-semibold text-xl">Itálie Gallery</div>
                      </div>
                    </div>
                  )}
                  {/* Description on mobile/tablet */}
                  <div className="text-white px-4 py-2 max-w-2xl text-center">
                    <p id="modal-title" className="text-sm font-medium leading-tight">{GALLERY_IMAGES[currentImageIndex].alt}</p>
                  </div>
                </div>
                
                {/* Desktop: Image only */}
                <div className={`items-center justify-center w-full h-full ${
                  useDesktopLayout ? 'flex' : 'hidden'
                }`}>
                  {!imageError ? (
                    <img
                      src={GALLERY_IMAGES[currentImageIndex].src}
                      alt={GALLERY_IMAGES[currentImageIndex].alt}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-96 h-64 bg-gradient-to-br from-green-100 to-emerald-200 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-6xl mb-4">🇮🇹</div>
                        <div className="text-green-800 font-semibold text-xl">Itálie Gallery</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Desktop: Description area (hidden on mobile/tablet) */}
              <div className={`h-16 items-center justify-center px-4 ${
                useDesktopLayout ? 'flex' : 'hidden'
              }`}>
                <div className="text-white px-4 py-2 max-w-2xl text-center">
                  <p id="modal-title" className="text-sm font-medium leading-tight">{GALLERY_IMAGES[currentImageIndex].alt}</p>
                </div>
              </div>

              {/* 4. Dots area - fixed height */}
              <div className="h-12 flex flex-col items-center justify-center gap-2">
                <div className="text-white/80 text-xs font-medium">
                  {currentImageIndex + 1} / {GALLERY_IMAGES.length}
                </div>
                <div className="flex gap-2 bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-full">
                  {GALLERY_IMAGES.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                        index === currentImageIndex
                          ? 'bg-white scale-125 shadow-lg'
                          : 'bg-white/60 hover:bg-white/90 hover:scale-110'
                      }`}
                      aria-label={`Zobrazit obrázek ${index + 1}`}
                    />
                  ))}
                </div>
              </div>

              {/* Navigation arrows - positioned over the grid */}
              {showArrows && GALLERY_IMAGES.length > 1 && (
                <>
                  <button
                    onClick={handleModalPrevImage}
                    className="absolute -left-8 xl:-left-12 top-1/2 -translate-y-1/2 w-16 h-16 text-white transition-all duration-300 flex items-center justify-center group/btn hover:scale-110 z-10"
                    aria-label="Předchozí obrázek"
                    style={{filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.8))'}}
                  >
                    <svg className="w-14 h-14 group-hover/btn:-translate-x-0.5 transition-transform duration-200" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/>
                    </svg>
                  </button>
                  <button
                    onClick={handleModalNextImage}
                    className="absolute -right-8 xl:-right-12 top-1/2 -translate-y-1/2 w-16 h-16 text-white transition-all duration-300 flex items-center justify-center group/btn hover:scale-110 z-10"
                    aria-label="Následující obrázek"
                    style={{filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.8))'}}
                  >
                    <svg className="w-14 h-14 group-hover/btn:translate-x-0.5 transition-transform duration-200" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

      </main>
    </Layout>
  );
};

ItalyRoadtripDetail.displayName = 'ItalyRoadtripDetail';

export default ItalyRoadtripDetail;