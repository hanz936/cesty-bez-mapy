import React from 'react';
import { useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import logger from '../utils/logger';

class MyStoryErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('MyStory Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Něco se pokazilo
            </h1>
            <p className="text-gray-600 mb-6">
              Stránka se nedá načíst. Zkuste prosím obnovit stránku.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
            >
              Obnovit stránku
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

MyStoryErrorBoundary.displayName = 'MyStoryErrorBoundary';

const MyStory = () => {
  const [imageError, setImageError] = useState(false);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  return (
    <div>
      <Helmet>
        <title>Můj příběh | Cesty (bez) mapy</title>
        <meta 
          name="description" 
          content="Poznej Janu, zakladatelku Cesty bez mapy. Obyčejná holka s láskou k cestování, která navštívila přes 30 zemí a všechny si naplánovala sama." 
        />
        <meta property="og:title" content="Můj příběh | Cesty (bez) mapy" />
        <meta 
          property="og:description" 
          content="Poznej Janu, zakladatelku Cesty bez mapy. Obyčejná holka s láskou k cestování, která navštívila přes 30 zemí a všechny si naplánovala sama." 
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/images/jana.jpg" />
        <link rel="canonical" href="https://cestybezmapy.cz/muj-pribeh" />
      </Helmet>
      
      <Navigation />
      
      <section 
        className="py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8"
        role="main"
        aria-labelledby="mystory-heading"
      >
        <div className="flex flex-col lg:flex-row lg:flex-wrap justify-center items-center max-w-6xl mx-auto gap-8 lg:gap-10">
          <div className="flex-1 lg:min-w-80 text-sm sm:text-base lg:text-lg text-black leading-relaxed text-left order-2 lg:order-1">
            <div id="mystory-heading" className="sr-only">Můj příběh - Jana, zakladatelka Cesty bez mapy</div>
            <p className="mb-6">
              Jmenuju se Jana a jsem obyčejná holka, která miluje svět s otevřenýma očima a s batohem na zádech. Už jako malá jsem s rodiči vyrážela na cesty po Evropě — vždy na vlastní pěst, žádné cestovky, žádní delegáti.
            </p>

            <p className="mb-6">
              Tenhle způsob cestování mi zůstal dodnes. Navštívila jsem přes 30 zemí a všechny své cesty jsem si naplánovala sama – někdy dopředu do detailu, jindy jen s letenkou a pár poznámkama v ruce.
            </p>

            <p className="mb-6">
              Jinak žiju úplně normální život. Pracuji v korporátu, dovolenou si musím hlídat stejně jako každý jiný. A právě proto vím, jak moc záleží na dobrém plánu. Naučila jsem se za pár dní vidět maximum, ale přitom si cestu opravdu užít. Nehonit památky pro fotky, ale zažít místo naplno – s vůní, chutí a výhledem, na který nezapomeneš.
            </p>

            <p className="mb-6">
              Tenhle web jsem založila pro všechny, kteří chtějí cestovat chytře, s radostí a bez hodin strávených u Googlu. Najdeš tu itineráře z mých cest — promyšlené, praktické a ozkoušené na vlastní kůži. Můžeš je použít jako inspiraci nebo se jimi nechat vést den po dni.
            </p>

            <p className="font-bold mb-3">
              Doufám, že ti moje zkušenosti pomůžou cestovat víc, snadněji a bez stresu.
            </p>
            <p className="font-bold">
              Tak kam to bude příště?
            </p>
          </div>
          
          <div className="flex-1 lg:min-w-80 text-center order-1 lg:order-2">
            {!imageError ? (
              <img 
                src="/images/jana.jpg" 
                alt="Fotka autorky itinerářů Jana - zakladatelka Cesty bez mapy" 
                className="w-full max-w-sm sm:max-w-md rounded-xl shadow-2xl object-cover mx-auto"
                width="384"
                height="480"
                onError={handleImageError}
                loading="lazy"
              />
            ) : (
              <div 
                className="w-full max-w-sm sm:max-w-md rounded-xl shadow-2xl bg-gradient-to-br from-green-100 to-green-200 mx-auto flex items-center justify-center text-green-800 text-5xl sm:text-6xl font-bold aspect-[4/5]"
                aria-label="Avatar s písmenem J - zástupný obrázek pro Janu"
                role="img"
              >
                J
              </div>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

MyStory.displayName = 'MyStory';

const MyStoryWithErrorBoundary = () => (
  <MyStoryErrorBoundary>
    <MyStory />
  </MyStoryErrorBoundary>
);

MyStoryWithErrorBoundary.displayName = 'MyStoryWithErrorBoundary';

export default MyStoryWithErrorBoundary;