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

const CartContext = createContext(null);

// Klíč pro localStorage
const CART_STORAGE_KEY = 'cbm_cart';

// Provider komponenta
export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Načtení košíku z localStorage při prvním renderování
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
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
  const addToCart = useCallback((product) => {
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
      const newItem = {
        id: product.id,
        title: product.title,
        price: product.price,
        image: product.image_url || product.image,
        alt: product.alt || `Průvodce: ${product.title}`,
        duration: product.duration || '',
        slug: product.slug,
        quantity: 1, // Vždy 1 ks
      };

      console.log('Přidávám do košíku:', newItem.title);
      return [...prevItems, newItem];
    });

    return true;
  }, []);

  // Odebrání produktu z košíku
  const removeFromCart = useCallback((productId) => {
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
  const isInCart = useCallback((productId) => {
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
export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCart musí být použit uvnitř CartProvider');
  }

  return context;
}

export default CartContext;
