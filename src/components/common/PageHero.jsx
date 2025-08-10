import React, { useState, useCallback } from 'react';
import logger from '../../utils/logger';

class PageHeroErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('PageHero Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="relative text-center py-24 px-5 bg-gray-900 text-white overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-5xl font-bold mb-5">Stránka se načítá...</h1>
            <p className="text-xl max-w-3xl mx-auto text-gray-200">
              Něco se pokazilo při načítání hero sekce.
            </p>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}

PageHeroErrorBoundary.displayName = 'PageHeroErrorBoundary';

const PageHero = React.memo(({
  backgroundImage,
  title,
  subtitle,
  overlayOpacity = 0.5,
  className = '',
  ariaLabel = 'Hero sekce s názvem stránky'
}) => {
  const [imageError, setImageError] = useState(false);

  const handleImageError = useCallback(() => {
    setImageError(true);
    logger.warn('PageHero background image failed to load:', backgroundImage);
  }, [backgroundImage]);

  const overlayStyle = {
    backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})`
  };

  const backgroundStyle = imageError ? 
    { backgroundColor: '#1f2937' } : // fallback gray-800
    { backgroundImage: `url(${backgroundImage})` };

  return (
    <section 
      className={`relative text-center h-80 md:h-96 lg:h-112 flex items-center justify-center px-5 bg-cover bg-center bg-no-repeat text-white overflow-hidden ${className}`.trim()}
      style={backgroundStyle}
      aria-label={ariaLabel}
    >
      {/* Preload image for error handling */}
      {!imageError && backgroundImage && (
        <img
          src={backgroundImage}
          alt=""
          style={{ display: 'none' }}
          onError={handleImageError}
          aria-hidden="true"
        />
      )}
      
      {/* Dark Overlay */}
      <div className="absolute inset-0 z-0" style={overlayStyle}></div>
      
      {/* Content */}
      <div className="relative z-10 w-full">
        <h1 className="text-5xl font-bold mb-5">{title}</h1>
        {subtitle && (
          <p className="text-xl max-w-3xl mx-auto text-gray-200">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
});

PageHero.displayName = 'PageHero';

const PageHeroWithErrorBoundary = React.memo((props) => (
  <PageHeroErrorBoundary>
    <PageHero {...props} />
  </PageHeroErrorBoundary>
));

PageHeroWithErrorBoundary.displayName = 'PageHeroWithErrorBoundary';

export default PageHeroWithErrorBoundary;