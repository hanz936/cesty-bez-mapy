import { useState, useCallback, useEffect, useRef } from 'react';

export const useNavigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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

  return {
    isMenuOpen,
    toggleMenu,
    closeMenu,
    menuRef,
    buttonRef,
    firstMenuItemRef
  };
};