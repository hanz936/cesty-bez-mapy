import { useState, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import { BASE_PATH } from '../constants';

const MyStory = () => {
  const [imageError, setImageError] = useState(false);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  return (
    <Layout>
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
                src={`${BASE_PATH}/images/jana.jpg`} 
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
    </Layout>
  );
};

MyStory.displayName = 'MyStory';

export default MyStory;