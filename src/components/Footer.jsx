import React, { useState, memo, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import logger from '../utils/logger';

class FooterErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error) {
    logger.error('Footer render error:', _error);
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('Footer Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <footer className="bg-gray-100 py-8 text-center">
          <p className="text-gray-600">Footer temporarily unavailable</p>
        </footer>
      );
    }

    return this.props.children;
  }
}

FooterErrorBoundary.displayName = 'FooterErrorBoundary';

const linkClassName = "text-black text-sm transition-colors duration-300 motion-reduce:transition-none leading-relaxed hover:text-green-800 focus-visible:text-green-800 focus:outline-none supports-hover:focus-visible:ring-2 supports-hover:focus-visible:ring-green-600 supports-hover:focus-visible:ring-offset-2 rounded";

const BLUR_CIRCLES = [
  { id: 'blur-1', className: 'absolute top-10 left-10 w-20 h-20 bg-green-800 rounded-full blur-xl' },
  { id: 'blur-2', className: 'absolute top-32 right-20 w-16 h-16 bg-green-600 rounded-full blur-xl' },
  { id: 'blur-3', className: 'absolute bottom-20 left-1/4 w-12 h-12 bg-green-700 rounded-full blur-xl' }
];

const aboutLinks = [
  { href: "/muj-pribeh", text: "Můj příběh" },
  { href: "/spoluprace", text: "Spolupráce" },
  { href: "#kontakt", text: "Kontakt" },
  { href: "#faq", text: "Často kladené otázky" },
  { href: "/inspirace", text: "Blog" }
];

const planningLinks = [
  { href: "/naplanuj-si-cestu-snu", text: "Jak to funguje" },
  { href: "/inspirace", text: "Recenze" }
];

const NavigationSection = memo(({ title, links, ariaLabel, className = "" }) => {
  const location = useLocation();
  
  return (
    <nav className={`text-center md:text-left mb-12 md:mb-0 flex-shrink-0 ${className}`.trim()} aria-label={ariaLabel}>
      <div className="mb-6">
        <h3 className="text-green-800 font-bold text-base uppercase tracking-wider">
          {title}
        </h3>
      </div>
      <ul className="list-none space-y-3">
        {links.map((item, index) => (
          <li key={`${ariaLabel}-${index}-${item.href}`}>
            {item.href.startsWith('#') ? (
              <a 
                href={item.href}
                className={linkClassName}
              >
                {item.text}
              </a>
            ) : (
              <Link 
                to={item.href}
                className={linkClassName}
                aria-current={location.pathname === item.href ? "page" : undefined}
              >
                {item.text}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
});

NavigationSection.displayName = 'NavigationSection';

const ImageWithFallback = memo(({ src, alt, className, fallback = null, loading = "lazy" }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const handleLoad = useCallback(() => {
    setImageLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setImageError(true);
    setImageLoading(false);
  }, []);

  const fallbackClassName = React.useMemo(() => {
    if (!className) return '';
    return className
      .replace(/opacity-\d+/g, '')
      .replace(/grayscale/g, '')
      .replace(/hover:grayscale-0/g, '')
      .replace(/transition-(?:colors|opacity|all)/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }, [className]);

  const imageClassName = React.useMemo(() => {
    const loadingClass = imageLoading ? 'opacity-50' : 'opacity-100';
    return `${className} ${loadingClass} transition-opacity duration-300 ease-in-out motion-reduce:transition-none`
      .replace(/\s+/g, ' ')
      .trim();
  }, [className, imageLoading]);

  if (imageError) {
    return fallback || (
      <div 
        className={`${fallbackClassName} bg-gray-200 flex items-center justify-center text-gray-500 text-xs min-h-7 min-w-7`}
      >
        ?
      </div>
    );
  }

  return (
    <img 
      src={src}
      alt={alt}
      className={imageClassName}
      loading={loading}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
});

ImageWithFallback.displayName = 'ImageWithFallback';

const Footer = () => {
  const [currentOrigin, setCurrentOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentOrigin(window.location.origin);
    }
  }, []);

  return (
    <footer className="bg-gradient-to-br from-gray-50 to-gray-100 text-black pt-20 mt-32 relative overflow-hidden" role="contentinfo">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-800 via-green-600 to-green-800" aria-hidden="true"></div>
      
      <div className="absolute inset-0 opacity-5 hidden md:block" aria-hidden="true">
        {BLUR_CIRCLES.map((circle) => (
          <div 
            key={circle.id}
            className={circle.className}
            aria-hidden="true"
          />
        ))}
      </div>
      
      <div className="max-w-6xl mx-auto px-8 pb-16 relative z-10">
        <div className="flex flex-col md:flex-row items-center md:items-start">
          <div className="mb-12 md:mb-0">
            <ImageWithFallback 
              src="/cesty-bez-mapy/images/logo-footer.png" 
              alt="Cesty bez mapy logo" 
              className="h-28 w-auto mx-auto"
              loading="eager"
              fallback={<div className="h-28 w-32 bg-gray-200 rounded mx-auto flex items-center justify-center text-gray-500 text-sm">Logo</div>}
            />
          </div>
          
          <div className="text-center md:text-left space-y-6 mb-12 md:mb-0 md:ml-8 flex-1">
            <div>
              <h2 className="text-2xl mb-4 text-black font-bold tracking-wide">
                CESTY (BEZ) MAPY
              </h2>
              <div className="w-16 h-1 bg-gradient-to-r from-green-600 to-green-800 mx-auto md:mx-0 mb-4" aria-hidden="true"></div>
              <p className="text-black text-base leading-relaxed font-medium">
                Podporuji tě, abys co nejlépe využil svůj čas na Zemi
              </p>
            </div>
            
            <div>
              <span className="block text-sm font-bold text-green-800 mb-3 uppercase tracking-wider">
                SLEDUJ MĚ NA
              </span>
              <div className="flex justify-center md:justify-start gap-3">
                <a 
                  href="https://www.instagram.com/cestybezmapy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  aria-label="Sleduj mě na Instagramu @cestybezmapy"
                  className="rounded focus:outline-none supports-hover:focus-visible:ring-2 supports-hover:focus-visible:ring-green-600 supports-hover:focus-visible:ring-offset-2"
                >
                  <ImageWithFallback 
                    src="/cesty-bez-mapy/images/instagram.svg" 
                    alt="Instagram" 
                    className="w-7 h-7 grayscale hover:grayscale-0 transition-all duration-300 motion-reduce:transition-none"
                    loading="eager"
                    fallback={<div className="w-7 h-7 bg-gray-400 rounded flex items-center justify-center text-white text-xs">IG</div>}
                  />
                </a>
              </div>
            </div>
          </div>

          <NavigationSection 
            title="O mně"
            links={aboutLinks}
            ariaLabel="O mně"
            className="md:ml-16"
          />

          <NavigationSection 
            title="Cestovní plánování"
            links={planningLinks}
            ariaLabel="Cestovní plánování"
            className="md:ml-8"
          />
        </div>
      </div>

      <div className="bg-gradient-to-r from-gray-900 via-black to-gray-900 text-white py-6 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-green-900/20 via-transparent to-green-900/20" aria-hidden="true"></div>
        <div className="max-w-6xl mx-auto px-8 text-center relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse motion-reduce:animate-none"></div>
              <span className="text-sm text-gray-300">
                &copy; 2025 Cesty (bez) mapy
              </span>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400">
              <a 
                href="#podminky" 
                className="hover:text-green-400 transition-colors duration-300 motion-reduce:transition-none relative group focus-visible:text-green-400 focus:outline-none supports-hover:focus-visible:ring-2 supports-hover:focus-visible:ring-green-400 rounded"
              >
                Obchodní podmínky
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-green-400 transition-[width] duration-300 motion-reduce:transition-none group-hover:w-full"></span>
              </a>
              <span className="text-gray-600">•</span>
              <a 
                href="#soukromi" 
                className="hover:text-green-400 transition-colors duration-300 motion-reduce:transition-none relative group focus-visible:text-green-400 focus:outline-none supports-hover:focus-visible:ring-2 supports-hover:focus-visible:ring-green-400 rounded"
              >
                Ochrana údajů
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-green-400 transition-[width] duration-300 motion-reduce:transition-none group-hover:w-full"></span>
              </a>
              <span className="text-gray-600">•</span>
              <span className="text-gray-500">
                Všechna práva vyhrazena
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {currentOrigin && (
        <script 
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Cesty (bez) mapy",
              "url": currentOrigin,
              "logo": currentOrigin + "/cesty-bez-mapy/images/logo-footer.png",
              "sameAs": [
                "https://www.instagram.com/cestybezmapy"
              ],
              "contactPoint": {
                "@type": "ContactPoint",
                "contactType": "customer service",
                "availableLanguage": "Czech"
              }
            })
          }}
        />
      )}
    </footer>
  );
};

Footer.displayName = 'Footer';

const FooterWithErrorBoundary = () => (
  <FooterErrorBoundary>
    <Footer />
  </FooterErrorBoundary>
);

FooterWithErrorBoundary.displayName = 'FooterWithErrorBoundary';

export default FooterWithErrorBoundary;