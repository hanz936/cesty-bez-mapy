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
  const [modalCurrentImageIndex, setModalCurrentImageIndex] = useState(0);
  const galleryRef = useRef(null);
  const modalTouchStartX = useRef(0);
  const modalTouchEndX = useRef(0);
  const modalGalleryRef = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  const previousFocusRef = useRef(null);

  // Use custom scroll lock hook
  useScrollLock(isModalOpen);

  const handleImageError = useCallback((e) => {
    // Fallback to a placeholder or hide the broken image
    e.target.style.display = 'none';
  }, []);

  // Scroll to specific image when dot is clicked
  const scrollToImage = useCallback((index) => {
    if (!galleryRef.current) return;
    const container = galleryRef.current;
    const scrollAmount = container.clientWidth * index;
    container.scrollTo({ left: scrollAmount, behavior: 'smooth' });
  }, []);

  const scrollPrev = useCallback(() => {
    if (!galleryRef.current) return;
    const container = galleryRef.current;
    const scrollAmount = container.clientWidth;
    container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  }, []);

  const scrollNext = useCallback(() => {
    if (!galleryRef.current) return;
    const container = galleryRef.current;
    const scrollAmount = container.clientWidth;
    container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  }, []);

  // Simple modal navigation functions
  const scrollModalPrev = useCallback(() => {
    setModalCurrentImageIndex(prev => prev === 0 ? GALLERY_IMAGES.length - 1 : prev - 1);
  }, []);

  const scrollModalNext = useCallback(() => {
    setModalCurrentImageIndex(prev => prev === GALLERY_IMAGES.length - 1 ? 0 : prev + 1);
  }, []);

  const scrollModalToImage = useCallback((index) => {
    setModalCurrentImageIndex(index);
  }, []);


  // Track scroll position to update active dot
  useEffect(() => {
    const gallery = galleryRef.current;
    if (!gallery) return;

    const handleScroll = () => {
      const scrollLeft = gallery.scrollLeft;
      const itemWidth = gallery.clientWidth;
      const newIndex = Math.round(scrollLeft / itemWidth);
      const clampedIndex = Math.max(0, Math.min(newIndex, GALLERY_IMAGES.length - 1));
      
      
      setCurrentImageIndex(clampedIndex);
    };

    // Přidáme i scrollend event pro lepší detekci
    const handleScrollEnd = () => {
      const scrollLeft = gallery.scrollLeft;
      const itemWidth = gallery.clientWidth;
      const newIndex = Math.round(scrollLeft / itemWidth);
      const clampedIndex = Math.max(0, Math.min(newIndex, GALLERY_IMAGES.length - 1));
      setCurrentImageIndex(clampedIndex);
    };

    gallery.addEventListener('scroll', handleScroll);
    gallery.addEventListener('scrollend', handleScrollEnd);
    return () => {
      gallery.removeEventListener('scroll', handleScroll);
      gallery.removeEventListener('scrollend', handleScrollEnd);
    };
  }, []);

  // Track modal gallery scroll position
  useEffect(() => {
    if (!isModalOpen || !modalGalleryRef.current) return;
    
    const modalGallery = modalGalleryRef.current;

    const handleModalScroll = () => {
      const scrollLeft = modalGallery.scrollLeft;
      const itemWidth = modalGallery.clientWidth;
      const newIndex = Math.round(scrollLeft / itemWidth);
      const clampedIndex = Math.max(0, Math.min(newIndex, GALLERY_IMAGES.length - 1));
      setModalCurrentImageIndex(clampedIndex);
    };

    const handleModalScrollEnd = () => {
      const scrollLeft = modalGallery.scrollLeft;
      const itemWidth = modalGallery.clientWidth;
      const newIndex = Math.round(scrollLeft / itemWidth);
      const clampedIndex = Math.max(0, Math.min(newIndex, GALLERY_IMAGES.length - 1));
      setModalCurrentImageIndex(clampedIndex);
    };

    modalGallery.addEventListener('scroll', handleModalScroll);
    modalGallery.addEventListener('scrollend', handleModalScrollEnd);
    return () => {
      modalGallery.removeEventListener('scroll', handleModalScroll);
      modalGallery.removeEventListener('scrollend', handleModalScrollEnd);
    };
  }, [isModalOpen]);



  const handlePurchase = useCallback(() => {
    alert('Přesměrování na platební bránu 💳');
  }, []);

  const handleBackToGuides = useCallback(() => {
    navigate(ROUTES.TRAVEL_GUIDES);
  }, [navigate]);

  const openModal = useCallback(() => {
    previousFocusRef.current = document.activeElement;
    setModalCurrentImageIndex(currentImageIndex);
    setIsModalOpen(true);
  }, [currentImageIndex]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    // Restore focus
    if (previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, []);



  // Modal keyboard and cleanup effects
  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
      if (e.key === 'ArrowLeft') {
        scrollModalPrev();
      }
      if (e.key === 'ArrowRight') {
        scrollModalNext();
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
  }, [isModalOpen, closeModal, scrollModalPrev, scrollModalNext]);

  // Automatické posčrollování na vrchol při načtení stránky
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <Layout>
      <main className="min-h-screen bg-white">
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
            <div className="text-center mb-6 pb-5 border-b border-gray-200">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black leading-tight">
                Roadtrip po Itálii na 20 dní
              </h1>
            </div>

            <div className="grid lg:grid-cols-2 gap-12 xl:gap-16 items-start">
              {/* Left Column - Content */}
              <div className="order-2 lg:order-1 flex flex-col justify-between min-h-full">
                <div>
                  <h2 className="text-xl sm:text-2xl text-black font-medium mb-8">
                    Kompletně naplánovaná cesta od severu až na jih
                  </h2>
                  
                  <div className="mb-10">
                    <ul className="space-y-4">
                      <li className="text-base sm:text-lg text-black leading-relaxed">
                        <div className="font-bold mb-1 text-green-800">Chceš projet celou Itálii bez hodin strávených nad mapou a plánováním?</div>
                      </li>
                      <li className="text-base sm:text-lg text-black leading-relaxed">
                        <div>Přesně pro tebe jsem připravila tento detailní itinerář – ověřený, projížděný, vyzkoušený.</div>
                      </li>
                      <li className="text-base sm:text-lg text-black leading-relaxed mt-8">
                        <div className="font-bold mb-1 text-green-800">Od jezer na severu až po moře v Kalábrii.</div>
                      </li>
                      <li className="text-base sm:text-lg text-black leading-relaxed">
                        <div>Navštívíš slavná místa jako Benátky, Řím, Cinque Terre, Amalfi, ale taky méně známé perly, které turisté často míjejí. A vše máš přehledně den po dni.</div>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Premium CTA */}
                <div className="relative mt-auto">
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
                    className="aspect-[4/3] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.25)] bg-gradient-to-br from-slate-50 to-slate-100"
                  >
                    <div 
                      ref={galleryRef}
                      className="flex h-full overflow-x-auto snap-x snap-mandatory touch-auto scrollbar-hide"
                    >
                      {GALLERY_IMAGES.map((image, index) => (
                        <img 
                          key={index}
                          src={image.src}
                          alt={image.alt}
                          className="w-full h-full object-cover select-none flex-shrink-0 snap-center cursor-pointer"
                          onError={handleImageError}
                          onClick={openModal}
                          loading="lazy"
                          draggable={false}
                        />
                      ))}
                    </div>
                    
                    {/* Desktop navigation arrows - only visible on hover */}
                    <div className="hidden lg:block">
                      <button
                        onClick={scrollPrev}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white hover:scale-110 shadow-md z-10"
                        aria-label="Předchozí obrázek"
                      >
                        <svg className="w-4 h-4 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/>
                        </svg>
                      </button>
                      <button
                        onClick={scrollNext}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white hover:scale-110 shadow-md z-10"
                        aria-label="Následující obrázek"
                      >
                        <svg className="w-4 h-4 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                        </svg>
                      </button>
                    </div>
                    
                    {/* Interactive dots indicator */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {GALLERY_IMAGES.map((_, index) => (
                        <button
                          key={index}
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            scrollToImage(index); 
                          }}
                          className={`w-2 h-2 rounded-full transition-all duration-300 cursor-pointer hover:scale-125 ${
                            index === currentImageIndex 
                              ? 'bg-white shadow-md' 
                              : 'bg-white/40 hover:bg-white/70'
                          }`}
                          aria-label={`Přejít na obrázek ${index + 1}`}
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
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center"
            role="dialog" 
            aria-modal="true" 
            aria-labelledby="modal-title"
            onClick={closeModal}
          >
            {/* Close button */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 w-12 h-12 text-white transition-all duration-300 hover:scale-110 flex items-center justify-center z-50"
              aria-label="Zavřít galerii"
              style={{filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.8))'}}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Modal Gallery - CSS Scroll Snap like main gallery */}
            <div 
              className="absolute inset-0 max-w-6xl mx-auto grid grid-rows-[1fr_auto] gap-4 sm:gap-6 p-2 sm:p-4 lg:p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Gallery container - Grid row 1 */}
              <div className="relative grid place-items-center group min-h-0">
                {/* Navigation arrows - desktop only */}
                <div className="hidden lg:block">
                  <button
                    onClick={scrollModalPrev}
                    className="absolute -left-16 xl:-left-20 top-1/2 -translate-y-1/2 w-12 h-12 text-white/80 hover:text-white transition-all duration-300 flex items-center justify-center hover:scale-110 z-10"
                    aria-label="Předchozí obrázek"
                    style={{filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.8))'}}
                  >
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/>
                    </svg>
                  </button>
                  <button
                    onClick={scrollModalNext}
                    className="absolute -right-16 xl:-right-20 top-1/2 -translate-y-1/2 w-12 h-12 text-white/80 hover:text-white transition-all duration-300 flex items-center justify-center hover:scale-110 z-10"
                    aria-label="Následující obrázek"
                    style={{filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.8))'}}
                  >
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                    </svg>
                  </button>
                </div>
                
                <div className="w-full max-w-6xl max-h-[70vh] sm:max-h-[75vh] lg:max-h-[80vh] rounded-xl sm:rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative">
                  <div 
                    className="grid grid-cols-[repeat(3,100%)] h-full transition-transform duration-300 ease-in-out touch-auto"
                    style={{ transform: `translateX(-${modalCurrentImageIndex * 100}%)` }}
                    onTouchStart={(e) => {
                      modalTouchStartX.current = e.touches[0].clientX;
                    }}
                    onTouchMove={(e) => {
                      modalTouchEndX.current = e.touches[0].clientX;
                    }}
                    onTouchEnd={() => {
                      if (!modalTouchStartX.current || !modalTouchEndX.current) return;
                      const distance = modalTouchStartX.current - modalTouchEndX.current;
                      const isLeftSwipe = distance > 50;
                      const isRightSwipe = distance < -50;
                      if (isLeftSwipe) scrollModalNext();
                      if (isRightSwipe) scrollModalPrev();
                      modalTouchStartX.current = 0;
                      modalTouchEndX.current = 0;
                    }}
                  >
                    {GALLERY_IMAGES.map((image, index) => (
                      <div key={index} className="grid place-items-center p-2">
                        <img 
                          src={image.src}
                          alt={image.alt}
                          className="max-w-full max-h-full object-contain select-none rounded-xl sm:rounded-2xl"
                          onError={handleImageError}
                          loading="lazy"
                          draggable={false}
                        />
                      </div>
                    ))}
                  </div>
                  
                </div>
              </div>
              
              {/* Image description and navigation - Grid row 2 */}
              <div className="text-center px-2 h-24 sm:h-28 lg:h-32 flex flex-col justify-center">
                <p id="modal-title" className="text-white text-sm sm:text-base font-medium leading-relaxed max-w-2xl mx-auto">
                  {GALLERY_IMAGES[modalCurrentImageIndex]?.alt}
                </p>
                <div className="text-white/60 text-xs sm:text-sm mt-2">
                  {modalCurrentImageIndex + 1} / {GALLERY_IMAGES.length}
                </div>
                
                {/* Interactive dots indicator */}
                <div className="flex justify-center gap-2 sm:gap-1.5 mt-3 sm:mt-4">
                  {GALLERY_IMAGES.map((_, index) => (
                    <button
                      key={index}
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        scrollModalToImage(index); 
                      }}
                      className={`w-3 h-3 sm:w-2.5 sm:h-2.5 lg:w-2 lg:h-2 rounded-full transition-all duration-300 cursor-pointer hover:scale-125 active:scale-110 ${
                        index === modalCurrentImageIndex 
                          ? 'bg-white shadow-md' 
                          : 'bg-white/40 hover:bg-white/70'
                      }`}
                      aria-label={`Přejít na obrázek ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </Layout>
  );
};

ItalyRoadtripDetail.displayName = 'ItalyRoadtripDetail';

export default ItalyRoadtripDetail;