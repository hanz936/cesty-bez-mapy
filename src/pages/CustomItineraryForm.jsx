import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import Layout from '../components/layout/Layout';
import { Button, Input, TextArea, MultiStepForm } from '../components/ui';
import { ROUTES } from '../constants';

const CustomItineraryForm = React.memo(() => {
  const navigate = useNavigate();
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    // Základní informace
    name: '',
    email: '',

    // Cestovní preference
    vacationType: [],
    vacationTypeOther: '',
    duration: '',
    customDuration: '',

    // Počet osob, termín, finance
    travelGroup: '',
    familyDetails: '',
    friendsCount: '',
    preferredTerm: [],
    specificTerm: '',
    budgetCategory: '',
    budgetAmount: '',
    transportation: [],
    transportationOther: '',

    // Destinace
    specificDestination: '',
    openToSuggestions: '',
    preferredContinents: '',
    climatePreferences: '',
    cultureVsNature: '',
    specificFactors: '',

    // Zájmy a aktivity
    mainInterests: '',
    specificActivities: '',
    accommodationRequirements: '',
    diningPreferences: '',
    organizedTours: '',

    // Další informace
    healthRestrictions: '',
    travelWithPet: '',
    additionalInfo: ''
  });

  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleCheckboxChange = useCallback((field, value) => {
    setFormData(prev => {
      const currentValues = prev[field] || [];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(item => item !== value)
        : [...currentValues, value];
      return { ...prev, [field]: newValues };
    });
  }, []);

  const handleBackToItinerary = useCallback(() => {
    navigate(ROUTES.CUSTOM_ITINERARY_DETAIL);
  }, [navigate]);

  const generatePDF = useCallback(() => {
    const doc = new jsPDF();

    // PDF styling
    doc.setFontSize(20);
    doc.setTextColor(22, 101, 52); // Green-800
    doc.text('Tvůj cestovní profil - Itinerář na míru', 20, 30);

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);

    let yPosition = 50;
    const lineHeight = 7;

    // Helper function to add text with wrapping
    const addWrappedText = (text, maxWidth = 170) => {
      const splitText = doc.splitTextToSize(text, maxWidth);
      doc.text(splitText, 20, yPosition);
      yPosition += splitText.length * lineHeight;
    };

    // Basic information
    doc.setFontSize(14);
    doc.setTextColor(22, 101, 52);
    addWrappedText('Základní informace');
    yPosition += 5;

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    addWrappedText(`Jméno: ${formData.name}`);
    addWrappedText(`Email: ${formData.email}`);
    yPosition += 10;

    // Travel preferences
    doc.setFontSize(14);
    doc.setTextColor(22, 101, 52);
    addWrappedText('Cestovní preference');
    yPosition += 5;

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    if (formData.vacationType.length > 0) {
      addWrappedText(`Typ dovolené: ${formData.vacationType.join(', ')}`);
    }
    if (formData.duration) {
      addWrappedText(`Délka pobytu: ${formData.duration}`);
    }
    yPosition += 10;

    // Travel details
    if (formData.travelGroup) {
      doc.setFontSize(14);
      doc.setTextColor(22, 101, 52);
      addWrappedText('Cestování a termín');
      yPosition += 5;

      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      addWrappedText(`Cestovní skupina: ${formData.travelGroup}`);
      if (formData.budgetCategory) {
        addWrappedText(`Rozpočet: ${formData.budgetCategory}`);
      }
      yPosition += 10;
    }

    // Save PDF
    doc.save('itinerar-na-miru-dotaznik.pdf');
  }, [formData]);

  const handleComplete = useCallback(() => {
    // Basic validation
    if (!formData.name.trim() || !formData.email.trim()) {
      alert('Prosím vyplň jméno a email.');
      return;
    }

    // Generate PDF
    generatePDF();

    // Show success message
    setShowSuccessMessage(true);
  }, [formData, generatePDF]);

  // Step configuration
  const stepLabels = [
    'Základní info',
    'Cestování',
    'Destinace',
    'Aktivity',
    'Dokončení'
  ];

  // Automatické poescrollování na vrchol při načtení stránky
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Success message component
  if (showSuccessMessage) {
    return (
      <Layout>
        <div className="min-h-screen bg-white flex items-center justify-center px-4">
          <div className="max-w-2xl w-full text-center">
            <div className="bg-white rounded-3xl shadow-xl p-8 sm:p-12">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-black mb-6">
                Díky!
              </h1>
              <p className="text-lg text-black mb-8 leading-relaxed">
                Teď už mám od tebe vše potřebné a můžu se pustit do plánování tvé cesty. Po dokončení objednávky ti přijde potvrzení na email.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={() => navigate(ROUTES.CHECKOUT)}
                  variant="green"
                  size="lg"
                  className="px-8"
                >
                  Přejít do košíku
                </Button>
                <Button
                  onClick={handleBackToItinerary}
                  variant="secondary"
                  size="lg"
                  className="px-8"
                >
                  Zpět na itinerář
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Multi-step form steps configuration
  const steps = [
    {
      title: 'Základní informace',
      description: 'Každá cesta je jedinečná - pojďme zjistit, jak má vypadat ta tvoje',
      content: (
        <div className="space-y-8">
          {/* Základní informace */}
          <div>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <Input
                type="text"
                label="Jméno a příjmení"
                required
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Tvé jméno a příjmení"
                className="focus-ring"
              />
              <Input
                type="email"
                label="Kontaktní email"
                required
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="tvuj@email.cz"
                className="focus-ring"
              />
            </div>
          </div>

          {/* Cestovní preference */}
          <div>
            <h4 className="text-lg font-semibold text-black mb-4">
              Cestovní preference
            </h4>

            {/* Typ dovolené */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-black mb-3">
                Typ dovolené:
              </label>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  'Relaxační dovolená',
                  'Aktivní dovolená',
                  'Poznávací dovolená',
                  'Gastronomický zážitek',
                  'Romantická dovolená',
                  'Rodinná dovolená',
                  'Dobrodružná dovolená',
                  'Jiné'
                ].map(type => (
                  <label key={type} className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      value={type}
                      checked={formData.vacationType.includes(type)}
                      onChange={() => handleCheckboxChange('vacationType', type)}
                      className="w-4 h-4 text-green-600 focus:ring-green-500 rounded"
                    />
                    <span className="text-sm text-black">{type}</span>
                  </label>
                ))}
              </div>
              {formData.vacationType.includes('Jiné') && (
                <Input
                  type="text"
                  value={formData.vacationTypeOther}
                  onChange={(e) => handleInputChange('vacationTypeOther', e.target.value)}
                  placeholder="Uveď prosím jaký typ dovolené..."
                  className="focus-ring mt-3"
                />
              )}
            </div>

            {/* Délka pobytu */}
            <div>
              <label className="block text-sm font-medium text-black mb-3">
                Délka pobytu:
              </label>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  'Víkendový výlet (1-3 dny)',
                  'Kratší dovolená (4-7 dní)',
                  'Týdenní dovolená (8-14 dní)',
                  'Delší dovolená (15 dní a více)',
                  'Vím přesný počet dní'
                ].map(duration => (
                  <label key={duration} className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="duration"
                      value={duration}
                      checked={formData.duration === duration}
                      onChange={(e) => handleInputChange('duration', e.target.value)}
                      className="w-4 h-4 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-black">{duration}</span>
                  </label>
                ))}
              </div>
              {formData.duration === 'Vím přesný počet dní' && (
                <Input
                  type="number"
                  min="1"
                  value={formData.customDuration}
                  onChange={(e) => handleInputChange('customDuration', e.target.value)}
                  placeholder="Počet dní"
                  className="focus-ring mt-3 w-32"
                />
              )}
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Cestování a termín',
      description: 'Kdy a s kým bys chtěl cestovat?',
      content: (
        <div className="space-y-8">
          {/* Počet osob */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Počet osob:
            </label>
            <div className="space-y-3">
              {[
                'Cestuji sám/sama',
                'Cestuji s partnerem/partnerkou',
                'Cestuji s rodinou',
                'Cestuji s přáteli'
              ].map(group => (
                <label key={group} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="travelGroup"
                    value={group}
                    checked={formData.travelGroup === group}
                    onChange={(e) => handleInputChange('travelGroup', e.target.value)}
                    className="w-4 h-4 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-black">{group}</span>
                </label>
              ))}
            </div>
            {formData.travelGroup === 'Cestuji s rodinou' && (
              <Input
                type="text"
                value={formData.familyDetails}
                onChange={(e) => handleInputChange('familyDetails', e.target.value)}
                placeholder="Uveď prosím počet a věk členů rodiny..."
                className="focus-ring mt-3"
              />
            )}
            {formData.travelGroup === 'Cestuji s přáteli' && (
              <Input
                type="text"
                value={formData.friendsCount}
                onChange={(e) => handleInputChange('friendsCount', e.target.value)}
                placeholder="Uveď prosím počet přátel..."
                className="focus-ring mt-3"
              />
            )}
          </div>

          {/* Preferovaný termín */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Preferovaný termín cesty:
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                'Jarní měsíce (duben - červen)',
                'Letní měsíce (červenec - srpen)',
                'Podzimní měsíce (září - listopad)',
                'Zimní měsíce (prosinec - březen)',
                'Jsem flexibilní ohledně termínu',
                'Určitý termín'
              ].map(term => (
                <label key={term} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    value={term}
                    checked={formData.preferredTerm.includes(term)}
                    onChange={() => handleCheckboxChange('preferredTerm', term)}
                    className="w-4 h-4 text-green-600 focus:ring-green-500 rounded"
                  />
                  <span className="text-sm text-black">{term}</span>
                </label>
              ))}
            </div>
            {formData.preferredTerm.includes('Určitý termín') && (
              <Input
                type="text"
                value={formData.specificTerm}
                onChange={(e) => handleInputChange('specificTerm', e.target.value)}
                placeholder="Uveď prosím konkrétní termín..."
                className="focus-ring mt-3"
              />
            )}
          </div>

          {/* Rozpočet */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Rozpočet na cestu:
            </label>
            <div className="space-y-3">
              {[
                'Nízkorozpočtová dovolená',
                'Středně rozpočtová dovolená',
                'Luxusní dovolená'
              ].map(budget => (
                <label key={budget} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="budgetCategory"
                    value={budget}
                    checked={formData.budgetCategory === budget}
                    onChange={(e) => handleInputChange('budgetCategory', e.target.value)}
                    className="w-4 h-4 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-black">{budget}</span>
                </label>
              ))}
            </div>
            <Input
              type="text"
              value={formData.budgetAmount}
              onChange={(e) => handleInputChange('budgetAmount', e.target.value)}
              placeholder="Orientační částka (nepovinné)..."
              className="focus-ring mt-3"
            />
          </div>

          {/* Doprava */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Preferovaný způsob dopravy:
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                'Vlastní auto',
                'Vlak',
                'Letadlo',
                'Autobus',
                'Jiné'
              ].map(transport => (
                <label key={transport} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    value={transport}
                    checked={formData.transportation.includes(transport)}
                    onChange={() => handleCheckboxChange('transportation', transport)}
                    className="w-4 h-4 text-green-600 focus:ring-green-500 rounded"
                  />
                  <span className="text-sm text-black">{transport}</span>
                </label>
              ))}
            </div>
            {formData.transportation.includes('Jiné') && (
              <Input
                type="text"
                value={formData.transportationOther}
                onChange={(e) => handleInputChange('transportationOther', e.target.value)}
                placeholder="Uveď prosím způsob dopravy..."
                className="focus-ring mt-3"
              />
            )}
          </div>
        </div>
      )
    },
    {
      title: 'Destinace',
      description: 'Kam se chceš vydat?',
      content: (
        <div className="space-y-6">
          <TextArea
            label="Máte konkrétní destinaci na mysli?"
            value={formData.specificDestination}
            onChange={(e) => handleInputChange('specificDestination', e.target.value)}
            rows={2}
            placeholder="Uveď prosím konkrétní destinaci..."
            className="focus-ring"
          />

          <TextArea
            label="Jste otevřeni návrhům na destinaci?"
            value={formData.openToSuggestions}
            onChange={(e) => handleInputChange('openToSuggestions', e.target.value)}
            rows={2}
            placeholder="Ano/Ne a případně doplň podrobnosti..."
            className="focus-ring"
          />

          <TextArea
            label="Které kontinenty/země vás nejvíce lákají?"
            value={formData.preferredContinents}
            onChange={(e) => handleInputChange('preferredContinents', e.target.value)}
            rows={2}
            placeholder="Například: Evropa, Asie, Amerika..."
            className="focus-ring"
          />

          <TextArea
            label="Jaké jsou vaše preferované klimatické podmínky? (teplé, chladné, ...)"
            value={formData.climatePreferences}
            onChange={(e) => handleInputChange('climatePreferences', e.target.value)}
            rows={2}
            placeholder="Popište své preference ohledně počasí a klimatu..."
            className="focus-ring"
          />

          <TextArea
            label="Hledáte spíše destinaci s bohatou historií a kulturou, nebo s krásnou přírodou a možnostmi pro outdoorové aktivity?"
            value={formData.cultureVsNature}
            onChange={(e) => handleInputChange('cultureVsNature', e.target.value)}
            rows={3}
            placeholder="Popište co vás více láká - kultura, historie, příroda, outdoorové aktivity..."
            className="focus-ring"
          />

          <TextArea
            label="Jsou pro vás důležité specifické faktory, jako je dostupnost pláží, hor, lyžařských středisek, ...?"
            value={formData.specificFactors}
            onChange={(e) => handleInputChange('specificFactors', e.target.value)}
            rows={2}
            placeholder="Uveďte specifické požadavky na destinaci..."
            className="focus-ring"
          />
        </div>
      )
    },
    {
      title: 'Zájmy a aktivity',
      description: 'Co tě na cestování baví?',
      content: (
        <div className="space-y-6">
          <TextArea
            label="Co vás na dovolené nejvíce baví? (poznávání památek, relaxace u moře, sportovní aktivity, gastronomické zážitky, ...)"
            value={formData.mainInterests}
            onChange={(e) => handleInputChange('mainInterests', e.target.value)}
            rows={3}
            placeholder="Popište co vás na cestování nejvíce zajímá..."
            className="focus-ring"
          />

          <TextArea
            label="Jsou pro vás důležité specifické aktivity, které byste na dovolené rádi/y zažili/y? (např. potápění, turistika, degustace vín, ...)"
            value={formData.specificActivities}
            onChange={(e) => handleInputChange('specificActivities', e.target.value)}
            rows={3}
            placeholder="Uveďte konkrétní aktivity, které chcete zažít..."
            className="focus-ring"
          />

          <TextArea
            label="Máte nějaké specifické požadavky na ubytování? (typ ubytování, vybavení, ...)"
            value={formData.accommodationRequirements}
            onChange={(e) => handleInputChange('accommodationRequirements', e.target.value)}
            rows={2}
            placeholder="Popište požadavky na ubytování..."
            className="focus-ring"
          />

          <TextArea
            label="Jaký typ stravování preferujete? (snídaně v hotelu, vlastní vaření, stravování v restauracích, ...)"
            value={formData.diningPreferences}
            onChange={(e) => handleInputChange('diningPreferences', e.target.value)}
            rows={2}
            placeholder="Popište preference ohledně stravování..."
            className="focus-ring"
          />

          <TextArea
            label="Máte zájem o organizované výlety a exkurze?"
            value={formData.organizedTours}
            onChange={(e) => handleInputChange('organizedTours', e.target.value)}
            rows={2}
            placeholder="Ano/Ne a případně jaké typy výletů vás zajímají..."
            className="focus-ring"
          />
        </div>
      )
    },
    {
      title: 'Dokončení',
      description: 'Poslední informace a shrnutí',
      content: (
        <div className="space-y-6">
          <TextArea
            label="Máte nějaké zdravotní omezení, která by mohla ovlivnit vaši cestu?"
            value={formData.healthRestrictions}
            onChange={(e) => handleInputChange('healthRestrictions', e.target.value)}
            rows={2}
            placeholder="Uveďte případná zdravotní omezení..."
            className="focus-ring"
          />

          <TextArea
            label="Cestujete s domácím mazlíčkem?"
            value={formData.travelWithPet}
            onChange={(e) => handleInputChange('travelWithPet', e.target.value)}
            rows={2}
            placeholder="Ano/Ne a případně jaký mazlíček..."
            className="focus-ring"
          />

          <TextArea
            label="Je ještě něco, co byste mi o sobě rádi sdělili, abych vám mohla lépe vytvořit itinerář na míru?"
            value={formData.additionalInfo}
            onChange={(e) => handleInputChange('additionalInfo', e.target.value)}
            rows={4}
            placeholder="Uveďte cokoliv dalšího, co považujete za důležité..."
            className="focus-ring"
          />

          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mt-8">
            <h5 className="text-lg font-semibold text-green-800 mb-3">
              Před dokončením
            </h5>
            <p className="text-green-700 mb-4">
              Po kliknutí na "Přidat do košíku" se automaticky vytvoří PDF souhrn vašeho dotazníku a zobrazí se potvrzovací zpráva.
            </p>
          </div>
        </div>
      )
    }
  ];

  return (
    <Layout>
      <main className="min-h-screen bg-white">
        {/* Hero Section with Breadcrumb */}
        <section className="relative pt-6 pb-12 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Breadcrumb */}
            <nav className="mb-8">
              <button
                onClick={handleBackToItinerary}
                className="flex items-center text-sm sm:text-base text-gray-600 hover:text-green-700 transition-colors group"
              >
                <svg className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Zpět na itinerář na míru
              </button>
            </nav>

            {/* Title Section */}
            <div className="text-center mb-8">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black leading-tight mb-4">
                Naplánuj svůj trip
              </h1>
              <h2 className="text-xl sm:text-2xl text-green-800 font-medium mb-4">
                Tvůj cestovní profil
              </h2>
              <p className="text-lg text-black max-w-3xl mx-auto mb-3">
                Stačí 5 jednoduchých kroků a já ti připravím itinerář přesně podle tvých představ
              </p>
              <p className="text-sm text-gray-500">
                Pole označená <span className="text-red-500">*</span> jsou povinná k vyplnění
              </p>
            </div>
          </div>
        </section>

        {/* Multi-Step Form Section */}
        <section className="pb-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <MultiStepForm
              steps={steps}
              stepLabels={stepLabels}
              onComplete={handleComplete}
            />
          </div>
        </section>
      </main>
    </Layout>
  );
});

CustomItineraryForm.displayName = 'CustomItineraryForm';

export default CustomItineraryForm;