import { useState, useCallback, useEffect, useMemo, useDeferredValue, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import PageHero from '../components/common/PageHero';
import { Button, Dropdown } from '../components/ui';
import { BASE_PATH, ROUTES } from '../constants';
import { supabase } from '../lib/supabase';


// LEGACY: Hardcoded data (fallback pro development)
const ALL_ITINERARIES_LEGACY = [
  {
    id: 'salzburg',
    title: 'Víkendový pobyt v Salzburgu – Mozart město za 2 dny',
    description: 'Kompletní průvodce se všemi důležitými informacemi pro perfektní víkend v městě Mozarta. Navštívíš slavnou pevnost Hohensalzburg, projdeš se barokním centrem UNESCO a možná se vypravíš i k nedaleké perle Hallstattu. Celý průvodce je úplně zdarma - jako ukázka kvality mých itinerářů.',
    price: 'Zdarma',
    duration: '2 dny',
    rating: 5.0,
    image: `${BASE_PATH}/images/salzburg-guide-card.jpg`,
    alt: 'Salzburg - panorama města s pevností Hohensalzburg a alpským pozadím',
    badge: '🎁 ZDARMA',
    category: 'Víkendové výlety',
    isFree: true
  },
  {
    id: 0,
    title: 'Itinerář na míru – cesta šitá jen pro tebe',
    description: 'Chceš cestovat bez kompromisů? Připravím ti jedinečný plán podle tvých přání, rozpočtu i času. Získáš osobní konzultaci, detailní průvodce a podporu během celé cesty – aby tvé dobrodružství bylo naprosto bez starostí.',
    price: '999 Kč',
    duration: 'Dle potřeb',
    rating: 5.0,
    image: `${BASE_PATH}/images/custom-itinerary.png`,
    alt: 'Otevřená mapa s tužkou a poznámkami pro plánování cesty na míru',
    badge: 'Na míru',
    category: 'Individuální plánování'
  },
  {
    id: 1,
    title: 'Roadtrip po Itálii na 20 dní – kompletně naplánovaná cesta od severu až na jih',
    description: 'Od jezer na severu až po moře v Kalábrii. Navštívíš slavná místa jako Benátky, Řím, Cinque Terre, Amalfi, ale taky méně známé perly, které turisté často míjejí. A vše máš přehledně den po dni.',
    price: '699 Kč',
    duration: '20 dní',
    rating: 4.9,
    image: `${BASE_PATH}/images/guide-italy-roadtrip.png`,
    alt: 'Malebná italská krajina s cestou vedoucí mezi kopci',
    badge: 'Roadtrip',
    category: 'Dlouhodobé cesty'
  },
  {
    id: 2,
    title: 'Backpacking Dolomity – túry s noclehy v rifugio',
    description: 'Týdenní trek s batohem přes nejkrásnější vrcholy Dolomit. Tre Cime di Lavaredo, Seceda, Alpe di Siusi, nocleh v horských rifugio, mapy tras a tipy na balení. Pro milovníky hor a aktivního cestování.',
    price: '649 Kč',
    duration: '7 dní',
    rating: 4.8,
    image: `${BASE_PATH}/images/dolomity-dest.png`,
    alt: 'Horské vrcholy Dolomit s alpskými loukami',
    badge: 'Backpacking',
    category: 'Dobrodružné cesty'
  },
  {
    id: 3,
    title: 'Týden v Paříži – od Eiffelovky po skryté perličky',
    description: 'Celý týden v městě lásky a světel. Navštívíte všechna slavná místa, ale také objevíte autentické kavárny, skryté galerie a místní trhy. S tipy na nejlepší restaurace a večerní program.',
    price: '549 Kč',
    duration: '7 dní',
    rating: 4.8,
    image: `${BASE_PATH}/images/montmartre-vyhled.png`,
    alt: 'Výhled z Montmartru na Paříž při západu slunce',
    badge: 'Městský',
    category: 'Městské pobyty'
  },
  {
    id: 4,
    title: 'Dobrodružství v Jeseníkách – adrenalin v českých horách',
    description: 'Víkendový adrenalinový program v adventure paradise ČR. Nejdelší koloběžková trasa v ČR (17km), mountain biking, zip line, vysoké lanovky, jeskyně Špičák (350 mil. let), nejvyšší vodopád Jeseníků a výstup na Praděd. Pro milovníky adrenalinu.',
    price: '399 Kč',
    duration: '3 dny',
    rating: 4.7,
    image: `${BASE_PATH}/images/jeseniky.png`,
    alt: 'Horské vrcholy Jeseníků s výhledem a adventure aktivitami',
    badge: 'Dobrodružný',
    category: 'Dobrodružné cesty'
  },
  {
    id: 5,
    title: 'Gastronomický Milán – od osteria po Michelin',
    description: 'Pětidenní cesta světem milánské gastronomie. Enrico Bartolini, Cracco, tradiční Trattoria Milanese, místní trhy, cookingová workshop a degustace v oblasti Navigli. Kompletní průvodce food scénou.',
    price: '899 Kč',
    duration: '5 dní',
    rating: 4.9,
    image: `${BASE_PATH}/images/milan.png`,
    alt: 'Milánské Duomo s elegantními uličkami plnými kaváren',
    badge: 'Gastro',
    category: 'Gastronomické zážitky'
  },
  {
    id: 6,
    title: 'Víkend v Krakov – historie, kultura a gastro',
    description: 'Dvoudenní intenzivní program v jednom z nejkrásnějších měst Evropy. Wawelský hrad, Stare Miasto, Kazimierz, tradiční pierogi a kielbasa, židovská čtvrť a underground bary. Kompaktní městský zážitek.',
    price: '349 Kč',
    duration: '2 dny',
    rating: 4.5,
    image: `${BASE_PATH}/images/krakov.png`,
    alt: 'Historické centrum Krakova s barevnými budovami',
    badge: 'Městský',
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
        <h3 className="text-lg font-medium text-black mb-2 leading-snug line-clamp-2">
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
        
        <p className="text-sm text-black leading-relaxed mt-2 flex-grow line-clamp-6">
          {guide.description}
        </p>
        
        {/* Price and Button */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl font-bold text-green-800">{guide.price}</span>
          </div>

          <div className="flex gap-3 items-center">
            <Button variant="green" size="md" className="flex-1">
              {guide.isFree ? 'Stáhnout zdarma' : 'Zobrazit průvodce'}
            </Button>

            {!guide.isFree && (
              <Button variant="secondary" className="p-3" aria-label="Přidat do košíku">
                <img
                  src={`${BASE_PATH}/images/shopping-cart.svg`}
                  alt="Košík"
                  className="w-5 h-5"
                />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ✅ React.memo() pro optimalizaci - zabrání re-renderu cards, které se nezměnily (React 19 best practice)
const MemoizedGuideCard = memo(GuideCard);
MemoizedGuideCard.displayName = 'GuideCard';

/**
 * Helper: Parsuje duration string na počet dní
 * "2 dny" → 2, "7 dní" → 7, "20 dní" → 20, "Neuvedeno" → 0
 */
const parseDurationToDays = (duration) => {
  if (!duration || duration === 'Neuvedeno') return 0;
  const match = duration.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
};

/**
 * Cache pro normalized strings (performance optimization)
 * Best practice 2026: Prevence zbytečných NFD normalizací
 * Zdroj: ClarityDev, Listiak.dev, MDN
 */
const diacriticsCache = new Map();

/**
 * Helper: Odstraní diakritiku (háčky, čárky) z textu pro diacritics-insensitive search
 * Funguje obousměrně - "Pariz" najde "Paříž" i "Paříž" najde "Paříž"
 * Best practice 2026: NFD normalization + regex s cache (MDN, Unicode standard)
 *
 * @param {string} str - Text k normalizaci
 * @returns {string} - Text bez diakritiky
 *
 * @example
 * removeDiacritics("Paříž") → "Pariz"
 * removeDiacritics("český") → "cesky"
 * removeDiacritics("průvodce") → "pruvodce"
 * removeDiacritics("Salcburk") → "Salcburk" (již bez diakritiky)
 */
const removeDiacritics = (str) => {
  if (!str) return '';

  // ✅ Check cache first (performance optimization)
  if (diacriticsCache.has(str)) {
    return diacriticsCache.get(str);
  }

  // ✅ NFD normalization + regex (best practice 2026)
  const normalized = str
    .normalize('NFD')                    // Rozloží znaky na base + diacritics (ř → r + háček)
    .replace(/[\u0300-\u036f]/g, '');   // Odstraní kombinující diakritické znaky (U+0300-U+036F)

  // ✅ Store in cache for future lookups
  diacriticsCache.set(str, normalized);

  return normalized;
};

/**
 * Mapuje produkt z databáze na formát pro GuideCard
 */
const mapProductToGuide = (product) => {
  return {
    id: product.id,
    title: product.title,
    description: product.description,
    price: product.price === 0 ? 'Zdarma' : `${product.price} Kč`,
    priceNumeric: product.price || 0, // Pro sorting
    duration: product.duration || 'Neuvedeno',
    rating: product.average_rating || 5.0,
    image: product.image_url || `${BASE_PATH}/images/placeholder-guide.jpg`,
    alt: `Průvodce: ${product.title}`,
    badge: product.badge || 'Průvodce',
    category: 'Kategorie',
    category_ids: product.category_ids || [], // UUID array kategorií
    isFree: product.price === 0,
    slug: product.slug,
    reviewCount: product.review_count || 0,
    total_sales: product.total_sales || 0, // Pro sorting podle prodejnosti
    created_at: product.created_at // Pro sorting podle nejnovějších
  };
};

// Constants for filtering (outside component to prevent recreation on every render)
// camelCase per Airbnb Style Guide 2025: module-scoped constants use camelCase, not UPPER_CASE
const priceRanges = [
  { id: '0-400', label: 'Do 400 Kč', min: 0, max: 400 },
  { id: '400-600', label: '400-600 Kč', min: 400, max: 600 },
  { id: '600-800', label: '600-800 Kč', min: 600, max: 800 },
  { id: '800+', label: 'Nad 800 Kč', min: 800, max: Infinity }
];

const durationRanges = [
  { id: 'weekend', label: 'Víkend (1-3 dny)', minDays: 1, maxDays: 3 },
  { id: 'week', label: 'Týden (4-10 dní)', minDays: 4, maxDays: 10 },
  { id: 'longterm', label: 'Dlouhodobé (11+ dní)', minDays: 11, maxDays: Infinity }
];

const ratingRanges = [
  { id: '5', label: '5 hvězdiček', minRating: 5.0, exact: true },
  { id: '4.5+', label: '4.5+ hvězdiček', minRating: 4.5 },
  { id: '4+', label: '4+ hvězdiček', minRating: 4.0 },
  { id: '3.5+', label: '3.5+ hvězdiček', minRating: 3.5 }
];

const TravelGuides = () => {
  // State pro produkty a UI
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State pro filtry a sorting
  const [activeSortOption, setActiveSortOption] = useState('Nejprodávanější');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedPriceRanges, setSelectedPriceRanges] = useState([]);
  const [selectedDurationRanges, setSelectedDurationRanges] = useState([]);
  const [selectedRatingRanges, setSelectedRatingRanges] = useState([]);

  // ✅ React 19: Search state s useDeferredValue (best practice 2026)
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery, '');

  const navigate = useNavigate();

  // Fetch produktů ze Supabase
  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('products')
          .select('*')
          .eq('is_active', true)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false });

        if (fetchError) {
          throw fetchError;
        }

        // Mapuj data z DB na formát pro GuideCard
        const mappedProducts = data.map(mapProductToGuide);
        setProducts(mappedProducts);
      } catch (err) {
        console.error('Error fetching products:', err);
        setError(err.message || 'Nepodařilo se načíst produkty');
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  // Fetch kategorií ze Supabase
  useEffect(() => {
    async function fetchCategories() {
      try {
        const { data, error: fetchError } = await supabase
          .from('categories')
          .select('id, name, slug')
          .order('name');

        if (fetchError) {
          throw fetchError;
        }

        setCategories(data || []);
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    }

    fetchCategories();
  }, []);

  const sortOptions = [
    'Nejprodávanější',
    'Nejdražší', 
    'Nejlevnější',
    'Dle hodnocení',
    'Nejnovější'
  ];

  const handleSortChange = useCallback((e) => {
    setActiveSortOption(e.target.value);
  }, []);

  const handleCardClick = useCallback((guide) => {
    // Dynamická navigace na detail produktu podle slug
    if (guide.slug) {
      navigate(`/cestovni-pruvodci/${guide.slug}`);
      window.scrollTo(0, 0);
    }
  }, [navigate]);

  // Spočítej produkty pro každou kategorii (useMemo pro cached computed value)
  const categoriesWithCount = useMemo(() => {
    return categories.map(category => {
      const count = products.filter(product =>
        product.category_ids && product.category_ids.includes(category.id)
      ).length;

      return {
        id: category.id,
        label: category.name,
        slug: category.slug,
        count: count
      };
    }).filter(cat => cat.count > 0); // Zobraz jen kategorie s produkty
  }, [categories, products]);

  // Handler pro zaškrtnutí/odškrtnutí kategorie
  const handleCategoryToggle = useCallback((categoryId) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryId)) {
        // Odškrtni - odstraň z pole
        return prev.filter(id => id !== categoryId);
      } else {
        // Zaškrtni - přidej do pole
        return [...prev, categoryId];
      }
    });
  }, []);

  // Spočítej produkty pro každý price range (useMemo pro cached computed value)
  const priceRangesWithCount = useMemo(() => {
    return priceRanges.map(range => {
      const count = products.filter(product => {
        const price = product.priceNumeric || 0;
        return price >= range.min && price < range.max;
      }).length;

      return {
        ...range,
        count: count
      };
    }).filter(range => range.count > 0); // Zobraz jen ranges s produkty (best practice 2026)
  }, [products]);

  // Handler pro zaškrtnutí/odškrtnutí price range
  const handlePriceRangeToggle = useCallback((rangeId) => {
    setSelectedPriceRanges(prev => {
      if (prev.includes(rangeId)) {
        return prev.filter(id => id !== rangeId);
      } else {
        return [...prev, rangeId];
      }
    });
  }, []);

  // Spočítej produkty pro každý duration range (useMemo pro cached computed value)
  const durationRangesWithCount = useMemo(() => {
    return durationRanges.map(range => {
      const count = products.filter(product => {
        const days = parseDurationToDays(product.duration);
        return days >= range.minDays && days <= range.maxDays;
      }).length;

      return {
        ...range,
        count: count
      };
    }).filter(range => range.count > 0); // Zobraz jen ranges s produkty
  }, [products]);

  // Handler pro zaškrtnutí/odškrtnutí duration range
  const handleDurationRangeToggle = useCallback((rangeId) => {
    setSelectedDurationRanges(prev => {
      if (prev.includes(rangeId)) {
        return prev.filter(id => id !== rangeId);
      } else {
        return [...prev, rangeId];
      }
    });
  }, []);

  // Spočítej produkty pro každý rating range (useMemo pro cached computed value)
  const ratingRangesWithCount = useMemo(() => {
    return ratingRanges.map(range => {
      const count = products.filter(product => {
        const rating = product.rating || 0;
        if (range.exact) {
          return rating === range.minRating; // Exact match pro "5 hvězdiček"
        } else {
          return rating >= range.minRating; // Range match pro "4.5+" atd.
        }
      }).length;

      return {
        ...range,
        count: count
      };
    }).filter(range => range.count > 0); // Zobraz jen ranges s produkty
  }, [products]);

  // Handler pro zaškrtnutí/odškrtnutí rating range
  const handleRatingRangeToggle = useCallback((rangeId) => {
    setSelectedRatingRanges(prev => {
      if (prev.includes(rangeId)) {
        return prev.filter(id => id !== rangeId);
      } else {
        return [...prev, rangeId];
      }
    });
  }, []);

  // ✅ React 19: Handler pro search input (best practice 2026)
  const handleSearchChange = useCallback((e) => {
    setSearchQuery(e.target.value);
  }, []);

  // ✅ Handler pro vymazání search query (UX best practice 2026)
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // ✅ Handler pro vymazání všech checkbox filtrů (best practice 2026)
  const handleClearFilters = useCallback(() => {
    setSelectedCategories([]);
    setSelectedPriceRanges([]);
    setSelectedDurationRanges([]);
    setSelectedRatingRanges([]);
  }, []);

  // ✅ Computed value: jsou nějaké checkbox filtry aktivní? (UX best practice)
  const hasActiveFilters = useMemo(() => {
    return selectedCategories.length > 0 ||
           selectedPriceRanges.length > 0 ||
           selectedDurationRanges.length > 0 ||
           selectedRatingRanges.length > 0;
  }, [selectedCategories, selectedPriceRanges, selectedDurationRanges, selectedRatingRanges]);

  // Filtrované a seřazené produkty podle vybraných kategorií, ceny, délky a sorting option
  const getSortedAndFilteredProducts = useMemo(() => {
    let filtered = products;

    // ✅ KROK 0: Search (React 19 + diacritics-insensitive best practice 2026)
    // Normalizujeme query i data → "Pariz" najde "Paříž" i "Paříž" najde "Paříž"
    if (deferredSearchQuery.trim()) {
      const query = removeDiacritics(deferredSearchQuery.toLowerCase());
      filtered = filtered.filter(product => {
        // Prohledávej title (bez diakritiky)
        const matchesTitle = removeDiacritics(product.title?.toLowerCase() || '').includes(query);

        // Prohledávej description (bez diakritiky)
        const matchesDescription = removeDiacritics(product.description?.toLowerCase() || '').includes(query);

        // Prohledávej kategorie (bez diakritiky - user friendly feature)
        const matchesCategory = product.category_ids?.some(catId => {
          const category = categories.find(c => c.id === catId);
          return removeDiacritics(category?.name?.toLowerCase() || '').includes(query);
        });

        return matchesTitle || matchesDescription || matchesCategory;
      });
    }

    // 1. Filtrování podle kategorií
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(product =>
        product.category_ids &&
        product.category_ids.some(catId => selectedCategories.includes(catId))
      );
    }

    // 2. Filtrování podle price ranges (best practice 2026)
    if (selectedPriceRanges.length > 0) {
      filtered = filtered.filter(product => {
        const price = product.priceNumeric || 0;
        return selectedPriceRanges.some(rangeId => {
          const range = priceRanges.find(r => r.id === rangeId);
          if (!range) return false;
          return price >= range.min && price < range.max;
        });
      });
    }

    // 3. Filtrování podle duration ranges
    if (selectedDurationRanges.length > 0) {
      filtered = filtered.filter(product => {
        const days = parseDurationToDays(product.duration);
        return selectedDurationRanges.some(rangeId => {
          const range = durationRanges.find(r => r.id === rangeId);
          if (!range) return false;
          return days >= range.minDays && days <= range.maxDays;
        });
      });
    }

    // 4. Filtrování podle rating ranges
    if (selectedRatingRanges.length > 0) {
      filtered = filtered.filter(product => {
        const rating = product.rating || 0;
        return selectedRatingRanges.some(rangeId => {
          const range = ratingRanges.find(r => r.id === rangeId);
          if (!range) return false;
          if (range.exact) {
            return rating === range.minRating; // Exact match pro "5 hvězdiček"
          } else {
            return rating >= range.minRating; // Range match pro "4.5+" atd.
          }
        });
      });
    }

    // 5. Řazení podle vybrané option
    const sorted = [...filtered].sort((a, b) => {
      switch (activeSortOption) {
        case 'Nejprodávanější':
          // Seřaď podle total_sales (nejvíce prodaných první)
          return (b.total_sales || 0) - (a.total_sales || 0);

        case 'Nejdražší':
          // Seřaď podle ceny (nejvyšší první)
          return (b.priceNumeric || 0) - (a.priceNumeric || 0);

        case 'Nejlevnější':
          // Seřaď podle ceny (nejnižší první)
          return (a.priceNumeric || 0) - (b.priceNumeric || 0);

        case 'Dle hodnocení':
          // Seřaď podle hodnocení (nejvyšší první)
          return (b.rating || 0) - (a.rating || 0);

        case 'Nejnovější':
          // Seřaď podle created_at (nejnovější první) - ISO string comparison
          return (b.created_at || '').localeCompare(a.created_at || '');

        default:
          // Výchozí: podle prodejnosti
          return (b.total_sales || 0) - (a.total_sales || 0);
      }
    });

    return sorted;
  }, [products, deferredSearchQuery, categories, selectedCategories, selectedPriceRanges, selectedDurationRanges, selectedRatingRanges, activeSortOption]);

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

        {/* Search & Filter Card */}
        <div className="mb-12 card-base overflow-hidden">
          
          {/* Main search bar section */}
          <div className="p-6">
            <div className="flex flex-col lg:flex-row lg:justify-between items-center gap-6">
              
              {/* Search Bar - left side */}
              <div className="relative w-full lg:max-w-md">
                {/* Search icon - left */}
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* Search input */}
                <input
                  type="text"
                  placeholder="Hledat průvodce..."
                  className="input-base w-full pl-12 pr-10 py-3 text-base"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  aria-label="Vyhledávání průvodců"
                />

                {/* Clear button - right (show only when has value) */}
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Vymazat vyhledávání"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Filter Toggle - right side */}
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="flex items-center gap-2"
                aria-label={showAdvancedFilters ? 'Sbalit filtry' : 'Rozbalit filtry'}
              >
                <img 
                  src={`${BASE_PATH}/images/filter.svg`} 
                  alt="Filter" 
                  className="w-5 h-5"
                />
                <svg className={`h-4 w-4 transition-transform duration-300 ${showAdvancedFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </Button>
            </div>
          </div>

          {/* Expanded Advanced Filters */}
          <div className={`transition-all duration-300 ease-in-out ${showAdvancedFilters ? 'max-h-[800px] sm:max-h-[500px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
            <div className="border-t border-gray-200 bg-gray-50 p-4 sm:p-6 space-y-4 sm:space-y-6">
              
              {/* Sorting Section - Top */}
              <div className="pb-4 border-b border-gray-200">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-black">Seřadit podle:</span>
                  <Dropdown
                    size="sm"
                    value={activeSortOption}
                    onChange={handleSortChange}
                    options={sortOptions}
                    showLabel={false}
                    fullWidth={false}
                    minWidth="160px"
                  />
                </div>
              </div>

              {/* Filter Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  
                  {/* Typ zážitku */}
                  <div>
                    <h4 className="font-medium text-black mb-3">Typ zážitku</h4>
                    <div className="space-y-2">
                      {categoriesWithCount.map(type => (
                        <label key={type.id} className="flex items-center justify-between text-sm cursor-pointer hover:text-green-800 transition-colors">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="rounded text-green-600 focus:ring-green-500"
                              checked={selectedCategories.includes(type.id)}
                              onChange={() => handleCategoryToggle(type.id)}
                            />
                            <span>{type.label}</span>
                          </div>
                          <span className="text-gray-500">({type.count})</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Cenové rozpětí */}
                  <div>
                    <h4 className="font-medium text-black mb-3">Cena</h4>
                    <div className="space-y-2">
                      {priceRangesWithCount.map(range => (
                        <label key={range.id} className="flex items-center justify-between text-sm cursor-pointer hover:text-green-800 transition-colors">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="rounded text-green-600 focus:ring-green-500"
                              checked={selectedPriceRanges.includes(range.id)}
                              onChange={() => handlePriceRangeToggle(range.id)}
                            />
                            <span>{range.label}</span>
                          </div>
                          <span className="text-gray-500">({range.count})</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Délka cesty */}
                  <div>
                    <h4 className="font-medium text-black mb-3">Délka</h4>
                    <div className="space-y-2">
                      {durationRangesWithCount.map(range => (
                        <label key={range.id} className="flex items-center justify-between text-sm cursor-pointer hover:text-green-800 transition-colors">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="rounded text-green-600 focus:ring-green-500"
                              checked={selectedDurationRanges.includes(range.id)}
                              onChange={() => handleDurationRangeToggle(range.id)}
                            />
                            <span>{range.label}</span>
                          </div>
                          <span className="text-gray-500">({range.count})</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Hodnocení */}
                  <div>
                    <h4 className="font-medium text-black mb-3">Hodnocení</h4>
                    <div className="space-y-2">
                      {ratingRangesWithCount.map(range => (
                        <label key={range.id} className="flex items-center justify-between text-sm cursor-pointer hover:text-green-800 transition-colors">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="rounded text-green-600 focus:ring-green-500"
                              checked={selectedRatingRanges.includes(range.id)}
                              onChange={() => handleRatingRangeToggle(range.id)}
                            />
                            <span>{range.label}</span>
                          </div>
                          <span className="text-gray-500">({range.count})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Clear filters */}
                <div className="flex justify-center pt-4 border-t border-gray-200">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="hover:text-green-800"
                    onClick={handleClearFilters}
                    disabled={!hasActiveFilters}
                    aria-label="Vymazat všechny filtry"
                  >
                    Vymazat filtry
                  </Button>
                </div>
              </div>
            </div>
        </div>

        {/* Guides Grid */}
        {loading ? (
          // Loading State
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-800"></div>
            <p className="mt-4 text-gray-600">Načítám průvodce...</p>
          </div>
        ) : error ? (
          // Error State
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Něco se pokazilo</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button
              variant="green"
              onClick={() => window.location.reload()}
            >
              Zkusit znovu
            </Button>
          </div>
        ) : getSortedAndFilteredProducts.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-6xl mb-4">🗺️</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              {products.length === 0 ? 'Zatím tu nejsou žádné průvodce' : 'Žádné průvodce neodpovídají zvoleným filtrům'}
            </h3>
            <p className="text-gray-600">
              {products.length === 0 ? 'Brzy přidáme nové destinace!' : 'Zkuste změnit vybrané kategorie'}
            </p>
          </div>
        ) : (
          // Products Grid
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {getSortedAndFilteredProducts.map((guide) => (
              <MemoizedGuideCard
                key={guide.id}
                guide={guide}
                onCardClick={handleCardClick}
              />
            ))}
          </div>
        )}
      </main>

    </Layout>
  );
};

TravelGuides.displayName = 'TravelGuides';

export default TravelGuides;