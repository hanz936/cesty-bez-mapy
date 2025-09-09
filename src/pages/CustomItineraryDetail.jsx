import React, { useState, useCallback, useEffect, useRef } from 'react';
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
    src: `${BASE_PATH}/images/custom-itinerary-1.png`,
    alt: 'Osobní konzultace při plánování cesty na míru'
  },
  {
    src: `${BASE_PATH}/images/custom-itinerary-2.png`, 
    alt: 'Detailní itinerář s mapami a tipy'
  },
  {
    src: `${BASE_PATH}/images/custom-itinerary-3.png`,
    alt: 'Podpora během cesty a flexibilní úpravy'
  }
];

const CustomItineraryDetail = React.memo(() => {
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

  // Track current image for mobile scroll
  const handleScroll = useCallback(() => {
    if (!galleryRef.current) return;
    const container = galleryRef.current;
    const scrollLeft = container.scrollLeft;
    const containerWidth = container.clientWidth;
    const newIndex = Math.round(scrollLeft / containerWidth);
    setCurrentImageIndex(newIndex);
  }, []);

  const handleBackToGuides = useCallback(() => {
    navigate(ROUTES.TRAVEL_GUIDES);
  }, [navigate]);

  const handlePurchase = useCallback(() => {
    navigate(ROUTES.CUSTOM_ITINERARY_FORM);
  }, [navigate]);

  const scrollModalPrev = useCallback(() => {
    if (!modalGalleryRef.current) return;
    const container = modalGalleryRef.current;
    const scrollAmount = container.clientWidth;
    container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  }, []);

  const scrollModalNext = useCallback(() => {
    if (!modalGalleryRef.current) return;
    const container = modalGalleryRef.current;
    const scrollAmount = container.clientWidth;
    container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  }, []);

  const handleModalTouchStart = useCallback((e) => {
    modalTouchStartX.current = e.touches[0].clientX;
  }, []);

  const handleModalTouchEnd = useCallback((e) => {
    modalTouchEndX.current = e.changedTouches[0].clientX;
    const diff = modalTouchStartX.current - modalTouchEndX.current;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        scrollModalNext();
      } else {
        scrollModalPrev();
      }
    }
  }, [scrollModalNext, scrollModalPrev]);

  const handleModalScroll = useCallback(() => {
    if (!modalGalleryRef.current) return;
    const container = modalGalleryRef.current;
    const scrollLeft = container.scrollLeft;
    const containerWidth = container.clientWidth;
    const newIndex = Math.round(scrollLeft / containerWidth);
    setModalCurrentImageIndex(newIndex);
  }, []);

  const openModal = useCallback(() => {
    previousFocusRef.current = document.activeElement;
    setIsModalOpen(true);
    setModalCurrentImageIndex(currentImageIndex);
    
    setTimeout(() => {
      if (modalGalleryRef.current) {
        const scrollAmount = modalGalleryRef.current.clientWidth * currentImageIndex;
        modalGalleryRef.current.scrollTo({ left: scrollAmount });
      }
      
      const closeButton = document.querySelector('[role="dialog"] button[aria-label*="Zavřít"]');
      if (closeButton) {
        closeButton.focus();
      }
    }, 100);
  }, [currentImageIndex]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    if (previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (!galleryRef.current) return;
    const container = galleryRef.current;
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    if (!modalGalleryRef.current || !isModalOpen) return;
    const container = modalGalleryRef.current;
    container.addEventListener('scroll', handleModalScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleModalScroll);
  }, [handleModalScroll, isModalOpen]);

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
            <div className="text-center mb-5 pb-5 border-b border-gray-200">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black leading-tight">
                Itinerář na míru
              </h1>
            </div>

            <div className="grid lg:grid-cols-2 gap-12 xl:gap-16 items-start">
              {/* Left Column - Content */}
              <div className="order-2 lg:order-1 flex flex-col justify-between min-h-full">
                <div>
                  <h2 className="text-xl sm:text-2xl text-black font-medium mb-8">
                    Cesta šitá jen pro tebe.
                  </h2>
                  
                  <div className="mb-10">
                    <ul className="space-y-4">
                      <li className="text-base sm:text-lg text-black leading-relaxed">
                        <div className="font-bold mb-1 text-green-800">Chceš vyrazit na cestu bez stresu a zbytečných kompromisů?</div>
                      </li>
                      <li className="text-base sm:text-lg text-black leading-relaxed">
                        <div>Přesně pro tebe připravím detailní itinerář na míru – originální, přehledný a přizpůsobený tvým přáním, rozpočtu i času.</div>
                      </li>
                      <li className="text-base sm:text-lg text-black leading-relaxed mt-8">
                        <div className="font-bold mb-1 text-green-800">Každý den naplánovaný do posledního detailu.</div>
                      </li>
                      <li className="text-base sm:text-lg text-black leading-relaxed">
                        <div>Ať už tě láká poznávání měst, příroda nebo kombinace obojího, naplánuju ti cestu den po dni.</div>
                      </li>
                      <li className="text-base sm:text-lg text-black leading-relaxed">
                        <div>Dostaneš tipy na ubytování, restaurace i skrytá místa, která běžní turisté často minou.</div>
                      </li>
                      <li className="text-base sm:text-lg text-black leading-relaxed">
                        <div>Stačí jen vyplnit formulář – a tvá vysněná dovolená může začít.</div>
                      </li>
                    </ul>
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
                              : 'bg-white/50 hover:bg-white/75'
                          }`}
                          aria-label={`Přejít na obrázek ${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Full width separator */}
            <div className="w-full h-px bg-gray-200 my-12"></div>
            
            <div className="grid lg:grid-cols-2 gap-12 xl:gap-16 items-end">
              {/* Left Column - Premium CTA */}
              <div className="order-2 lg:order-1">
                {/* Premium CTA */}
                <div className="relative">
                  <div className="bg-gradient-to-br from-white via-green-50 to-emerald-50 rounded-3xl p-8 shadow-2xl border border-green-200/50 backdrop-blur-sm">
                    <div className="flex items-baseline justify-between mb-6">
                      <span className="text-4xl font-bold text-green-800">
                        999 Kč
                      </span>
                      <span className="text-sm text-slate-500">včetně DPH</span>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      <div className="flex items-center">
                        <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-3">
                          <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-slate-700 font-medium">Osobní konzultace před cestou</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <span className="text-slate-700 font-medium">Detailní itinerář s mapami a tipy</span>
                      </div>
                    </div>
                    
                    <Button
                      onClick={handlePurchase}
                      variant="green"
                      size="xl"
                      className="w-full"
                    >
                      Vyplnit formulář
                    </Button>
                  </div>
                </div>
              </div>

              {/* Right Column - How it works */}
              <div className="order-1 lg:order-2">
                <div className="pl-6 border-l border-gray-200 space-y-4">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-green-800 mb-2">Jak to funguje?</h3>
                    <p className="text-sm sm:text-base text-black mb-6">Je to jednoduché – během pár kroků máš v ruce vlastní cestu na míru:</p>
                    
                    <ol className="relative">
                      <li className="mb-6 ms-12 relative">
                        <div className="absolute w-px h-full bg-gray-800 -left-8 top-8"></div>
                        <div className="absolute flex items-center justify-center w-8 h-8 bg-green-800 rounded-full -left-12 top-1/2 -translate-y-1/2 ring-4 ring-white text-white font-bold text-sm">
                          1
                        </div>
                        <h4 className="text-sm sm:text-base text-black font-semibold mb-1">Vyplníš krátký formulář</h4>
                        <p className="text-xs sm:text-sm text-black">Povíš mi, kam chceš jet a co tě baví.</p>
                      </li>
                      
                      <li className="mb-6 ms-12 relative">
                        <div className="absolute w-px h-full bg-gray-800 -left-8 top-8"></div>
                        <div className="absolute flex items-center justify-center w-8 h-8 bg-green-800 rounded-full -left-12 top-1/2 -translate-y-1/2 ring-4 ring-white text-white font-bold text-sm">
                          2
                        </div>
                        <h4 className="text-sm sm:text-base text-black font-semibold mb-1">Já ti naplánuju cestu</h4>
                        <p className="text-xs sm:text-sm text-black">Den po dni, podle tvých přání, rozpočtu i času.</p>
                      </li>
                      
                      <li className="mb-6 ms-12 relative">
                        <div className="absolute w-px h-full bg-gray-800 -left-8 top-8"></div>
                        <div className="absolute flex items-center justify-center w-8 h-8 bg-green-800 rounded-full -left-12 top-1/2 -translate-y-1/2 ring-4 ring-white text-white font-bold text-sm">
                          3
                        </div>
                        <h4 className="text-sm sm:text-base text-black font-semibold mb-1">Hotový itinerář ti přijde na e-mail</h4>
                        <p className="text-xs sm:text-sm text-black">Přehledný průvodce s mapami a tipy.</p>
                      </li>
                      
                      <li className="ms-12 relative">
                        <div className="absolute flex items-center justify-center w-8 h-8 bg-green-800 rounded-full -left-12 top-1/2 -translate-y-1/2 ring-4 ring-white text-white font-bold text-sm">
                          4
                        </div>
                        <h4 className="text-sm sm:text-base text-black font-semibold mb-1">Stačí vyrazit a užít si dovolenou</h4>
                        <p className="text-xs sm:text-sm text-black">Bez stresu, bez zbytečných kompromisů.</p>
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Cards Section - stejné jako v ItalyRoadtripDetail.jsx */}
        <section className="py-6 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-black mb-4">
                Proč si nechat naplánovat cestu na míru?
              </h2>
              <p className="text-lg text-black max-w-3xl mx-auto">
                Každá cesta je jedinečná, stejně jako ty. Přesně proto ti vytvořím itinerář šitý na míru tvým potřebám.
              </p>
            </div>
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
                    <span><span className="font-bold">Zkušenosti z cestování</span> – každý itinerář stavím na základě dlouholetých zkušeností a reálných doporučení.</span>
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
                    <span><span className="font-bold">Rychlý start přípravy</span> – odesláním formuláře spouštíš proces prioritního plánování.</span>
                  </li>
                </ul>
              </div>

            </div>
          </div>
        </section>
      </main>

      {/* Fullscreen Modal Gallery */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="relative w-full h-full">
            {/* Close button */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 z-50 w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all duration-200 hover:scale-110"
              aria-label="Zavřít galerii"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Modal Gallery */}
            <div className="flex items-center justify-center h-full p-4">
              <div className="relative w-full max-w-4xl">
                <div 
                  ref={modalGalleryRef}
                  className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
                  onTouchStart={handleModalTouchStart}
                  onTouchEnd={handleModalTouchEnd}
                >
                  {GALLERY_IMAGES.map((image, index) => (
                    <img 
                      key={index}
                      src={image.src}
                      alt={image.alt}
                      className="w-full h-auto max-h-[80vh] object-contain select-none flex-shrink-0 snap-center"
                      onError={handleImageError}
                      loading="lazy"
                      draggable={false}
                    />
                  ))}
                </div>

                {/* Navigation arrows for modal */}
                <button
                  onClick={scrollModalPrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all duration-200 hover:scale-110"
                  aria-label="Předchozí obrázek v galerii"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/>
                  </svg>
                </button>
                <button
                  onClick={scrollModalNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all duration-200 hover:scale-110"
                  aria-label="Následující obrázek v galerii"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                  </svg>
                </button>

                {/* Modal dots indicator */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {GALLERY_IMAGES.map((_, index) => (
                    <div
                      key={index}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        index === modalCurrentImageIndex 
                          ? 'bg-white' 
                          : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
});

CustomItineraryDetail.displayName = 'CustomItineraryDetail';

export default CustomItineraryDetail;