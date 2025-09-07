import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { Button, Form, Input, TextArea } from '../components/ui';
import { ROUTES } from '../constants';

const CustomItineraryForm = React.memo(() => {
  const navigate = useNavigate();
  
  // Form state
  const [formData, setFormData] = useState({
    // Základní informace
    name: '',
    email: '',
    
    // Cestovní preference
    vacationType: '',
    vacationTypeOther: '',
    duration: '',
    customDuration: '',
    
    // Počet osob, termín, finance
    travelGroup: '',
    familyDetails: '',
    friendsCount: '',
    preferredTerm: '',
    specificTerm: '',
    budgetCategory: '',
    budgetAmount: '',
    transportation: '',
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
  
  const handleBackToItinerary = useCallback(() => {
    navigate(ROUTES.CUSTOM_ITINERARY_DETAIL);
  }, [navigate]);
  
  const handleAddToCart = useCallback((e) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name.trim() || !formData.email.trim()) {
      alert('Prosím vyplň jméno a email.');
      return;
    }
    
    // Simulate adding to cart
    alert('Itinerář na míru byl přidán do košíku! Dotazník byl uložen a bude zpracován po dokončení objednávky.');
    
    // Here you would normally integrate with your cart/payment system
    // For now, we'll navigate back to the itinerary detail
    navigate(ROUTES.CUSTOM_ITINERARY_DETAIL);
  }, [formData, navigate]);

  // Automatické poescrollování na vrchol při načtení stránky
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
            <div className="text-center mb-5 pb-5 border-b border-gray-200">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black leading-tight mb-4">
                Naplánuj svůj trip
              </h1>
              <h2 className="text-xl sm:text-2xl text-green-800 font-medium mb-4">
                Dotazník
              </h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                Vyplň dotazník a já ti připravím itinerář přesně podle tvých představ
              </p>
            </div>
          </div>
        </section>

        {/* Form Section */}
        <section className="pb-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-3xl shadow-xl p-8 sm:p-12">
              <Form onSubmit={handleAddToCart} spacing="lg">
                {/* Základní informace */}
                <div>
                  <h3 className="text-xl font-bold text-green-800 mb-6 border-b border-gray-200 pb-3">
                    Základní informace
                  </h3>
                  <div className="grid md:grid-cols-2 gap-6">
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
                  <h3 className="text-xl font-bold text-green-800 mb-6 border-b border-gray-200 pb-3">
                    Cestovní preference
                  </h3>
                  
                  {/* Typ dovolené */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
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
                            type="radio"
                            name="vacationType"
                            value={type}
                            checked={formData.vacationType === type}
                            onChange={(e) => handleInputChange('vacationType', e.target.value)}
                            className="w-4 h-4 text-green-600 focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-700">{type}</span>
                        </label>
                      ))}
                    </div>
                    {formData.vacationType === 'Jiné' && (
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
                    <label className="block text-sm font-medium text-gray-700 mb-3">
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
                          <span className="text-sm text-gray-700">{duration}</span>
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

                {/* Počet osob, termín, finance */}
                <div>
                  <h3 className="text-xl font-bold text-green-800 mb-6 border-b border-gray-200 pb-3">
                    Cestování a termín
                  </h3>
                  
                  {/* Počet osob */}
                  <div className="mb-6">
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
                          <span className="text-sm text-gray-700">{group}</span>
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
                  <div className="mb-6">
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
                            type="radio"
                            name="preferredTerm"
                            value={term}
                            checked={formData.preferredTerm === term}
                            onChange={(e) => handleInputChange('preferredTerm', e.target.value)}
                            className="w-4 h-4 text-green-600 focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-700">{term}</span>
                        </label>
                      ))}
                    </div>
                    {formData.preferredTerm === 'Určitý termín' && (
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
                  <div className="mb-6">
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
                          <span className="text-sm text-gray-700">{budget}</span>
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
                            type="radio"
                            name="transportation"
                            value={transport}
                            checked={formData.transportation === transport}
                            onChange={(e) => handleInputChange('transportation', e.target.value)}
                            className="w-4 h-4 text-green-600 focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-700">{transport}</span>
                        </label>
                      ))}
                    </div>
                    {formData.transportation === 'Jiné' && (
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

                {/* Destinace */}
                <div>
                  <h3 className="text-xl font-bold text-green-800 mb-6 border-b border-gray-200 pb-3">
                    Destinace
                  </h3>
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
                </div>

                {/* Zájmy a aktivity */}
                <div>
                  <h3 className="text-xl font-bold text-green-800 mb-6 border-b border-gray-200 pb-3">
                    Zájmy a aktivity
                  </h3>
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
                </div>

                {/* Další informace */}
                <div>
                  <h3 className="text-xl font-bold text-green-800 mb-6 border-b border-gray-200 pb-3">
                    Další informace
                  </h3>
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
                  </div>
                </div>

                {/* Submit button */}
                <div className="text-center pt-8 border-t border-gray-200">
                  <Button
                    type="submit"
                    variant="green"
                    size="xl"
                    className="px-12"
                  >
                    Přidat do košíku
                  </Button>
                  <p className="text-sm text-gray-500 mt-4">
                    Dotazník bude uložen a zpracován po dokončení objednávky
                  </p>
                </div>
              </Form>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
});

CustomItineraryForm.displayName = 'CustomItineraryForm';

export default CustomItineraryForm;