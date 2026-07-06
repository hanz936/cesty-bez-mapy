// ================================================
// Cart Context - Správa stavu košíku
// ================================================
// - addToCart(product) - přidat produkt (max 1 ks od každého)
// - removeFromCart(productId) - odebrat produkt
// - clearCart() - vyprázdnit košík
// - cartItems - pole produktů v košíku
// - cartTotal - celková cena
// - itemCount - počet položek
// - Persistuje v localStorage
// ================================================

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

export interface CartItem {
  id: string;
  title: string;
  price: number;
  image: string | null;
  alt: string;
  duration: string;
  slug: string;
  quantity: number;
  customItineraryRequestId: string | null;
}

// Vstup do addToCart: čte se z produktu (Supabase products řádek nebo custom
// itinerary request), který je vždy naplněn z .jsx volajících (checkJs false,
// nekontrolováno) — tvar je proto self-konzistentní odvozený jen z polí, která
// addToCart skutečně čte, ne z reálného zdrojového typu produktu.
// `image` je NEPOVINNÉ pole typované `string | null` (ne volitelné/`?`) tak, aby
// `product.image_url || product.image` (ř. níže) vyšlo přesně `string | null`
// (bez `undefined`) — viz CartItem.image.
interface AddToCartInput {
  id: string;
  title: string;
  price: number;
  image_url?: string | null;
  image: string | null;
  alt?: string;
  duration?: string;
  slug: string;
  customItineraryRequestId?: string | null;
}

export interface CartContextValue {
  cartItems: CartItem[];
  cartTotal: number;
  itemCount: number;
  isInitialized: boolean;
  addToCart: (product: AddToCartInput) => boolean;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  isInCart: (productId: string) => boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

// Klíč pro localStorage
const CART_STORAGE_KEY = 'cbm_cart';

interface CartProviderProps {
  children: ReactNode;
}

// Provider komponenta
export function CartProvider({ children }: CartProviderProps) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Načtení košíku z localStorage při prvním renderování
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        // JSON.parse vrací `any`; obsah localStorage nemá běhový shape-check
        // (jen Array.isArray) ani před migrací neměl — assertion odpovídá
        // vzoru z ares.ts/blog.ts, běhové chování beze změny.
        const parsed = JSON.parse(savedCart) as CartItem[];
        // Validace dat
        if (Array.isArray(parsed)) {
          setCartItems(parsed);
        }
      }
    } catch (error) {
      console.error('Chyba při načítání košíku z localStorage:', error);
      localStorage.removeItem(CART_STORAGE_KEY);
    }
    setIsInitialized(true);
  }, []);

  // Uložení košíku do localStorage při změně
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
      } catch (error) {
        console.error('Chyba při ukládání košíku do localStorage:', error);
      }
    }
  }, [cartItems, isInitialized]);

  // Přidání produktu do košíku (max 1 ks od každého)
  const addToCart = useCallback((product: AddToCartInput) => {
    // eslint-disable-next-line @typescript-eslint/prefer-optional-chain -- pre-existing JS guard clause, byte-identical (behavior unchanged: `product` is call-time defensive, not statically nullable)
    if (!product || !product.id) {
      console.error('Nelze přidat produkt bez ID do košíku');
      return false;
    }

    setCartItems((prevItems) => {
      // Kontrola, zda už produkt není v košíku
      const existingItem = prevItems.find((item) => item.id === product.id);

      if (existingItem) {
        // Produkt už je v košíku - nepřidáváme duplicitně
        console.log('Produkt už je v košíku:', product.title);
        return prevItems;
      }

      // Přidáme nový produkt
      const newItem: CartItem = {
        id: product.id,
        title: product.title,
        price: product.price,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: falls through image_url → image (both may be '' at runtime, not just null/undefined)
        image: product.image_url || product.image,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string alt must fall through to the generated fallback
        alt: product.alt || `Průvodce: ${product.title}`,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string duration must fall through to ''
        duration: product.duration || '',
        slug: product.slug,
        quantity: 1, // Vždy 1 ks
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string customItineraryRequestId must fall through to null
        customItineraryRequestId: product.customItineraryRequestId || null,
      };

      console.log('Přidávám do košíku:', newItem.title);
      return [...prevItems, newItem];
    });

    return true;
  }, []);

  // Odebrání produktu z košíku
  const removeFromCart = useCallback((productId: string) => {
    setCartItems((prevItems) => {
      const newItems = prevItems.filter((item) => item.id !== productId);
      console.log('Odebírám z košíku, zbývá položek:', newItems.length);
      return newItems;
    });
  }, []);

  // Vyprázdnění celého košíku
  const clearCart = useCallback(() => {
    console.log('Vyprazdňuji košík');
    setCartItems([]);
  }, []);

  // Kontrola, zda je produkt v košíku
  const isInCart = useCallback((productId: string) => {
    return cartItems.some((item) => item.id === productId);
  }, [cartItems]);

  // Výpočet celkové ceny
  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [cartItems]);

  // Počet položek
  const itemCount = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItems]);

  // Hodnota kontextu
  const value = useMemo(() => ({
    cartItems,
    cartTotal,
    itemCount,
    isInitialized,
    addToCart,
    removeFromCart,
    clearCart,
    isInCart,
  }), [cartItems, cartTotal, itemCount, isInitialized, addToCart, removeFromCart, clearCart, isInCart]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

// Hook pro použití kontextu
// eslint-disable-next-line react-refresh/only-export-components
export function useCart(): CartContextValue {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCart musí být použit uvnitř CartProvider');
  }

  return context;
}

export default CartContext;
