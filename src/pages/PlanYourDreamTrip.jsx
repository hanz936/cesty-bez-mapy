import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { Button } from '../components/ui';
import { BASE_PATH } from '../constants';

const CLASSES = {
  main: 'min-h-screen bg-white',
  heroSection: 'relative py-16 lg:py-20 px-4 sm:px-6 lg:px-8 text-center min-h-96',
  heroContent: 'relative z-10 max-w-4xl mx-auto',
  heroTitle: 'text-2xl sm:text-3xl lg:text-4xl font-bold text-green-800 mb-8',
  heroParagraph: 'text-base sm:text-lg lg:text-xl text-black mb-4 leading-relaxed',
  contentSection: 'py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-white',
  contentContainer: 'flex flex-col lg:flex-row lg:flex-wrap justify-center items-start max-w-6xl mx-auto gap-8 lg:gap-12',
  textContent: 'flex-1 lg:min-w-80 text-sm sm:text-base lg:text-lg text-black leading-relaxed text-left',
  sectionTitle: 'text-2xl lg:text-3xl font-bold text-green-800 mb-6',
  list: 'list-none ml-0 space-y-4 mb-8',
  listItem: 'flex items-start text-black',
  listIcon: 'w-6 h-6 mr-3 mt-0.5 flex-shrink-0',
  ctaParagraph: 'text-xl font-bold text-black mb-6',
  imageContainer: 'w-full lg:flex-1 lg:min-w-80 flex justify-center items-center',
  slideImage: 'w-full max-w-sm sm:max-w-md lg:max-w-lg mx-auto rounded-xl shadow-2xl object-contain',
  quizSection: 'relative py-24 lg:py-32 px-4 sm:px-6 lg:px-8 text-center text-white my-16',
  quizOverlay: 'absolute inset-0 bg-black/40 rounded-xl',
  quizContent: 'relative z-10 max-w-2xl mx-auto',
  quizTitle: 'text-4xl lg:text-5xl font-bold mb-4',
  quizDescription: 'text-xl lg:text-2xl mb-8',
};

const SLIDESHOW_IMAGES = [
  `${BASE_PATH}/images/slide1.png`,
  `${BASE_PATH}/images/slide2.png`, 
  `${BASE_PATH}/images/slide3.png`,
  `${BASE_PATH}/images/slide4.png`,
  `${BASE_PATH}/images/slide5.png`,
  `${BASE_PATH}/images/slide6.png`,
  `${BASE_PATH}/images/slide7.png`
];

const PlanYourDreamTrip = () => {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => 
        (prevIndex + 1) % SLIDESHOW_IMAGES.length
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  const handleCtaClick = useCallback(() => {
    navigate('/inspirace');
  }, [navigate]);

  const handleQuizClick = useCallback(() => {
    // Quiz functionality will be implemented in future version
    alert('Kvíz bude brzy dostupný! 🚀');
  }, []);

  return (
    <Layout>
      {/* Hero Section */}
      <section 
        className={CLASSES.heroSection}
        style={{
          backgroundImage: `url(${BASE_PATH}/images/about-background.png)`,
          backgroundSize: 'contain',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
          backgroundColor: '#fff'
        }}
        role="banner"
        aria-labelledby="hero-heading"
      >
        <div className={CLASSES.heroContent}>
          <h1 id="hero-heading" className={CLASSES.heroTitle}>
            Na cestu nemusíš být profík
          </h1>
          <p className={CLASSES.heroParagraph}>
            Nejsi travel influencer ani full-time dobrodruh? Ani já ne.
          </p>
          <p className={CLASSES.heroParagraph}>
            Ale to neznamená, že si nemůžeš užít cestu, na kterou budeš vzpomínat celý život.
          </p>
          <p className={CLASSES.heroParagraph}>
            S dobrým plánem toho totiž zvládneš víc – bez stresu, bloudění nebo promarněných dnů.
          </p>
          <p className={CLASSES.heroParagraph}>
            Ten pocit, kdy si večer sedneš s vínem a víš, že jsi za den zažil/a víc než jiní za týden?
          </p>
          <p className={CLASSES.heroParagraph}>
            <strong>Ten si můžeš dopřát i ty.</strong>
          </p>
        </div>
      </section>

      <section className={CLASSES.contentSection}>
        <div className={CLASSES.contentContainer}>
          <div className={CLASSES.textContent}>
            <section aria-labelledby="target-audience">
              <h2 id="target-audience" className={CLASSES.sectionTitle}>
                Tahle stránka je pro tebe, pokud:
              </h2>
              <ul className={CLASSES.list} role="list">
                <li className={CLASSES.listItem} role="listitem">
                  <img 
                    src={`${BASE_PATH}/images/pin.png`} 
                    alt="" 
                    className={CLASSES.listIcon}
                    loading="lazy"
                  />
                  Nechceš ztrácet čas hodiny před odjezdem ani během samotné cesty.
                </li>
                <li className={CLASSES.listItem} role="listitem">
                  <img 
                    src={`${BASE_PATH}/images/pin.png`} 
                    alt="" 
                    className={CLASSES.listIcon}
                    loading="lazy"
                  />
                  Hledáš něco mezi totální improvizací a přesným itinerářem na minutu.
                </li>
                <li className={CLASSES.listItem} role="listitem">
                  <img 
                    src={`${BASE_PATH}/images/pin.png`} 
                    alt="" 
                    className={CLASSES.listIcon}
                    loading="lazy"
                  />
                  Tě nebaví scrollovat desítky blogů a skládat si info po kouskách.
                </li>
                <li className={CLASSES.listItem} role="listitem">
                  <img 
                    src={`${BASE_PATH}/images/pin.png`} 
                    alt="" 
                    className={CLASSES.listIcon}
                    loading="lazy"
                  />
                  Máš ráda, když někdo už prošlapal cestu před tebou a ví, co fakt stojí za to.
                </li>
                <li className={CLASSES.listItem} role="listitem">
                  <img 
                    src={`${BASE_PATH}/images/pin.png`} 
                    alt="" 
                    className={CLASSES.listIcon}
                    loading="lazy"
                  />
                  Chceš víc zažít, míň řešit – a hlavně si tu cestu opravdu užít.
                </li>
              </ul>
            </section>

            <section aria-labelledby="itinerary-benefits">
              <h2 id="itinerary-benefits" className={CLASSES.sectionTitle}>
                Díky mým itinerářům:
              </h2>
              <ul className={CLASSES.list} role="list">
                <li className={CLASSES.listItem} role="listitem">
                  <img 
                    src={`${BASE_PATH}/images/pin.png`} 
                    alt="" 
                    className={CLASSES.listIcon}
                    loading="lazy"
                  />
                  Budeš přesně vědět, kam jít a co stojí za to – žádné bloudění ani dohady.
                </li>
                <li className={CLASSES.listItem} role="listitem">
                  <img 
                    src={`${BASE_PATH}/images/pin.png`} 
                    alt="" 
                    className={CLASSES.listIcon}
                    loading="lazy"
                  />
                  Najdeš místa, kde se dobře najíst, kde si odpočinout i kam se zajít na kávu.
                </li>
                <li className={CLASSES.listItem} role="listitem">
                  <img 
                    src={`${BASE_PATH}/images/pin.png`} 
                    alt="" 
                    className={CLASSES.listIcon}
                    loading="lazy"
                  />
                  Máš všechno přehledně po dnech či místech, takže nemusíš nic řešit ráno na poslední chvíli.
                </li>
                <li className={CLASSES.listItem} role="listitem">
                  <img 
                    src={`${BASE_PATH}/images/pin.png`} 
                    alt="" 
                    className={CLASSES.listIcon}
                    loading="lazy"
                  />
                  Dostaneš mapy, tipy na parkování, info o vstupném – prostě všechno, co by tě jinak zdržovalo při vyhledávání.
                </li>
                <li className={CLASSES.listItem} role="listitem">
                  <img 
                    src={`${BASE_PATH}/images/pin.png`} 
                    alt="" 
                    className={CLASSES.listIcon}
                    loading="lazy"
                  />
                  Získáš konzultaci, když budeš tápat – a rychlou pomoc, když něco hoří.
                </li>
              </ul>
            </section>

            <p className={CLASSES.ctaParagraph}>
              Plánuj chytře. Cestuj naplno.
            </p>
            <div className="text-center lg:text-left">
              <Button 
                onClick={handleCtaClick}
                variant="green"
                size="lg"
                aria-label="Přejít na výběr cestovních itinerářů"
              >
                Vyber si cestu
              </Button>
            </div>
          </div>

          <div className={CLASSES.imageContainer}>
            {!imageError ? (
              <img 
                src={SLIDESHOW_IMAGES[currentImageIndex]}
                alt="Ukázka z cestovního itineráře"
                className={CLASSES.slideImage}
                onError={handleImageError}
                loading="lazy"
              />
            ) : (
              <div 
                className="w-full max-w-lg mx-auto rounded-xl shadow-2xl bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center text-green-800 text-xl font-bold aspect-[4/3] h-96"
                aria-label="Ukázka cestovního itineráře - obrázek není k dispozici"
                role="img"
              >
                Ukázka itineráře
              </div>
            )}
          </div>
        </div>
      </section>

      <section 
        className={`${CLASSES.quizSection} mx-4 sm:mx-8 md:mx-16 lg:mx-32 xl:mx-48`}
        style={{
          backgroundImage: `url(${BASE_PATH}/images/quiz-background.png)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
          backgroundColor: '#333',
          borderRadius: '0.75rem'
        }}
        role="complementary"
        aria-labelledby="quiz-heading"
      >
        <div className={CLASSES.quizOverlay} />
        <div className={CLASSES.quizContent}>
          <h2 id="quiz-heading" className={CLASSES.quizTitle}>
            Nevíš kudy kam?
          </h2>
          <p className={CLASSES.quizDescription}>
            Vyplň krátký kvíz a zjisti kam tě to táhne nejvíc.
          </p>
          <Button 
            onClick={handleQuizClick}
            variant="green"
            size="xl"
            aria-label="Spustit cestovní kvíz"
          >
            Začít kvíz
          </Button>
        </div>
      </section>

    </Layout>
  );
};

PlanYourDreamTrip.displayName = 'PlanYourDreamTrip';

export default PlanYourDreamTrip;