import React, { useState, useCallback } from 'react';
import logger from '../utils/logger';

const CLASSES = {
  section: "relative h-[calc(100vh-80px)] xl:h-[calc(100vh-96px)] overflow-hidden w-full",
  background: "w-full h-full absolute inset-0 z-0",
  backgroundImg: "w-full h-full object-cover absolute inset-0 z-0",
  video: "w-full h-full object-cover absolute inset-0 z-10", 
  content: "absolute inset-0 z-30 flex flex-col justify-end items-start px-6 sm:px-8 md:px-12 lg:px-16 xl:px-20 pb-8 sm:pb-12 md:pb-16 lg:pb-20",
};

class HeroErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('Hero Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="relative h-screen bg-gradient-to-br from-green-800 via-green-600 to-green-800 flex items-center justify-center">
          <div className="text-center text-white px-4">
            <h1 className="text-4xl font-bold mb-4">SNI CESTUJ OBJEVUJ</h1>
            <p className="text-lg opacity-90">Místo, kde najdeš inspiraci na cesty</p>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}

HeroErrorBoundary.displayName = 'HeroErrorBoundary';

const Hero = () => {
  const [videoError, setVideoError] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleVideoError = useCallback(() => {
    setVideoError(true);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  return (
    <section 
      className={CLASSES.section}
      role="banner"
      aria-labelledby="hero-heading"
    >
      {!imageError && (
        <img 
          src="/cesty-bez-mapy/images/hero-background.png" 
          alt="Cestování a objevování světa - pozadí s krásnými destinacemi" 
          className={CLASSES.backgroundImg}
          width="1920"
          height="1080"
          onError={handleImageError}
          loading="eager"
        />
      )}
      
      {imageError && (
        <div 
          className={`${CLASSES.background} bg-gradient-to-br from-green-800 via-green-600 to-green-800`}
          aria-hidden="true"
        />
      )}
      
      {!videoError && (
        <video 
          className={CLASSES.video}
          autoPlay 
          muted 
          loop 
          playsInline
          width="1920"
          height="1080"
          aria-hidden="true"
          onError={handleVideoError}
        >
          <source src="/cesty-bez-mapy/video/background.mp4" type="video/mp4" />
          Váš prohlížeč nepodporuje video přehrávání.
        </video>
      )}

      <div className={CLASSES.content}>
        <div className="text-white text-left max-w-4xl w-full">
          <h1 
            id="hero-heading"
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight drop-shadow-2xl mb-3 sm:mb-4 md:mb-6 lg:mb-8"
          >
            <span className="block mb-1 sm:mb-2">SNI</span>
            <span className="block mb-1 sm:mb-2">CESTUJ</span>
            <span className="block">OBJEVUJ</span>
          </h1>
          
          <p className="text-sm sm:text-base md:text-lg lg:text-xl leading-relaxed drop-shadow-2xl max-w-xl sm:max-w-2xl opacity-90">
            Místo, kde najdeš inspiraci, itineráře i tipy na místa, která se do běžných průvodců nevešla. Přidej se a nech se vést světem.
          </p>
        </div>
      </div>
    </section>
  );
};

Hero.displayName = 'Hero';

const HeroWithErrorBoundary = () => (
  <HeroErrorBoundary>
    <Hero />
  </HeroErrorBoundary>
);

HeroWithErrorBoundary.displayName = 'HeroWithErrorBoundary';

export default HeroWithErrorBoundary;