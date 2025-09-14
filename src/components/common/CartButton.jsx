import React, { useState, useCallback } from 'react';
import { BASE_PATH } from '../../constants';

const CartButton = React.memo(({ onClick, itemCount = 2 }) => {
  const [imageError, setImageError] = useState(false);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  const handleClick = useCallback((e) => {
    e.preventDefault();
    onClick?.();
  }, [onClick]);

  return (
    <button
      onClick={handleClick}
      className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 focus:outline-none supports-hover:focus-visible:ring-2 supports-hover:focus-visible:ring-green-600 supports-hover:focus-visible:ring-offset-2"
      aria-label={`Otevřít košík (${itemCount} ${itemCount === 1 ? 'položka' : itemCount < 5 ? 'položky' : 'položek'})`}
    >
      {/* Košík ikona */}
      {!imageError ? (
        <img 
          src={`${BASE_PATH}/images/shopping-cart.svg`} 
          alt="Košík" 
          className="w-6 h-6 text-gray-700"
          onError={handleImageError}
          loading="eager"
        />
      ) : (
        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.35 2.35M7 13h10m-10 0v6a2 2 0 002 2h6a2 2 0 002-2v-6m-8 0V9a2 2 0 012-2h4a2 2 0 012 2v4m-6 0h2m2 0h2" />
        </svg>
      )}
      
      {/* Počítadlo položek */}
      {itemCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-green-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
    </button>
  );
});

CartButton.displayName = 'CartButton';

export default CartButton;