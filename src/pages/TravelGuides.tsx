import { useState, useCallback, useEffect, useMemo, useDeferredValue, memo } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import PageHero from '../components/common/PageHero';
import { Button, Dropdown } from '../components/ui';
import SeoTags from '../components/common/SeoTags';
import { buildPageMeta } from '../utils/pageSeo';
import { BASE_PATH, ROUTES } from '../constants';
import { supabase } from '../lib/supabase';
import type { Tables } from '../types/database.types';

interface GuideCardProps {
  guide: ReturnType<typeof mapProductToGuide>;
  onCardClick: (guide: ReturnType<typeof mapProductToGuide>) => void;
}

const GuideCard = ({ guide, onCardClick }: GuideCardProps) => {
  const [imageError, setImageError] = useState(false);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  const handleCardClick = useCallback(() => {
    onCardClick(guide);
  }, [guide, onCardClick]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
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
          {guide.reviewCount > 0 && (
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
              <span className="text-sm text-gray-600 font-medium">{guide.rating} ({guide.reviewCount})</span>
            </div>
          )}
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
const parseDurationToDays = (duration: string): number => {
  if (!duration || duration === 'Neuvedeno') return 0;
  // eslint-disable-next-line @typescript-eslint/prefer-regexp-exec -- pre-existing `.match()` call, left byte-identical (RegExp#exec() would be an equivalent but unrequested rewrite)
  const match = duration.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
};

/**
 * Cache pro normalized strings (performance optimization)
 * Best practice 2026: Prevence zbytečných NFD normalizací
 * Zdroj: ClarityDev, Listiak.dev, MDN
 */
const diacriticsCache = new Map<string, string>();

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
const removeDiacritics = (str: string): string => {
  if (!str) return '';

  // ✅ Check cache first (performance optimization)
  if (diacriticsCache.has(str)) {
    // Non-null assertion: `.has(str)` just confirmed presence; `Map.get()`'s return type is
    // `string | undefined` regardless (TS doesn't narrow through the separate `.has()` call).
    return diacriticsCache.get(str)!;
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
const mapProductToGuide = (product: Tables<'products'>) => {
  return {
    id: product.id,
    title: product.title,
    description: product.description,
    price: product.price === 0 ? 'Zdarma' : `${product.price} Kč`,
    priceNumeric: product.price || 0, // Pro sorting
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string duration must fall through to fallback (?? would change behavior)
    duration: product.duration || 'Neuvedeno',
    rating: product.average_rating ?? 0,
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string image_url must fall through to fallback (?? would change behavior)
    image: product.image_url || `${BASE_PATH}/images/placeholder-guide.jpg`,
    alt: `Průvodce: ${product.title}`,
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string badge must fall through to fallback (?? would change behavior)
    badge: product.badge || 'Průvodce',
    category: 'Kategorie',
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: pre-existing fallback, left byte-identical
    category_ids: product.category_ids || [], // UUID array kategorií
    isFree: product.price === 0,
    slug: product.slug,
    reviewCount: product.review_count ?? 0,
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

/** Rating UI (hvězdičky na kartách + filtr) se ukazuje, až když má aspoň jeden produkt recenze. */
export function hasAnyReviews(guides: { reviewCount: number }[]): boolean {
  return guides.some((g) => g.reviewCount > 0);
}

const SORT_OPTIONS = [
  'Nejprodávanější',
  'Nejdražší',
  'Nejlevnější',
  'Dle hodnocení',
  'Nejnovější'
];

/** Sort „Dle hodnocení" se nabízí, až když má aspoň jeden produkt recenze (stejný gate jako hvězdičky/filtr). */
export function visibleSortOptions(hasReviews: boolean): string[] {
  return hasReviews ? [...SORT_OPTIONS] : SORT_OPTIONS.filter((o) => o !== 'Dle hodnocení');
}

const TravelGuides = () => {
  // State pro produkty a UI
  const [products, setProducts] = useState<ReturnType<typeof mapProductToGuide>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State pro filtry a sorting
  const [activeSortOption, setActiveSortOption] = useState('Nejprodávanější');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [categories, setCategories] = useState<Pick<Tables<'categories'>, 'id' | 'name' | 'slug'>[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPriceRanges, setSelectedPriceRanges] = useState<string[]>([]);
  const [selectedDurationRanges, setSelectedDurationRanges] = useState<string[]>([]);
  const [selectedRatingRanges, setSelectedRatingRanges] = useState<string[]>([]);

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
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string message must fall through to fallback (?? would change behavior)
        setError((err as { message?: string }).message || 'Nepodařilo se načíst produkty');
      } finally {
        setLoading(false);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- pre-existing fire-and-forget async function call inside useEffect (useEffect callbacks can't be async)
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

    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- pre-existing fire-and-forget async function call inside useEffect (useEffect callbacks can't be async)
    fetchCategories();
  }, []);

  const handleSortChange = useCallback((e: { target: { value: string } }) => {
    setActiveSortOption(e.target.value);
  }, []);

  const handleCardClick = useCallback((guide: ReturnType<typeof mapProductToGuide>) => {
    // Dynamická navigace na detail produktu podle slug
    if (guide.slug) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- pre-existing fire-and-forget navigation (react-router NavigateFunction returns void | Promise<void>)
      navigate(`/cestovni-pruvodci/${guide.slug}`);
      window.scrollTo(0, 0);
    }
  }, [navigate]);

  // Spočítej produkty pro každou kategorii (useMemo pro cached computed value)
  const categoriesWithCount = useMemo(() => {
    return categories.map(category => {
      const count = products.filter(product =>
        // eslint-disable-next-line @typescript-eslint/prefer-optional-chain -- pre-existing JS guard clause, byte-identical (behavior unchanged: `category_ids` is a plain array, not statically nullable here)
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
  const handleCategoryToggle = useCallback((categoryId: string) => {
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
  const handlePriceRangeToggle = useCallback((rangeId: string) => {
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
  const handleDurationRangeToggle = useCallback((rangeId: string) => {
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
  const handleRatingRangeToggle = useCallback((rangeId: string) => {
    setSelectedRatingRanges(prev => {
      if (prev.includes(rangeId)) {
        return prev.filter(id => id !== rangeId);
      } else {
        return [...prev, rangeId];
      }
    });
  }, []);

  // ✅ React 19: Handler pro search input (best practice 2026)
  const handleSearchChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
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

  // ✅ Rating UI (hvězdičky na kartách + filtr) se ukazuje jen když existují reálné recenze
  const showRatingFilter = useMemo(() => hasAnyReviews(products), [products]);

  // Sort „Dle hodnocení" sdílí stejný gate — bez recenzí se v dropdownu nenabízí
  const sortOptions = visibleSortOptions(showRatingFilter);

  // Když showRatingFilter spadne na false (žádné produkty s recenzí), vynuluj vybrané rating
  // filtry — bez UI se sice nedají nastavit, ale stav by mohl přežít z dřívějška a potichu
  // skrýt produkty. Totéž pro sort „Dle hodnocení": bez nabídky v dropdownu se vrací na
  // výchozí „Nejprodávanější" (funkční updater — activeSortOption nepatří do deps).
  useEffect(() => {
    if (!showRatingFilter) {
      setSelectedRatingRanges([]);
      setActiveSortOption((prev) => (prev === 'Dle hodnocení' ? 'Nejprodávanější' : prev));
    }
  }, [showRatingFilter]);

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
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string category name must fall through to fallback (?? would change behavior)
          return removeDiacritics(category?.name?.toLowerCase() || '').includes(query);
        });

        return matchesTitle || matchesDescription || matchesCategory;
      });
    }

    // 1. Filtrování podle kategorií
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(product =>
        // eslint-disable-next-line @typescript-eslint/prefer-optional-chain -- pre-existing JS guard clause, byte-identical (behavior unchanged: `category_ids` is a plain array, not statically nullable here)
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

    // 4. Filtrování podle rating ranges (jen když jsou reálné recenze — jinak by filtr byl neviditelný, ale funkční)
    if (showRatingFilter && selectedRatingRanges.length > 0) {
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
  }, [products, deferredSearchQuery, categories, selectedCategories, selectedPriceRanges, selectedDurationRanges, selectedRatingRanges, showRatingFilter, activeSortOption]);

  return (
    // ready až po dofetchnutí produktů — jinak prerender snapshotne loading stav
    // bez gridu (a bez hvězdiček); při chybě fetche ready nedáme vůbec, ať build
    // spadne nahlas místo shipnutí chybové stránky (stejná sémantika jako ProductDetail)
    <Layout ready={!loading && !error}>
      <SeoTags meta={buildPageMeta(ROUTES.TRAVEL_GUIDES)} />

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

                  {/* Hodnocení — jen když existují reálné recenze */}
                  {showRatingFilter && (
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
                  )}
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