import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { Button } from '../components/ui';
import Lightbox from '../components/ui/Lightbox';
import { BASE_PATH, ROUTES, SEASONS } from '../constants';
import { supabase } from '../lib/supabase';
import { useCart } from '../contexts';
import { trackEvent, ANALYTICS_EVENTS } from '../lib/analytics';
import SeoTags from '../components/common/SeoTags';
import { buildProductMeta } from '../utils/productSeo';

const ProductDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToCart, isInCart } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const galleryRef = useRef(null);

  // Fetch product data from Supabase
  useEffect(() => {
    let isMounted = true;

    async function fetchProduct() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('products')
          .select(`
            id, title, description, price, slug, image_url,
            detail_title, hero_subtitle,
            hero_line_1, hero_line_2, hero_line_3, hero_line_4,
            budget_level,
            spring_description, summer_description, autumn_description, winter_description,
            gallery_images
          `)
          .eq('slug', slug)
          .eq('is_active', true)
          .eq('is_deleted', false)
          .single();

        if (!isMounted) return;

        if (fetchError) {
          if (fetchError.code === 'PGRST116') {
            // No rows returned
            setError('Produkt nebyl nalezen');
          } else {
            throw fetchError;
          }
          return;
        }

        setProduct(data);
      } catch (err) {
        if (!isMounted) return;
        console.error('Error fetching product:', err);
        setError(err.message || 'Nepodařilo se načíst produkt');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (slug) {
      fetchProduct();
    }

    return () => {
      isMounted = false;
    };
  }, [slug]);

  // Automatically scroll to top when page loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
    if (!gallery || !product) return;

    const handleScroll = () => {
      const scrollLeft = gallery.scrollLeft;
      const itemWidth = gallery.clientWidth;
      const newIndex = Math.round(scrollLeft / itemWidth);
      const galleryLength = product?.gallery_images?.length || 1;
      const clampedIndex = Math.max(0, Math.min(newIndex, galleryLength - 1));
      setCurrentImageIndex(clampedIndex);
    };

    const handleScrollEnd = () => {
      const scrollLeft = gallery.scrollLeft;
      const itemWidth = gallery.clientWidth;
      const newIndex = Math.round(scrollLeft / itemWidth);
      const galleryLength = product?.gallery_images?.length || 1;
      const clampedIndex = Math.max(0, Math.min(newIndex, galleryLength - 1));
      setCurrentImageIndex(clampedIndex);
    };

    gallery.addEventListener('scroll', handleScroll);
    gallery.addEventListener('scrollend', handleScrollEnd);
    return () => {
      gallery.removeEventListener('scroll', handleScroll);
      gallery.removeEventListener('scrollend', handleScrollEnd);
    };
  }, [product]);

  // Přidání produktu do košíku
  const handleAddToCart = useCallback(() => {
    if (product) {
      const success = addToCart(product);
      if (success) {
        trackEvent(ANALYTICS_EVENTS.ADD_TO_CART, { product: product.slug, price: product.price });
        setAddedToCart(true);
        // Reset notifikace po 3 sekundách
        setTimeout(() => setAddedToCart(false), 3000);
      }
    }
  }, [product, addToCart]);

  // Přechod na checkout (pro přímý nákup)
  const handleBuyNow = useCallback(() => {
    if (product) {
      addToCart(product);
      trackEvent(ANALYTICS_EVENTS.ADD_TO_CART, { product: product.slug, price: product.price });
      navigate(ROUTES.CHECKOUT);
    }
  }, [product, addToCart, navigate]);

  const handleBackToGuides = useCallback(() => {
    navigate(ROUTES.TRAVEL_GUIDES);
  }, [navigate]);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  // Hide background content from screen readers while the lightbox is open (WCAG 2.2 best practice)
  useEffect(() => {
    if (!isModalOpen) return;

    const mainContent = document.querySelector('main');
    if (mainContent) {
      mainContent.setAttribute('aria-hidden', 'true');
    }

    return () => {
      if (mainContent) {
        mainContent.removeAttribute('aria-hidden');
      }
    };
  }, [isModalOpen]);

  // Loading state
  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-700 mb-4"></div>
            <p className="text-gray-600">Načítám produkt...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Error state
  if (error || !product) {
    return (
      <Layout>
        <div className="min-h-screen bg-white flex items-center justify-center px-4">
          <div className="max-w-md text-center">
            <div className="mb-6">
              <span className="text-6xl">😔</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              {error || 'Produkt nebyl nalezen'}
            </h1>
            <p className="text-gray-600 mb-6">
              Omlouváme se, ale požadovaný cestovní průvodce nebyl nalezen.
            </p>
            <Button
              onClick={handleBackToGuides}
              variant="green"
              size="lg"
            >
              Zpět na průvodce
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // Prepare gallery images - use gallery_images if available, otherwise fallback to single image_url
  const galleryImages = product.gallery_images && product.gallery_images.length > 0
    ? product.gallery_images
    : [{
        src: product.image_url || `${BASE_PATH}/images/placeholder-guide.jpg`,
        alt: `Průvodce: ${product.title}`
      }];

  // Format price
  const formattedPrice = product.price === 0 ? 'Zdarma' : `${product.price} Kč`;
  const isFree = product.price === 0;

  return (
    <Layout ready={!loading && !!product}>
      {product && <SeoTags meta={buildProductMeta(product)} />}
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
                {product.detail_title}
              </h1>
            </div>

            <div className="grid lg:grid-cols-2 gap-12 xl:gap-16 items-start">
              {/* Left Column - Content */}
              <div className="order-2 lg:order-1 flex flex-col justify-between min-h-full">
                <div>
                  <h2 className="text-xl sm:text-2xl text-black font-medium mb-8">
                    {product.hero_subtitle}
                  </h2>

                  {/* Hero Content with Structured Lines */}
                  {(product.hero_line_1 || product.hero_line_2 || product.hero_line_3 || product.hero_line_4) && (
                    <div className="mb-10">
                      <ul className="space-y-4">
                        {product.hero_line_1 && (
                          <li className="text-base sm:text-lg text-black leading-relaxed">
                            <div className="font-bold mb-1 text-green-800">{product.hero_line_1}</div>
                          </li>
                        )}
                        {product.hero_line_2 && (
                          <li className="text-base sm:text-lg text-black leading-relaxed">
                            <div>{product.hero_line_2}</div>
                          </li>
                        )}
                        {product.hero_line_3 && (
                          <li className="text-base sm:text-lg text-black leading-relaxed mt-8">
                            <div className="font-bold mb-1 text-green-800">{product.hero_line_3}</div>
                          </li>
                        )}
                        {product.hero_line_4 && (
                          <li className="text-base sm:text-lg text-black leading-relaxed">
                            <div>{product.hero_line_4}</div>
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Premium CTA */}
                <div className="relative mt-auto">
                  <div className="bg-gradient-to-br from-white via-green-50 to-emerald-50 rounded-3xl p-8 shadow-2xl border border-green-200/50 backdrop-blur-sm">
                    <div className="flex items-baseline gap-3 mb-6">
                      <span className="text-4xl font-bold text-green-800">
                        {formattedPrice}
                      </span>
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

                    {/* Notifikace o přidání do košíku */}
                    {addedToCart && (
                      <div className="mb-4 p-3 bg-green-100 border border-green-300 rounded-lg text-green-800 text-sm font-medium flex items-center">
                        <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Přidáno do košíku!
                      </div>
                    )}

                    {/* Hlavní CTA tlačítko */}
                    {isInCart(product?.id) ? (
                      <Button
                        onClick={handleBuyNow}
                        variant="green"
                        size="xl"
                        className="w-full"
                      >
                        Přejít k objednávce
                      </Button>
                    ) : (
                      <Button
                        onClick={handleAddToCart}
                        variant="green"
                        size="xl"
                        className="w-full"
                      >
                        {isFree ? 'Stáhnout zdarma' : 'Přidat do košíku'}
                      </Button>
                    )}
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
                      {galleryImages.map((image, index) => (
                        <img
                          key={index}
                          src={image.src}
                          alt={image.alt}
                          className="w-full h-full object-cover select-none flex-shrink-0 snap-center cursor-pointer"
                          onError={handleImageError}
                          onClick={openModal}
                          loading={index === 0 ? "eager" : "lazy"}
                          draggable={false}
                        />
                      ))}
                    </div>

                    {/* Desktop navigation arrows - only visible on hover and if multiple images */}
                    {galleryImages.length > 1 && (
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
                    )}

                    {/* Interactive dots indicator - only if multiple images */}
                    {galleryImages.length > 1 && (
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {galleryImages.map((_, index) => (
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
                    )}

                  </div>
                </div>

                {/* Budget and Season Indicators */}
                {(product.budget_level || SEASONS.some(season => product[season.dbField])) && (
                  <div className="mt-10 pl-6 border-l border-gray-200 space-y-6">
                    {/* Budget Level */}
                    {product.budget_level && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm sm:text-base text-black font-medium">Finanční náročnost:</span>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: product.budget_level }).map((_, index) => (
                            <span key={index} className="text-yellow-500 text-base sm:text-lg">$</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Seasonal Recommendations */}
                    {SEASONS.some(season => product[season.dbField]) && (
                      <div>
                        <h3 className="text-sm sm:text-base text-black font-medium mb-3">Nejlepší období pro cestu:</h3>
                        <ul className="space-y-2 sm:space-y-3">
                          {SEASONS.map(season => (
                            product[season.dbField] && (
                              <li key={season.key} className="text-sm sm:text-base text-black flex items-start gap-2">
                                <span className="text-base sm:text-lg leading-none flex-shrink-0 mt-0.5 sm:mt-1">{season.icon}</span>
                                <span><strong>{season.title}:</strong> {product[season.dbField]}</span>
                              </li>
                            )
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Three Static Cards Section */}
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

        <Lightbox
          images={galleryImages}
          isOpen={isModalOpen}
          initialIndex={currentImageIndex}
          onClose={() => setIsModalOpen(false)}
        />

      </main>
    </Layout>
  );
};

ProductDetail.displayName = 'ProductDetail';

export default ProductDetail;
