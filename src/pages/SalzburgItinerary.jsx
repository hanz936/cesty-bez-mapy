import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import PageHero from '../components/common/PageHero';
import { Button } from '../components/ui';
import Lightbox from '../components/ui/Lightbox';
import SeoTags from '../components/common/SeoTags';
import { buildPageMeta } from '../utils/pageSeo';
import { BASE_PATH, ROUTES } from '../constants';

const GALLERY_IMAGES = [
  {
    src: `${BASE_PATH}/images/salzburg-slide-1.jpg`,
    alt: 'Salzburg - panorama města s pevností Hohensalzburg'
  },
  {
    src: `${BASE_PATH}/images/salzburg-slide-2.jpg`,
    alt: 'Historické centrum Salzburgu - Mozart platz a barokní architektura'
  },
  {
    src: `${BASE_PATH}/images/salzburg-slide-3.jpg`,
    alt: 'Alpské okolí Salzburgu - jezera a hory'
  }
];

const SalzburgItinerary = () => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const galleryRef = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

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

  const handleDownloadPDF = useCallback(() => {
    // TODO: Implement PDF download when file is ready
    alert('PDF bude brzy k dispozici ke stažení!');
  }, []);

  const handleMoreGuides = useCallback(() => {
    navigate(ROUTES.TRAVEL_GUIDES);
  }, [navigate]);

  const handleCustomItinerary = useCallback(() => {
    navigate(ROUTES.CUSTOM_ITINERARY_DETAIL);
  }, [navigate]);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <Layout ready>
      <SeoTags meta={buildPageMeta(ROUTES.SALZBURG_ITINERARY)} />
      {/* Hero Section */}
      <PageHero
        backgroundImage={`${BASE_PATH}/images/placeholder-salzburg-hero.jpg`}
        title="Víkendový pobyt v Salzburgu"
        subtitle="Bezplatný itinerář - Poznej Mozart město za 2 dny"
        overlayOpacity={0.6}
        ariaLabel="Hero sekce pro Salzburg itinerář"
      />

      <main className="min-h-screen bg-white">
        {/* Main Content Section */}
        <section className="relative pt-16 sm:pt-20 pb-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 xl:gap-16 items-start">
              {/* Left Column - Content */}
              <div className="order-2 lg:order-1 flex flex-col justify-between min-h-full">
                <div>
                  <h2 className="text-xl sm:text-2xl text-black font-medium mb-8">
                    Kompletní průvodce Mozart městem - úplně zdarma
                  </h2>

                  <div className="mb-10">
                    <ul className="space-y-4">
                      <li className="text-base sm:text-lg text-black leading-relaxed">
                        <div className="font-bold mb-1 text-green-800">Chceš poznat Salzburg za víkend, ale nevíš, kde začít?</div>
                      </li>
                      <li className="text-base sm:text-lg text-black leading-relaxed">
                        <div>Připravila jsem pro tebe detailní průvodce se všemi důležitými informacemi, které potřebuješ pro perfektní víkend v městě Mozarta.</div>
                      </li>
                      <li className="text-base sm:text-lg text-black leading-relaxed mt-8">
                        <div className="font-bold mb-1 text-green-800">2 dny naplněné kulturou, historií a alpským kouzlem.</div>
                      </li>
                      <li className="text-base sm:text-lg text-black leading-relaxed">
                        <div>Navštívíš slavnou pevnost Hohensalzburg, projdeš se barokním centrem UNESCO, ochutná místní speciality a možná se vypravíš i k nedaleké perle Hallstattu.</div>
                      </li>
                      <li className="text-base sm:text-lg text-black leading-relaxed">
                        <div>A nejlepší? Celý průvodce je úplně zdarma - jako ukázka kvality mých itinerářů.</div>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Premium CTA - FREE version */}
                <div className="relative mt-auto">
                  <div className="bg-gradient-to-br from-white via-green-50 to-emerald-50 rounded-3xl p-8 shadow-2xl border border-green-200/50 backdrop-blur-sm">
                    <div className="flex items-baseline gap-3 mb-6">
                      <span className="text-4xl font-bold text-green-800">
                        Zdarma
                      </span>
                      <span className="text-lg text-slate-500">0 Kč</span>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-center">
                        <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-3">
                          <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-slate-700 font-medium">Okamžité stažení PDF průvodce</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <span className="text-slate-700 font-medium">Použij offline v mobilu</span>
                      </div>
                    </div>

                    <Button
                      onClick={handleDownloadPDF}
                      variant="green"
                      size="xl"
                      className="w-full"
                    >
                      Stáhnout průvodce zdarma
                    </Button>

                    <p className="text-xs text-slate-500 text-center mt-4">
                      Žádná registrace ani platba není potřeba
                    </p>
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
                      <span className="text-gray-300 text-base sm:text-lg">$</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm sm:text-base text-black font-medium mb-3">Nejlepší období pro návštěvu:</h3>
                    <ul className="space-y-2 sm:space-y-3">
                      <li className="text-sm sm:text-base text-black flex items-start gap-2">
                        <span className="text-base sm:text-lg leading-none flex-shrink-0 mt-0.5 sm:mt-1">🌸</span>
                        <span><strong>Jaro:</strong> Rozkvetlá zahrada Mirabell, příjemné počasí, méně turistů než v létě.</span>
                      </li>
                      <li className="text-sm sm:text-base text-black flex items-start gap-2">
                        <span className="text-base sm:text-lg leading-none flex-shrink-0 mt-0.5 sm:mt-1">☀️</span>
                        <span><strong>Léto:</strong> Festival sezóna s koncerty, otevřené terasy, výlety k jezerům.</span>
                      </li>
                      <li className="text-sm sm:text-base text-black flex items-start gap-2">
                        <span className="text-base sm:text-lg leading-none flex-shrink-0 mt-0.5 sm:mt-1">🍂</span>
                        <span><strong>Podzim:</strong> Barevná příroda v okolí, klidnější památky, vinobraní.</span>
                      </li>
                      <li className="text-sm sm:text-base text-black flex items-start gap-2">
                        <span className="text-base sm:text-lg leading-none flex-shrink-0 mt-0.5 sm:mt-1">❄️</span>
                        <span><strong>Zima:</strong> Vánoční trhy, zasněžené Alpy, romantická atmosféra.</span>
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
                  Co v průvodci najdeš
                </h3>
                <ul className="space-y-3">
                  <li className="text-sm sm:text-base text-black flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-800 rounded-full flex-shrink-0 mt-2"></div>
                    <span><span className="font-bold">2-denní detailní program</span> hodina po hodině</span>
                  </li>
                  <li className="text-sm sm:text-base text-black flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-800 rounded-full flex-shrink-0 mt-2"></div>
                    <span><span className="font-bold">Tipy na restaurace a kavárny</span> s cenami</span>
                  </li>
                  <li className="text-sm sm:text-base text-black flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-800 rounded-full flex-shrink-0 mt-2"></div>
                    <span><span className="font-bold">Rozpočet a ceny</span> vstupenek a aktivit</span>
                  </li>
                  <li className="text-sm sm:text-base text-black flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-800 rounded-full flex-shrink-0 mt-2"></div>
                    <span><span className="font-bold">Mapy s trasami</span> pro procházky městem</span>
                  </li>
                </ul>
              </div>

              {/* Proč navštívit Salzburg */}
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-gray-100">
                <h3 className="text-lg sm:text-xl font-bold text-green-800 mb-4 sm:mb-6">
                  Proč navštívit Salzburg
                </h3>
                <ul className="space-y-3">
                  <li className="text-sm sm:text-base text-black flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-800 rounded-full flex-shrink-0 mt-2"></div>
                    <span><span className="font-bold">Mozart město</span> s bohatou hudební tradicí</span>
                  </li>
                  <li className="text-sm sm:text-base text-black flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-800 rounded-full flex-shrink-0 mt-2"></div>
                    <span><span className="font-bold">UNESCO památka</span> s barokní architekturou</span>
                  </li>
                  <li className="text-sm sm:text-base text-black flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-800 rounded-full flex-shrink-0 mt-2"></div>
                    <span><span className="font-bold">Alpské kouzlo</span> hodinu od Hallstattu</span>
                  </li>
                  <li className="text-sm sm:text-base text-black flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-800 rounded-full flex-shrink-0 mt-2"></div>
                    <span><span className="font-bold">Kompaktní centrum</span> ideální na víkend</span>
                  </li>
                </ul>
              </div>

              {/* Co tě čeká */}
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-gray-100">
                <h3 className="text-lg sm:text-xl font-bold text-green-800 mb-4 sm:mb-6">
                  Praktické informace
                </h3>
                <ul className="space-y-3">
                  <li className="text-sm sm:text-base text-black flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-800 rounded-full flex-shrink-0 mt-2"></div>
                    <span><span className="font-bold">Doprava a parkování</span> - jak se dostat</span>
                  </li>
                  <li className="text-sm sm:text-base text-black flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-800 rounded-full flex-shrink-0 mt-2"></div>
                    <span><span className="font-bold">Tipy na ubytování</span> v různých cenách</span>
                  </li>
                  <li className="text-sm sm:text-base text-black flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-800 rounded-full flex-shrink-0 mt-2"></div>
                    <span><span className="font-bold">Offline verze</span> do mobilu bez internetu</span>
                  </li>
                  <li className="text-sm sm:text-base text-black flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-800 rounded-full flex-shrink-0 mt-2"></div>
                    <span><span className="font-bold">Insider tipy</span>, které ušetří čas i peníze</span>
                  </li>
                </ul>
              </div>

            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
              Líbí se ti tento průvodce?
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Mám připravené další detailní itineráře po celé Evropě
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={handleMoreGuides}
                variant="green"
                size="lg"
              >
                Všechny průvodce
              </Button>
              <Button
                onClick={handleCustomItinerary}
                variant="outline"
                size="lg"
                className="border-2 border-green-800 text-green-800 hover:bg-green-50"
              >
                Itinerář na míru
              </Button>
            </div>
          </div>
        </section>

        <Lightbox
          images={GALLERY_IMAGES}
          isOpen={isModalOpen}
          initialIndex={currentImageIndex}
          onClose={() => setIsModalOpen(false)}
          showCaption
        />

      </main>
    </Layout>
  );
};

SalzburgItinerary.displayName = 'SalzburgItinerary';

export default SalzburgItinerary;
