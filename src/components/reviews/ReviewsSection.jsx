import React, { useState, useEffect, memo, useCallback } from 'react';
import ReviewCard from '../ui/ReviewCard';

// Refined recenze data - mix z Google, Instagram a itinerářů
const REVIEWS_DATA = [
  {
    id: 1,
    name: "Marie Novotná",
    rating: 5.0,
    text: "Úžasný itinerář do Itálie! Díky detailnímu plánu jsem objevila místa, která bych sama nikdy nenašla. Všechno bylo perfektně naplánované a ušetřilo mi to spoustu času při přípravě.",
    location: "Praha",
    source: "itinerary",
    date: "Prosinec 2024"
  },
  {
    id: 2,
    name: "Tomáš Svoboda",
    rating: 4.8,
    text: "Skvělý přístup k plánování cest. Itinerář byl velmi podrobný a obsahoval i tipy na místní restaurace. Celkově super zážitek, který předčil všechna očekávání.",
    location: "Brno",
    source: "google",
    date: "Listopad 2024"
  },
  {
    id: 3,
    name: "Anna Krásná",
    rating: 5.0,
    text: "Miluji způsob, jakým píšete o cestování! Váš Instagram mě inspiroval k výletům, které jsem si nikdy před tím netroufla naplánovat. Fotky jsou úžasné a texty velmi autentické.",
    location: "Ostrava",
    source: "instagram",
    date: "Říjen 2024"
  },
  {
    id: 4,
    name: "Pavel Černý",
    rating: 4.9,
    text: "Backpacking průvodce do Dolomit byl naprosto skvělý! Mapy tras, doporučení rifugio, tipy na balení - všechno co jsem potřeboval. Trek byl nezapomenutelný díky perfektní přípravě.",
    location: "Plzeň",
    source: "itinerary",
    date: "Září 2024"
  },
  {
    id: 5,
    name: "Lenka Horáková",
    rating: 4.7,
    text: "Profesionální přístup a rychlá komunikace. Itinerář na míru splnil všechna naše očekávání. Viděli jsme přesně to, co jsme chtěli, a zároveň objevili nová místa.",
    location: "České Budějovice",
    source: "google",
    date: "Srpen 2024"
  },
  {
    id: 6,
    name: "Jakub Veselý",
    rating: 5.0,
    text: "Perfektní stránky s cestovními tipy! Následuji vás už rok a každý příspěvek je inspirativní. Díky vašim radám jsem si naplánoval nejkrásnější dovolenou v životě.",
    location: "Liberec",
    source: "instagram",
    date: "Červenec 2024"
  },
  {
    id: 7,
    name: "Barbora Krejčí",
    rating: 4.8,
    text: "Gastronomický průvodce po Miláně překonal všechna očekávání. Restaurace byly výjimečné a doporučení na trhy a cookingové workshopy byly skvělé.",
    location: "Hradec Králové",
    source: "itinerary",
    date: "Červen 2024"
  },
  {
    id: 8,
    name: "Martin Dvořák",
    rating: 4.6,
    text: "Rychlé odpovědi na dotazy a užitečné rady pro cestování. Itinerář do Paříže byl detailní a praktický. Skvělá hodnota za peníze a kvalitní služby.",
    location: "Olomouc",
    source: "google",
    date: "Květen 2024"
  },
  {
    id: 9,
    name: "Tereza Málková",
    rating: 5.0,
    text: "Vaše fotky z Jeseníků mě motivovaly konečně vyrazit na české hory! Nádherné výhledy a skvělé tipy na aktivity. Instagram je plný inspirace a autentických zážitků.",
    location: "Zlín",
    source: "instagram",
    date: "Duben 2024"
  },
  {
    id: 10,
    name: "David Procházka",
    rating: 4.9,
    text: "Víkendový itinerář do Krakova byl perfektně naplánovaný. Všechna doporučená místa stála za to a časový plán byl reálný. Určitě si objednám další průvodce.",
    location: "Pardubice",
    source: "itinerary",
    date: "Březen 2024"
  }
];

const ReviewsSection = memo(({ className = '', autoScroll = true }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleNext = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % REVIEWS_DATA.length);
      setIsAnimating(false);
    }, 300);
  }, [isAnimating]);

  const handlePrev = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex(prev => (prev - 1 + REVIEWS_DATA.length) % REVIEWS_DATA.length);
      setIsAnimating(false);
    }, 300);
  }, [isAnimating]);

  useEffect(() => {
    if (!autoScroll) return;
    const interval = setInterval(handleNext, 5000);
    return () => clearInterval(interval);
  }, [autoScroll, handleNext]);

  // Get 3 consecutive reviews with wrapping - FIXED
  const getDisplayedReviews = () => {
    const reviews = [];
    for (let i = 0; i < 3; i++) {
      const index = (currentIndex + i) % REVIEWS_DATA.length;
      reviews.push(REVIEWS_DATA[index]);
    }
    return reviews;
  };

  const displayedReviews = getDisplayedReviews();

  return (
    <div className={`py-20 ${className}`.trim()}>
      {/* Header - more elegant */}
      <div className="text-center mb-16">
        <h2 className="text-3xl sm:text-4xl font-bold text-green-800 mb-6">
          Co říkají cestovatelé
        </h2>
        <p className="text-lg text-gray-600 max-w-3xl mx-auto mb-8 leading-relaxed">
          Přečti si recenze od těch, kteří už se mnou cestovali. Další najdeš na Google, Instagramu i u konkrétních itinerářů.
        </p>
        <div className="w-24 h-0.5 bg-gradient-to-r from-green-600 to-green-800 mx-auto"></div>
      </div>

      {/* Enhanced Reviews Carousel */}
      <div className="relative">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 to-transparent rounded-3xl -z-10"></div>

        {/* Navigation arrows - Functional */}
        <div className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-16 z-10">
          <button
            onClick={handlePrev}
            className="w-10 h-10 flex items-center justify-center hover:scale-110 transition-all duration-300 group disabled:opacity-50 disabled:hover:scale-100"
            disabled={isAnimating}
          >
            <svg className="w-8 h-8 text-gray-600 group-hover:text-green-800 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <div className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-16 z-10">
          <button
            onClick={handleNext}
            className="w-10 h-10 flex items-center justify-center hover:scale-110 transition-all duration-300 group disabled:opacity-50 disabled:hover:scale-100"
            disabled={isAnimating}
          >
            <svg className="w-8 h-8 text-gray-600 group-hover:text-green-800 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Cards container - Fixed positions */}
        <div className="overflow-x-hidden">
          <div
            className={`flex gap-6 lg:gap-8 px-4 py-16 transition-all duration-500 ease-out ${
              isAnimating ? 'opacity-90 scale-[0.98]' : 'opacity-100 scale-100'
            }`}
          >
            {displayedReviews.map((review, index) => (
              <div
                key={`${review.id}-${currentIndex}-${index}`}
                className={`flex-shrink-0 w-full lg:w-[calc(33.333%-1rem)] transition-all duration-500 ${
                  index === 1 ? 'lg:scale-105 lg:z-10' : 'lg:scale-95'
                }`}
                style={{
                  animationDelay: `${index * 100}ms`
                }}
              >
                <ReviewCard
                  name={review.name}
                  rating={review.rating}
                  text={review.text}
                  location={review.location}
                  source={review.source}
                  date={review.date}
                  className={`h-full transition-all duration-500 shadow-md hover:shadow-lg`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Refined Stats - more subtle */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
          <div className="text-3xl font-bold text-green-800 mb-2">4.8</div>
          <div className="text-sm text-gray-500 uppercase tracking-wider">Průměrné hodnocení</div>
          <div className="flex justify-center mt-3">
            {Array.from({ length: 5 }, (_, i) => (
              <svg key={i} className="w-3.5 h-3.5 text-green-800 mx-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
          <div className="text-3xl font-bold text-gray-800 mb-2">150+</div>
          <div className="text-sm text-gray-500 uppercase tracking-wider">Spokojených cestovatelů</div>
        </div>
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
          <div className="text-3xl font-bold text-gray-800 mb-2">25+</div>
          <div className="text-sm text-gray-500 uppercase tracking-wider">Zemí v itinerářích</div>
        </div>
      </div>

    </div>
  );
});

ReviewsSection.displayName = 'ReviewsSection';

export default ReviewsSection;