import React from 'react';
import { useNavigation } from '../../../hooks';
import logger from '../../../utils/logger';
import Logo from './Logo';
import DesktopMenu from './DesktopMenu';
import MobileMenu from './MobileMenu';
import MobileMenuToggle from './MobileMenuToggle';

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

const Navigation = () => {
  const {
    isMenuOpen,
    toggleMenu,
    closeMenu,
    menuRef,
    buttonRef,
    firstMenuItemRef
  } = useNavigation();

  return (
    <nav className="bg-white px-4 md:px-8 flex items-center justify-between z-50 relative h-20 xl:h-24" role="navigation">
      <Logo />

      <MobileMenuToggle 
        ref={buttonRef}
        isMenuOpen={isMenuOpen}
        onToggle={toggleMenu}
      />

      <DesktopMenu />

      {/* Mobile menu overlay */}
      {isMenuOpen && (
        <div 
          className="xl:hidden fixed inset-0 z-40 opacity-0 top-20 xl:top-24"
          onClick={closeMenu}
          onTouchStart={closeMenu}
          aria-hidden="true"
        />
      )}

      <MobileMenu
        ref={menuRef}
        isMenuOpen={isMenuOpen}
        onClose={closeMenu}
        firstMenuItemRef={firstMenuItemRef}
      />
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