import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import PageHero from '../components/common/PageHero';
import { BASE_PATH, ROUTES } from '../constants';

const FAQ_DATA = [
  {
    id: 1,
    question: 'V jakém formátu dostanu itinerář?',
    answer: 'Itinerář přijde ve formátu PDF. Můžeš si ho pohodlně stáhnout do mobilu, tabletu nebo vytisknout.'
  },
  {
    id: 2,
    question: 'Kdy mi průvodce přijde?',
    answer: 'Hned po zaplacení ti automaticky dorazí na e-mail.'
  },
  {
    id: 3,
    question: 'Je itinerář vhodný i pro rodiny/sólo cestovatele/páry?',
    answer: 'Ano! Itinerář je navržený univerzálně – doporučuju aktivity pro různé typy cestovatelů. Pokud cestuješ s dětmi nebo máš speciální potřeby, klidně mi napiš a poradím osobně.'
  },
  {
    id: 4,
    question: 'Co když změním plán cesty nebo mi nebude průvodce vyhovovat?',
    answer: 'Itinerář slouží jako inspirace a opora, ale je flexibilní – můžeš ho libovolně přizpůsobit. Pokud máš pocit, že ti nesedí, ozvi se a najdeme řešení.'
  },
  {
    id: 5,
    question: 'Je zahrnuto i ubytování?',
    answer: 'Ano – součástí většiny itinerářů jsou tipy na ověřená ubytování s odkazy, většinou na Booking.com.'
  },
  {
    id: 6,
    question: 'Kolik času mi zabere naplánovat cestu podle průvodce?',
    answer: 'Díky itineráři máš 90 % práce hotovo. Stačí vybrat konkrétní termíny a případně upravit podle vlastních potřeb nebo se se mnou poradit.'
  },
  {
    id: 7,
    question: 'Jsou v itineráři i tipy na parkování nebo jídlo?',
    answer: 'Ano! Dávám do průvodců i praktické vychytávky jako parkování, nejlepší kavárny nebo kde se dobře najíst – často otestované osobně.'
  },
  {
    id: 8,
    question: 'Jak mohu zaplatit?',
    answer: 'Přes zabezpečenou platební bránu – kartou online. Vše je rychlé a bezpečné.'
  },
  {
    id: 9,
    question: 'Nepřišel mi e-mail s itinerářem, co mám dělat?',
    answer: 'Nejprve zkontroluj spam a složku "Hromadné". Pokud nic nenajdeš, ozvi se mi a hned to napravíme.'
  },
  {
    id: 10,
    question: 'Co když nemám auto - využiji itinerář i bez něj?',
    answer: 'Většina itinerářů je stavěná na auto, ale pokud je varianta bez auta, vždy ji zmiňuji. Když si nejsi jistý, napiš mi.'
  },
  {
    id: 11,
    question: 'Můžu si podle itineráře naplánovat i kratší nebo delší výlet?',
    answer: 'Určitě – itinerář ti dá kostru cesty, kterou můžeš snadno zkrátit nebo prodloužit podle svého času.'
  },
  {
    id: 12,
    question: 'Můžu se na něco doptat i po nákupu?',
    answer: 'Jasně! S nákupem získáváš konzultaci zdarma. Takže pokud potřebuješ doladit detaily nebo si  s něčím nevíš rady, napiš mi - ráda poradím.'
  },
  {
    id: 13,
    question: 'Nabízíš i individuální plánování cest?',
    answer: 'Ano – v sekci "cestovní průvodci" najdeš odkaz na formulář.'
  },
  {
    id: 14,
    question: 'Co když mi průvodce nebude sedět?',
    answer: 'Mrzí mě to, ale stává se to výjimečně. Napiš mi a domluvíme se – chci, abys byl/a spokojený/á a cesta stála za to.'
  },
  {
    id: 15,
    question: 'Proč si koupit právě tvůj itinerář?',
    answer: 'Itineráře stavím na osobní zkušenosti, ne jen z Googlu nebo umělé inteligence. Vše jsem sama projela, vyzkoušela a dávám do nich své tipy, které ti ušetří čas i peníze.'
  }
];


const FAQItem = ({ item, isOpen, onToggle }) => {
  return (
    <div className="last:border-b-0 group">
      <button
        onClick={onToggle}
        className={`w-full px-6 py-6 text-left transition-all duration-300 focus:outline-none relative ${
          isOpen 
            ? 'bg-gradient-to-r from-green-50/50 to-green-50/30' 
            : 'hover:bg-gradient-to-r hover:from-green-50/30 hover:to-green-50/20'
        }`}
        aria-expanded={isOpen}
      >
        <div className="flex justify-between items-center gap-4">
          <div className="flex-1">
            <h3 className={`text-lg font-medium leading-snug transition-colors duration-200 ${
              isOpen ? 'text-green-800' : 'text-black group-hover:text-green-700'
            }`}>
              {item.question}
            </h3>
          </div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ease-out ${
            isOpen 
              ? 'bg-green-100 text-green-700 shadow-sm' 
              : 'bg-gray-100 text-gray-400 group-hover:bg-green-50 group-hover:text-green-600'
          }`}>
            <svg 
              className={`w-4 h-4 transition-transform duration-500 ease-out ${isOpen ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>
      
      <div className={`transition-all duration-700 ease-out ${isOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
        <div className={`px-6 py-4 transition-all duration-500 ease-out flex items-center ${
          isOpen ? 'bg-gradient-to-r from-green-50/20 to-transparent' : ''
        }`}>
          <div className="pl-4">
            <p className="text-gray-700 leading-relaxed">
              {item.answer}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const FAQ = () => {
  const [openItem, setOpenItem] = useState(1); // První položka otevřená

  const toggleItem = useCallback((id) => {
    setOpenItem(prev => prev === id ? null : id);
  }, []);


  return (
    <Layout>
      
      {/* Hero Section */}
      <PageHero 
        backgroundImage={`${BASE_PATH}/images/hero-background-faq.png`}
        title="Časté dotazy"
        subtitle="Odpovědi na nejčastější otázky o cestování a mých službách."
        overlayOpacity={0.6}
        ariaLabel="Hero sekce často kladených dotazů"
      />

      {/* FAQ Section */}
      <main className="py-16 px-5 max-w-4xl mx-auto" role="main">
        

        {/* FAQ Items */}
        <div className="bg-gradient-to-br from-white to-gray-50/30 rounded-2xl shadow-lg border border-gray-100 divide-y divide-gray-100 overflow-hidden">
          {FAQ_DATA.map((item) => (
            <FAQItem
              key={item.id}
              item={item}
              isOpen={openItem === item.id}
              onToggle={() => toggleItem(item.id)}
            />
          ))}
        </div>

        {/* Contact Section */}
        <div className="mt-16 text-center relative">
          <div className="bg-gradient-to-br from-green-50 via-white to-green-50/30 rounded-2xl shadow-lg border border-green-100 p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-600 via-green-500 to-green-600" aria-hidden="true"></div>
            <div className="absolute -top-2 -right-2 w-16 h-16 bg-green-100 rounded-full blur-xl opacity-60" aria-hidden="true"></div>
            <div className="absolute -bottom-2 -left-2 w-12 h-12 bg-green-200 rounded-full blur-lg opacity-40" aria-hidden="true"></div>
            
            <h2 className="text-2xl font-bold text-green-800 mb-6">
              Nevidíš zde odpověď na svůj problém?
            </h2>
            <Link 
              to={ROUTES.CONTACT} 
              className="inline-flex items-center gap-3 bg-gradient-to-r from-green-700 to-green-800 hover:from-green-800 hover:to-green-900 text-white font-medium py-3 px-6 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              Napiš mi
            </Link>
          </div>
        </div>

      </main>
    </Layout>
  );
};

FAQ.displayName = 'FAQ';

export default FAQ;