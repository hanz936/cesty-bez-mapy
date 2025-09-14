import { forwardRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { NAV_ITEMS, BASE_PATH } from '../../../constants';
import ImageWithFallback from '../../common/ImageWithFallback';
import CartButton from '../../common/CartButton';

const MOBILE_MENU_CLASSES = {
  base: 'xl:hidden fixed top-20 right-4 left-4 md:right-8 md:left-8 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 transition-all duration-300 ease-in-out transform motion-reduce:transition-none',
  open: 'opacity-100 translate-y-0 scale-100',
  closed: 'opacity-0 -translate-y-4 scale-95 pointer-events-none',
};

const MobileMenu = forwardRef(({ isMenuOpen, onClose, firstMenuItemRef, onCartClick }, ref) => {
  const location = useLocation();

  return (
    <div 
      ref={ref}
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
                className="block px-6 py-4 text-black font-semibold text-base md:text-lg hover:bg-gray-50 active:bg-gray-100 hover:text-green-600 transition-colors duration-200 rounded-lg mx-2 focus:outline-none touch-manipulation supports-hover:focus-visible:ring-2 supports-hover:focus-visible:ring-green-600 supports-hover:focus-visible:ring-offset-2"
                onClick={onClose}
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
              <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Košík & Sociální sítě</span>
            </div>
            
            {/* Košík tlačítko */}
            <div className="px-4 py-2">
              <CartButton onClick={() => { onCartClick?.(); onClose(); }} itemCount={2} />
            </div>
            
            <a 
              href="https://www.instagram.com/cestybezmapy" 
              target="_blank" 
              rel="noopener noreferrer"
              aria-label="Sleduj mě na Instagramu @cestybezmapy"
              className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors duration-200 rounded-lg mx-2 focus:outline-none touch-manipulation supports-hover:focus-visible:ring-2 supports-hover:focus-visible:ring-green-600 supports-hover:focus-visible:ring-offset-2"
              onClick={onClose}
              onTouchStart={() => {}}
              role="menuitem"
            >
              <ImageWithFallback 
                src={`${BASE_PATH}/images/instagram.svg`}
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
  );
});

MobileMenu.displayName = 'MobileMenu';

export default MobileMenu;