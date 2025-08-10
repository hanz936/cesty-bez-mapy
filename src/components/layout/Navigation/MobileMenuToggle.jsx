import React, { forwardRef } from 'react';

const HAMBURGER_CLASSES = {
  base: 'absolute w-6 h-0.5 bg-black transition-all duration-300 ease-in-out motion-reduce:transition-none left-1/2 transform -translate-x-1/2 top-1/2',
  topClosed: '-translate-y-1.5',
  middleClosed: '-translate-y-0.5', 
  bottomClosed: 'translate-y-0.5',
  topOpen: 'rotate-45 -translate-y-1/2',
  middleOpen: 'opacity-0 -translate-y-1/2',
  bottomOpen: '-rotate-45 -translate-y-1/2',
};

const MobileMenuToggle = React.memo(forwardRef(({ isMenuOpen, onToggle }, ref) => {
  return (
    <button 
      ref={ref}
      id="mobile-menu-button"
      className="relative w-12 h-12 md:w-14 md:h-14 xl:hidden bg-white hover:bg-gray-50 active:bg-gray-100 rounded-lg transition-colors duration-200 motion-reduce:transition-none border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md motion-reduce:shadow-sm focus:outline-none supports-hover:focus-visible:ring-2 supports-hover:focus-visible:ring-green-600 supports-hover:focus-visible:ring-offset-2 touch-manipulation"
      onClick={onToggle}
      aria-label={isMenuOpen ? 'Zavřít menu' : 'Otevřít menu'}
      aria-expanded={isMenuOpen}
      aria-controls="mobile-menu"
    >
      <div className="absolute inset-0 flex flex-col justify-center items-center">
        <span className={`${HAMBURGER_CLASSES.base} ${isMenuOpen ? HAMBURGER_CLASSES.topOpen : HAMBURGER_CLASSES.topClosed}`}></span>
        <span className={`${HAMBURGER_CLASSES.base} ${isMenuOpen ? HAMBURGER_CLASSES.middleOpen : HAMBURGER_CLASSES.middleClosed}`}></span>
        <span className={`${HAMBURGER_CLASSES.base} ${isMenuOpen ? HAMBURGER_CLASSES.bottomOpen : HAMBURGER_CLASSES.bottomClosed}`}></span>
      </div>
    </button>
  );
}));

MobileMenuToggle.displayName = 'MobileMenuToggle';

export default MobileMenuToggle;