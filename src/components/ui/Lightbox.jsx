import React, { useState, useCallback, useEffect, useRef } from 'react';
import { RemoveScroll } from 'react-remove-scroll';

// Sdílená fullscreen galerie (extrahováno z CustomItineraryDetail.jsx).
// Vizuálně + behaviorálně identická s kanonickým modalem na všech 4 detail stránkách.
// showCaption: opt-in pro stránky, jejichž v2 modal měl popisek aktivního obrázku + "X / Y" counter
// (ProductDetail, ItalyRoadtripDetail, SalzburgItinerary). CustomItineraryDetail (v1) tento prop neposílá.
const Lightbox = React.memo(({ images, isOpen, initialIndex = 0, onClose, showCaption = false }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const modalGalleryRef = useRef(null);
  const modalTouchStartX = useRef(0);
  const modalTouchEndX = useRef(0);
  const previousFocusRef = useRef(null);

  const handleImageError = useCallback((e) => {
    e.target.style.display = 'none';
  }, []);

  const scrollModalPrev = useCallback(() => {
    if (!modalGalleryRef.current) return;
    const container = modalGalleryRef.current;
    const scrollAmount = container.clientWidth;
    container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  }, []);

  const scrollModalNext = useCallback(() => {
    if (!modalGalleryRef.current) return;
    const container = modalGalleryRef.current;
    const scrollAmount = container.clientWidth;
    container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  }, []);

  const handleModalTouchStart = useCallback((e) => {
    modalTouchStartX.current = e.touches[0].clientX;
  }, []);

  const handleModalTouchEnd = useCallback((e) => {
    modalTouchEndX.current = e.changedTouches[0].clientX;
    const diff = modalTouchStartX.current - modalTouchEndX.current;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        scrollModalNext();
      } else {
        scrollModalPrev();
      }
    }
  }, [scrollModalNext, scrollModalPrev]);

  const handleModalScroll = useCallback(() => {
    if (!modalGalleryRef.current) return;
    const container = modalGalleryRef.current;
    const scrollLeft = container.scrollLeft;
    const containerWidth = container.clientWidth;
    const newIndex = Math.round(scrollLeft / containerWidth);
    setCurrentIndex(newIndex);
  }, []);

  // Zavření + návrat focusu na element aktivní před otevřením (jako kanonické closeModal)
  const handleClose = useCallback(() => {
    onClose();
    if (previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [onClose]);

  // Init/reset currentIndex při otevření na initialIndex (a focus + scroll sync)
  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement;
    setCurrentIndex(initialIndex);

    setTimeout(() => {
      if (modalGalleryRef.current) {
        const scrollAmount = modalGalleryRef.current.clientWidth * initialIndex;
        modalGalleryRef.current.scrollTo({ left: scrollAmount });
      }

      const closeButton = document.querySelector('[role="dialog"] button[aria-label*="Zavřít"]');
      if (closeButton) {
        closeButton.focus();
      }
    }, 100);
  }, [isOpen, initialIndex]);

  useEffect(() => {
    if (!modalGalleryRef.current || !isOpen) return;
    const container = modalGalleryRef.current;
    container.addEventListener('scroll', handleModalScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleModalScroll);
  }, [handleModalScroll, isOpen]);

  // Klávesnice + focus trap, Escape → onClose (vrací focus na předchozí element)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
      if (e.key === 'ArrowLeft') {
        scrollModalPrev();
      }
      if (e.key === 'ArrowRight') {
        scrollModalNext();
      }
      // Focus trap - prevent tabbing outside modal
      if (e.key === 'Tab') {
        const modal = document.querySelector('[role="dialog"]');
        if (modal) {
          const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
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

    // Cleanup on unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Modern cleanup
      document.documentElement.classList.remove('modal-open');
    };
  }, [isOpen, handleClose, scrollModalPrev, scrollModalNext]);

  if (!isOpen) return null;

  return (
    <RemoveScroll allowPinchZoom>
      <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Galerie obrázků">
        <div className="relative w-full h-full">
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-50 w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all duration-200 hover:scale-110"
            aria-label="Zavřít galerii"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Modal Gallery */}
          <div className="flex items-center justify-center h-full p-4">
            <div className="relative w-full max-w-4xl">
              <div
                ref={modalGalleryRef}
                className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
                onTouchStart={handleModalTouchStart}
                onTouchEnd={handleModalTouchEnd}
              >
                {images.map((image, index) => (
                  <img
                    key={index}
                    src={image.src}
                    alt={image.alt}
                    className="w-full h-auto max-h-[80vh] object-contain select-none flex-shrink-0 snap-center"
                    onError={handleImageError}
                    loading="lazy"
                    draggable={false}
                  />
                ))}
              </div>

              {/* Navigation arrows for modal */}
              <button
                onClick={scrollModalPrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all duration-200 hover:scale-110"
                aria-label="Předchozí obrázek v galerii"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/>
                </svg>
              </button>
              <button
                onClick={scrollModalNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all duration-200 hover:scale-110"
                aria-label="Následující obrázek v galerii"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                </svg>
              </button>

              {/* Caption + counter (showCaption) nad dots, aby se nepřekrývaly */}
              {showCaption && (
                <div className="absolute bottom-12 sm:bottom-16 left-1/2 -translate-x-1/2 w-full text-center px-4">
                  <p className="text-white text-sm sm:text-base font-medium leading-relaxed max-w-2xl mx-auto">
                    {images[currentIndex]?.alt}
                  </p>
                  {images.length > 1 && (
                    <div className="text-white/60 text-xs sm:text-sm mt-2">
                      {currentIndex + 1} / {images.length}
                    </div>
                  )}
                </div>
              )}

              {/* Modal dots indicator */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {images.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      index === currentIndex
                        ? 'bg-white'
                        : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </RemoveScroll>
  );
});

Lightbox.displayName = 'Lightbox';

export default Lightbox;
