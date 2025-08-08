import React, { useState, useCallback, useEffect, memo, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import logger from '../utils/logger';

const NAV_ITEMS = [
  { href: "/naplanuj-si-cestu-snu", text: "Naplánuj si cestu snů" },
  { href: "/cestovni-pruvodci", text: "Cestovní průvodci" },
  { href: "/inspirace", text: "Inspirace na cesty" },
  { href: "/muj-pribeh", text: "Můj příběh" },
  { href: "/spoluprace", text: "Spolupráce" }
];

class NavigationErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('Navigation Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <nav className="bg-white px-4 md:px-8 h-20 xl:h-24 flex items-center justify-center">
          <p className="text-gray-600">Navigation temporarily unavailable</p>
        </nav>
      );
    }

    return this.props.children;
  }
}

NavigationErrorBoundary.displayName = 'NavigationErrorBoundary';

const HAMBURGER_CLASSES = {
  base: 'absolute w-6 h-0.5 bg-black transition-all duration-300 ease-in-out motion-reduce:transition-none left-1/2 transform -translate-x-1/2 top-1/2',
  topClosed: '-translate-y-1.5',
  middleClosed: '-translate-y-0.5', 
  bottomClosed: 'translate-y-0.5',
  topOpen: 'rotate-45 -translate-y-1/2',
  middleOpen: 'opacity-0 -translate-y-1/2',
  bottomOpen: '-rotate-45 -translate-y-1/2',
};

const MOBILE_MENU_CLASSES = {
  base: 'xl:hidden fixed top-20 right-4 left-4 md:right-8 md:left-8 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 transition-all duration-300 ease-in-out transform motion-reduce:transition-none',
  open: 'opacity-100 translate-y-0 scale-100',
  closed: 'opacity-0 -translate-y-4 scale-95 pointer-events-none',
};

const ImageWithFallback = memo(({ src, alt, className, fallback, loading = "lazy" }) => {
  const [hasError, setHasError] = useState(false);
  
  const handleError = useCallback(() => {
    setHasError(true);
  }, []);
  
  if (hasError) {
    const fallbackClassName = className || '';
    return fallback || (
      <div className={`${fallbackClassName} min-h-7 min-w-7 bg-gray-200 flex items-center justify-center text-xs text-gray-500`}>
        ?
      </div>
    );
  }
  
  return (
    <img 
      src={src}
      alt={alt}
      className={className}
      onError={handleError}
      loading={loading}
    />
  );
});

ImageWithFallback.displayName = 'ImageWithFallback';

const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const firstMenuItemRef = useRef(null);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen(prev => {
      const newState = !prev;
      if (newState) {
        setTimeout(() => {
          firstMenuItemRef.current?.focus();
        }, 100);
      } else {
        buttonRef.current?.focus();
      }
      return newState;
    });
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isMenuOpen) return;
      
      if (event.key === 'Escape') {
        closeMenu();
        return;
      }
      
      if (event.key === 'Tab') {
        const menuElement = menuRef.current;
        if (!menuElement) return;
        
        const focusableElements = menuElement.querySelectorAll(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    const handleResize = () => {
      if (isMenuOpen && window.innerWidth >= 1280) {
        closeMenu();
      }
    };

    if (isMenuOpen) {
      document.addEventListener('keydown', handleKeyDown);
      window.addEventListener('resize', handleResize);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      document.body.style.overflow = 'unset';
    };
  }, [isMenuOpen, closeMenu]);

  return (
    <nav className="bg-white px-4 md:px-8 flex items-center justify-between z-50 relative h-20 xl:h-24" role="navigation">
      <Link 
        to="/" 
        className="flex items-center gap-1 sm:gap-2 md:gap-3 lg:gap-4 text-inherit h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 rounded"
        aria-label="Cesty bez mapy - domovská stránka"
      >
        <ImageWithFallback 
          src="/images/logo.png" 
          alt="Cesty bez mapy logo" 
          className="h-16 xl:h-20 w-auto"
          loading="eager"
          fallback={<div className="h-16 xl:h-20 w-16 xl:w-20 bg-gray-200 rounded flex items-center justify-center text-gray-500 text-xs">Logo</div>}
        />
        <span className="font-bold text-base sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl text-black leading-none">
          Cesty (bez) mapy
        </span>
      </Link>

      <button 
        ref={buttonRef}
        id="mobile-menu-button"
        className="relative w-12 h-12 md:w-14 md:h-14 xl:hidden bg-white hover:bg-gray-50 active:bg-gray-100 rounded-lg transition-colors duration-200 motion-reduce:transition-none border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md motion-reduce:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 touch-manipulation"
        onClick={toggleMenu}
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

      <div className="hidden xl:flex flex-1 justify-center items-center h-full">
        <ul className="list-none flex flex-wrap justify-center items-center h-full">
          {NAV_ITEMS.map((item, index) => (
            <li key={item.href} className="relative px-5">
              <Link 
                to={item.href}
                className="text-black font-bold text-lg whitespace-nowrap hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 rounded transition-colors duration-200 motion-reduce:transition-none"
                aria-current={location.pathname === item.href ? "page" : undefined}
              >
                {item.text}
              </Link>
              {index < NAV_ITEMS.length - 1 && (
                <div className="absolute right-0 top-1/2 transform -translate-y-1/2 h-5 w-px bg-gray-300" aria-hidden="true"></div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="hidden xl:flex items-center gap-2.5 h-full">
        <a 
          href="https://www.instagram.com/cestybezmapy" 
          target="_blank" 
          rel="noopener noreferrer"
          aria-label="Sleduj mě na Instagramu @cestybezmapy"
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 rounded touch-manipulation"
        >
          <ImageWithFallback 
            src="/images/instagram.svg" 
            alt="Instagram" 
            className="w-7 h-7 grayscale hover:grayscale-0 transition-all duration-300 motion-reduce:transition-none"
            loading="eager"
            fallback={<div className="w-7 h-7 bg-gray-400 rounded flex items-center justify-center text-white text-xs">IG</div>}
          />
        </a>
      </div>

      {isMenuOpen && (
        <div 
          className="xl:hidden fixed inset-0 z-40 opacity-0 top-20 xl:top-24"
          onClick={closeMenu}
          onTouchStart={closeMenu}
          aria-hidden="true"
        />
      )}

      <div 
        ref={menuRef}
        id="mobile-menu"
        className={`${MOBILE_MENU_CLASSES.base} ${isMenuOpen ? MOBILE_MENU_CLASSES.open : MOBILE_MENU_CLASSES.closed}`}
        role="menu"
        aria-labelledby="mobile-menu-button"
      >
        <div className="py-4">
          <ul className="list-none space-y-1" role="none">
            {NAV_ITEMS.map((item, index) => (
              <li key={item.href} role="none">
                <Link 
                  ref={index === 0 ? firstMenuItemRef : null}
                  to={item.href}
                  className="block px-6 py-4 text-black font-semibold text-base md:text-lg hover:bg-gray-50 active:bg-gray-100 hover:text-green-600 transition-colors duration-200 rounded-lg mx-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 touch-manipulation"
                  onClick={closeMenu}
                  onTouchStart={() => {}}
                  role="menuitem"
                  aria-current={location.pathname === item.href ? "page" : undefined}
                >
                  {item.text}
                </Link>
              </li>
            ))}
            
            <li className="border-t border-gray-100 mt-4 pt-4">
              <div className="px-6 py-2">
                <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Sleduj mě</span>
              </div>
              <a 
                href="https://www.instagram.com/cestybezmapy" 
                target="_blank" 
                rel="noopener noreferrer"
                aria-label="Sleduj mě na Instagramu @cestybezmapy"
                className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors duration-200 rounded-lg mx-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 touch-manipulation"
                onClick={closeMenu}
                onTouchStart={() => {}}
                role="menuitem"
              >
                <ImageWithFallback 
                  src="/images/instagram.svg" 
                  alt="Instagram" 
                  className="w-6 h-6 md:w-7 md:h-7"
                  loading="eager"
                  fallback={<div className="w-6 h-6 md:w-7 md:h-7 bg-gray-400 rounded flex items-center justify-center text-white text-xs">IG</div>}
                />
              </a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

Navigation.displayName = 'Navigation';

const NavigationWithErrorBoundary = () => (
  <NavigationErrorBoundary>
    <Navigation />
  </NavigationErrorBoundary>
);

NavigationWithErrorBoundary.displayName = 'NavigationWithErrorBoundary';

export default NavigationWithErrorBoundary;