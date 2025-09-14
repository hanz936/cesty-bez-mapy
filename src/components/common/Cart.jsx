import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui';
import { BASE_PATH, ROUTES } from '../../constants';

// Statická data itinerářů pro košík (mockup)
const MOCK_CART_ITEMS = [
  {
    id: 1,
    title: 'Roadtrip po Itálii na 20 dní',
    price: 699,
    image: `${BASE_PATH}/images/guide-italy-roadtrip.png`,
    alt: 'Malebná italská krajina s cestou vedoucí mezi kopci',
    duration: '20 dní',
    quantity: 1
  },
  {
    id: 0,
    title: 'Itinerář na míru – cesta šitá jen pro tebe',
    price: 999,
    image: `${BASE_PATH}/images/custom-itinerary.png`,
    alt: 'Otevřená mapa s tužkou a poznámkami pro plánování cesty na míru',
    duration: 'Dle potřeb',
    quantity: 1
  }
];

const CartItem = React.memo(({ item, onRemove }) => {
  const [imageError, setImageError] = useState(false);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  return (
    <div className="flex gap-4 py-4 border-b border-gray-100 last:border-b-0">
      <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
        {!imageError ? (
          <img 
            src={item.image} 
            alt={item.alt}
            className="w-full h-full object-cover"
            onError={handleImageError}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
            <span className="text-green-800 text-xl">🗺️</span>
          </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-black line-clamp-2 leading-tight mb-1">
          {item.title}
        </h4>
        <p className="text-xs text-gray-600 mb-2">
          📅 {item.duration}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-green-800">
            {item.price.toLocaleString()} Kč
          </span>
          <button
            onClick={() => onRemove(item.id)}
            className="text-gray-400 hover:text-red-500 transition-colors p-1"
            aria-label={`Odebrat ${item.title} z košíku`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
});

CartItem.displayName = 'CartItem';

const Cart = React.memo(({ isOpen, onClose }) => {
  const [cartItems, setCartItems] = useState(MOCK_CART_ITEMS);
  const cartRef = useRef(null);
  const previousFocusRef = useRef(null);
  const navigate = useNavigate();

  // Výpočty
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const vat = Math.round(subtotal * 0.21); // 21% DPH
  const total = subtotal;
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Odebrání položky z košíku
  const handleRemoveItem = useCallback((itemId) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== itemId));
  }, []);

  // Zavření košíku
  const handleClose = useCallback(() => {
    onClose();
    if (previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [onClose]);

  // Přechod na checkout stránku
  const handleCheckout = useCallback(() => {
    navigate(ROUTES.CHECKOUT);
    onClose();
  }, [navigate, onClose]);

  // Obsluha klávesnice
  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
      
      // Focus trap
      if (e.key === 'Tab') {
        const focusableElements = cartRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements?.length) {
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
    
    // Focus na košík při otevření
    setTimeout(() => {
      const closeButton = cartRef.current?.querySelector('button[aria-label*="Zavřít"]');
      closeButton?.focus();
    }, 100);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleClose]);

  // Scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-200 ease-out"
        onClick={handleClose}
        aria-hidden="true"
      />
      
      {/* Cart Panel */}
      <div 
        ref={cartRef}
        className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 id="cart-title" className="text-xl font-bold text-black">
            Tvůj košík ({itemCount})
          </h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Zavřít košík"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cart Content */}
        <div className="flex-1 overflow-y-auto">
          {cartItems.length === 0 ? (
            // Prázdný košík
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.35 2.35M7 13h10m-10 0v6a2 2 0 002 2h6a2 2 0 002-2v-6m-8 0V9a2 2 0 012-2h4a2 2 0 012 2v4m-6 0h2m2 0h2" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-black mb-2">
                Tvůj košík je prázdný
              </h3>
              <p className="text-gray-600 text-sm mb-6">
                Přidej si nějaký itinerář a začni plánovat svou další cestu.
              </p>
              <Button 
                variant="green" 
                size="md"
                onClick={handleClose}
              >
                Pokračovat v nákupu
              </Button>
            </div>
          ) : (
            // Seznam položek
            <div className="px-6 py-4">
              {cartItems.map((item) => (
                <CartItem
                  key={item.id}
                  item={item}
                  onRemove={handleRemoveItem}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer - Summary & Checkout */}
        {cartItems.length > 0 && (
          <div className="border-t border-gray-200 p-6 bg-gray-50">
            {/* Cenový souhrn */}
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm text-black">
                <span>Mezisoučet:</span>
                <span>{subtotal.toLocaleString()} Kč</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>DPH (21%):</span>
                <span>Zahrnuto v ceně</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-black pt-3 border-t border-gray-300">
                <span>Celkem:</span>
                <span className="text-green-800">{total.toLocaleString()} Kč</span>
              </div>
            </div>

            {/* Checkout tlačítko */}
            <Button
              onClick={handleCheckout}
              variant="green"
              size="lg"
              fullWidth
              className="mb-3"
            >
              Přejít k objednávce
            </Button>
            
            <Button
              variant="secondary"
              size="md"
              fullWidth
              onClick={handleClose}
            >
              Pokračovat v nákupu
            </Button>

            {/* Bezpečnostní info */}
            <div className="flex items-center justify-center mt-4 text-xs text-gray-500">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Bezpečná platba
            </div>
          </div>
        )}
      </div>
      
    </>
  );
});

Cart.displayName = 'Cart';

export default Cart;