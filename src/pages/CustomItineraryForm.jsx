import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import Layout from '../components/layout/Layout';
import { Button, Input, TextArea, MultiStepForm, CustomCheckbox, CustomRadio } from '../components/ui';
import { ROUTES } from '../constants';
import { BASE_PATH } from '../constants/app';

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
      if (!text || text.trim() === '') return;
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
    if (formData.vacationTypeOther) {
      addWrappedText(`Jiný typ: ${formData.vacationTypeOther}`);
    }
    if (formData.duration) {
      addWrappedText(`Délka pobytu: ${formData.duration}`);
    }
    if (formData.customDuration) {
      addWrappedText(`Počet dní: ${formData.customDuration}`);
    }
    yPosition += 10;

    // Travel details
    doc.setFontSize(14);
    doc.setTextColor(22, 101, 52);
    addWrappedText('Cestování a termín');
    yPosition += 5;

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    addWrappedText(`Cestovní skupina: ${formData.travelGroup || 'Neuvedeno'}`);
    if (formData.familyDetails) {
      addWrappedText(`Podrobnosti o rodině: ${formData.familyDetails}`);
    }
    if (formData.friendsCount) {
      addWrappedText(`Počet přátel: ${formData.friendsCount}`);
    }
    if (formData.preferredTerm.length > 0) {
      addWrappedText(`Preferovaný termín: ${formData.preferredTerm.join(', ')}`);
    }
    if (formData.specificTerm) {
      addWrappedText(`Konkrétní termín: ${formData.specificTerm}`);
    }
    if (formData.budgetCategory) {
      addWrappedText(`Rozpočet: ${formData.budgetCategory}`);
    }
    if (formData.budgetAmount) {
      addWrappedText(`Orientační částka: ${formData.budgetAmount}`);
    }
    if (formData.transportation.length > 0) {
      addWrappedText(`Doprava: ${formData.transportation.join(', ')}`);
    }
    if (formData.transportationOther) {
      addWrappedText(`Jiná doprava: ${formData.transportationOther}`);
    }
    yPosition += 10;

    // Destinations
    doc.setFontSize(14);
    doc.setTextColor(22, 101, 52);
    addWrappedText('Destinace a preference');
    yPosition += 5;

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    addWrappedText(`Konkrétní destinace: ${formData.specificDestination || 'Neuvedeno'}`);
    addWrappedText(`Otevřený návrhům: ${formData.openToSuggestions || 'Neuvedeno'}`);
    addWrappedText(`Preferované kontinenty: ${formData.preferredContinents || 'Neuvedeno'}`);
    addWrappedText(`Klimatické preference: ${formData.climatePreferences || 'Neuvedeno'}`);
    addWrappedText(`Kultura vs příroda: ${formData.cultureVsNature || 'Neuvedeno'}`);
    addWrappedText(`Specifické faktory: ${formData.specificFactors || 'Neuvedeno'}`);
    yPosition += 10;

    // Activities and interests
    doc.setFontSize(14);
    doc.setTextColor(22, 101, 52);
    addWrappedText('Zájmy a aktivity');
    yPosition += 5;

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    addWrappedText(`Hlavní zájmy: ${formData.mainInterests || 'Neuvedeno'}`);
    addWrappedText(`Specifické aktivity: ${formData.specificActivities || 'Neuvedeno'}`);
    addWrappedText(`Požadavky na ubytování: ${formData.accommodationRequirements || 'Neuvedeno'}`);
    addWrappedText(`Preference stravování: ${formData.diningPreferences || 'Neuvedeno'}`);
    addWrappedText(`Organizované výlety: ${formData.organizedTours || 'Neuvedeno'}`);
    yPosition += 10;

    // Additional information
    doc.setFontSize(14);
    doc.setTextColor(22, 101, 52);
    addWrappedText('Dodatečné informace');
    yPosition += 5;

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    addWrappedText(`Zdravotní omezení: ${formData.healthRestrictions || 'Žádné'}`);
    addWrappedText(`Cestování s mazlíčkem: ${formData.travelWithPet || 'Ne'}`);
    addWrappedText(`Dodatečné informace: ${formData.additionalInfo || 'Žádné'}`);

    // Add date
    yPosition += 10;
    addWrappedText(`Datum vyplnění: ${new Date().toLocaleDateString('cs-CZ')}`);

    // Footer
    yPosition += 20;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    addWrappedText('Vygenerováno aplikací Cesty bez mapy - www.cestybelmapy.cz');

    // Save PDF
    doc.save('itinerar-na-miru-dotaznik.pdf');
  }, [formData]);

  // Toast notification state
  const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });

  // Show notification function
  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: 'info' });
    }, 4000);
  }, []);

  const handleComplete = useCallback(() => {
    // Basic validation
    if (!formData.name.trim() || !formData.email.trim()) {
      showNotification('Prosím vyplň jméno a email.', 'error');
      return;
    }

    try {
      // Generate PDF
      generatePDF();

      // Show success message
      setShowSuccessMessage(true);
      showNotification('PDF bylo úspěšně vygenerováno!', 'success');
    } catch (error) {
      console.error('Chyba při generování PDF:', error);
      showNotification('Chyba při generování PDF. Zkuste to prosím znovu.', 'error');
    }
  }, [formData, generatePDF, showNotification]);

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
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-10">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-black mb-10">
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
      content: (
        <div className="space-y-8">
          {/* Základní informace */}
          <div className="mb-8">
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
            {/* Separator for Základní informace */}
            <div className="border-t border-gray-200 mt-10 mb-10"></div>
          </div>

          {/* Typ dovolené */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Left - Question */}
              <div>
                <label className="block text-base font-medium text-black mb-10">
                  Jaký typ dovolené preferuješ?
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
                    <CustomCheckbox
                      key={type}
                      id={`vacationType-${type}`}
                      value={type}
                      checked={formData.vacationType.includes(type)}
                      onChange={() => handleCheckboxChange('vacationType', type)}
                    >
                      {type}
                    </CustomCheckbox>
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

              {/* Right - Image */}
              <div className="hidden lg:block">
                <div className="flex flex-col h-full justify-center items-center">
                  <div className="w-full aspect-[3/2] overflow-hidden rounded-2xl">
                    <img
                      src={`${BASE_PATH}/images/custom-itinerary-form-1.png`}
                      alt="Inspirační obrázek pro typ dovolené"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            </div>
            {/* Separator for Typ dovolené */}
            <div className="border-t border-gray-200 my-10"></div>

            {/* Délka pobytu */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Left - Question */}
              <div>
                <label className="block text-base font-medium text-black mb-10">
                  Jak dlouho plánuješ cestovat?
                </label>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    'Víkendový výlet (1-3 dny)',
                    'Kratší dovolená (4-7 dní)',
                    'Týdenní dovolená (8-14 dní)',
                    'Delší dovolená (15 dní a více)',
                    'Vím přesný počet dní'
                  ].map(duration => (
                    <CustomRadio
                      key={duration}
                      id={`duration-${duration}`}
                      name="duration"
                      value={duration}
                      checked={formData.duration === duration}
                      onChange={(e) => handleInputChange('duration', e.target.value)}
                    >
                      {duration}
                    </CustomRadio>
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

              {/* Right - Image */}
              <div className="hidden lg:block">
                <div className="flex flex-col h-full justify-center items-center">
                  <div className="w-full aspect-[3/2] overflow-hidden rounded-2xl">
                    <img
                      src={`${BASE_PATH}/images/custom-itinerary-form-2.png`}
                      alt="Inspirační obrázek pro délku pobytu"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            </div>
        </div>
      )
    },
    {
      title: 'Cestování a termín',
      content: (
        <div className="space-y-8">
          {/* Počet osob */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Left - Question */}
            <div>
              <label className="block text-base font-medium text-black mb-10">
                S kolika lidmi cestuješ?
              </label>
              <div className="space-y-3">
                {[
                  'Cestuji sám/sama',
                  'Cestuji s partnerem/partnerkou',
                  'Cestuji s rodinou',
                  'Cestuji s přáteli'
                ].map(group => (
                  <CustomRadio
                    key={group}
                    id={`travelGroup-${group}`}
                    name="travelGroup"
                    value={group}
                    checked={formData.travelGroup === group}
                    onChange={(e) => handleInputChange('travelGroup', e.target.value)}
                  >
                    {group}
                  </CustomRadio>
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

            {/* Right - Image */}
            <div className="hidden lg:block">
              <div className="flex flex-col h-full justify-center items-center">
                <div className="w-full aspect-[3/2] overflow-hidden rounded-2xl">
                  <img
                    src={`${BASE_PATH}/images/custom-itinerary-form-3.png`}
                    alt="Inspirační obrázek pro počet osob"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Separator for Počet osob */}
          <div className="border-t border-gray-200 my-10"></div>

          {/* Preferovaný termín */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Left - Question */}
            <div>
              <label className="block text-base font-medium text-black mb-10">
                Kdy bys nejraději cestoval/a?
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
                  <CustomCheckbox
                    key={term}
                    id={`preferredTerm-${term}`}
                    value={term}
                    checked={formData.preferredTerm.includes(term)}
                    onChange={() => handleCheckboxChange('preferredTerm', term)}
                  >
                    {term}
                  </CustomCheckbox>
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

            {/* Right - Image */}
            <div className="hidden lg:block">
              <div className="flex flex-col h-full justify-center items-center">
                <div className="w-full aspect-[3/2] overflow-hidden rounded-2xl">
                  <img
                    src={`${BASE_PATH}/images/custom-itinerary-form-4.png`}
                    alt="Inspirační obrázek pro preferovaný termín"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Separator for Preferovaný termín */}
          <div className="border-t border-gray-200 my-10"></div>

          {/* Rozpočet */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Left - Question */}
            <div>
              <label className="block text-base font-medium text-black mb-10">
                Jaký máš rozpočet na cestu?
              </label>
              <div className="space-y-3">
                {[
                  'Nízkorozpočtová dovolená',
                  'Středně rozpočtová dovolená',
                  'Luxusní dovolená'
                ].map(budget => (
                  <CustomRadio
                    key={budget}
                    id={`budgetCategory-${budget}`}
                    name="budgetCategory"
                    value={budget}
                    checked={formData.budgetCategory === budget}
                    onChange={(e) => handleInputChange('budgetCategory', e.target.value)}
                  >
                    {budget}
                  </CustomRadio>
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

            {/* Right - Image */}
            <div className="hidden lg:block">
              <div className="flex flex-col h-full justify-center items-center">
                <div className="w-full aspect-[3/2] overflow-hidden rounded-2xl">
                  <img
                    src={`${BASE_PATH}/images/custom-itinerary-form-5.png`}
                    alt="Inspirační obrázek pro rozpočet"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Separator for Rozpočet */}
          <div className="border-t border-gray-200 my-10"></div>

          {/* Doprava */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Left - Question */}
            <div>
              <label className="block text-base font-medium text-black mb-10">
                Jaký způsob dopravy preferuješ?
              </label>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  'Vlastní auto',
                  'Vlak',
                  'Letadlo',
                  'Autobus',
                  'Jiné'
                ].map(transport => (
                  <CustomCheckbox
                    key={transport}
                    id={`transportation-${transport}`}
                    value={transport}
                    checked={formData.transportation.includes(transport)}
                    onChange={() => handleCheckboxChange('transportation', transport)}
                  >
                    {transport}
                  </CustomCheckbox>
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

            {/* Right - Image */}
            <div className="hidden lg:block">
              <div className="flex flex-col h-full justify-center items-center">
                <div className="w-full aspect-[3/2] overflow-hidden rounded-2xl">
                  <img
                    src={`${BASE_PATH}/images/custom-itinerary-form-6.png`}
                    alt="Inspirační obrázek pro dopravu"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Destinace',
      content: (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Left - Question */}
            <div>
              <label className="block text-base font-medium text-black mb-10">
                Máš už konkrétní destinaci na mysli?
              </label>
              <TextArea
                value={formData.specificDestination}
                onChange={(e) => handleInputChange('specificDestination', e.target.value)}
                rows={2}
                placeholder="Uveď prosím konkrétní destinaci..."
                className="focus-ring"
              />
            </div>

            {/* Right - Image */}
            <div className="hidden lg:block">
              <div className="flex flex-col h-full justify-center items-center">
                <div className="w-full aspect-[3/2] overflow-hidden rounded-2xl">
                  <img
                    src={`${BASE_PATH}/images/custom-itinerary-form-7.png`}
                    alt="Inspirační obrázek pro konkrétní destinaci"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Separator for Konkrétní destinace */}
          <div className="border-t border-gray-200 my-10"></div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Left - Question */}
            <div>
              <label className="block text-base font-medium text-black mb-10">
                Jsi otevřený/á návrhům na destinaci?
              </label>
              <TextArea
                value={formData.openToSuggestions}
                onChange={(e) => handleInputChange('openToSuggestions', e.target.value)}
                rows={2}
                placeholder="Ano/Ne a případně doplň podrobnosti..."
                className="focus-ring"
              />
            </div>

            {/* Right - Image */}
            <div className="hidden lg:block">
              <div className="flex flex-col h-full justify-center items-center">
                <div className="w-full aspect-[3/2] overflow-hidden rounded-2xl">
                  <img
                    src={`${BASE_PATH}/images/custom-itinerary-form-8.png`}
                    alt="Inspirační obrázek pro návrhy destinací"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Separator for Otevřeni návrhům */}
          <div className="border-t border-gray-200 my-10"></div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Left - Question */}
            <div>
              <label className="block text-base font-medium text-black mb-10">
                Které kontinenty nebo země tě nejvíc lákají?
              </label>
              <TextArea
                value={formData.preferredContinents}
                onChange={(e) => handleInputChange('preferredContinents', e.target.value)}
                rows={2}
                placeholder="Například: Evropa, Asie, Amerika..."
                className="focus-ring"
              />
            </div>

            {/* Right - Image */}
            <div className="hidden lg:block">
              <div className="flex flex-col h-full justify-center items-center">
                <div className="w-full aspect-[3/2] overflow-hidden rounded-2xl">
                  <img
                    src={`${BASE_PATH}/images/custom-itinerary-form-9.png`}
                    alt="Inspirační obrázek pro kontinenty"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Separator for Preferované kontinenty */}
          <div className="border-t border-gray-200 my-10"></div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Left - Question */}
            <div>
              <label className="block text-base font-medium text-black mb-10">
                Jaké klima máš nejradši?
              </label>
              <TextArea
                value={formData.climatePreferences}
                onChange={(e) => handleInputChange('climatePreferences', e.target.value)}
                rows={2}
                placeholder="Popište své preference ohledně počasí a klimatu..."
                className="focus-ring"
              />
            </div>

            {/* Right - Image */}
            <div className="hidden lg:block">
              <div className="flex flex-col h-full justify-center items-center">
                <div className="w-full aspect-[3/2] overflow-hidden rounded-2xl">
                  <img
                    src={`${BASE_PATH}/images/custom-itinerary-form-10.png`}
                    alt="Inspirační obrázek pro klimatické podmínky"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Separator for Klimatické podmínky */}
          <div className="border-t border-gray-200 my-10"></div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Left - Question */}
            <div>
              <label className="block text-base font-medium text-black mb-10">
                Co tě víc láká - historie a kultura, nebo příroda a dobrodružství?
              </label>
              <TextArea
                value={formData.cultureVsNature}
                onChange={(e) => handleInputChange('cultureVsNature', e.target.value)}
                rows={3}
                placeholder="Popište co vás více láká - kultura, historie, příroda, outdoorové aktivity..."
                className="focus-ring"
              />
            </div>

            {/* Right - Image */}
            <div className="hidden lg:block">
              <div className="flex flex-col h-full justify-center items-center">
                <div className="w-full aspect-[3/2] overflow-hidden rounded-2xl">
                  <img
                    src={`${BASE_PATH}/images/custom-itinerary-form-11.png`}
                    alt="Inspirační obrázek pro kulturu vs přírodu"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Separator for Kultura vs příroda */}
          <div className="border-t border-gray-200 my-10"></div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Left - Question */}
            <div>
              <label className="block text-base font-medium text-black mb-10">
                Jsou pro tebe důležité specifické faktory, jako je dostupnost pláží, hor, lyžařských středisek, ...?
              </label>
              <TextArea
                value={formData.specificFactors}
                onChange={(e) => handleInputChange('specificFactors', e.target.value)}
                rows={2}
                placeholder="Uveďte specifické požadavky na destinaci..."
                className="focus-ring"
              />
            </div>

            {/* Right - Image */}
            <div className="hidden lg:block">
              <div className="flex flex-col h-full justify-center items-center">
                <div className="w-full aspect-[3/2] overflow-hidden rounded-2xl">
                  <img
                    src={`${BASE_PATH}/images/custom-itinerary-form-12.png`}
                    alt="Inspirační obrázek pro specifické faktory"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Zájmy a aktivity',
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Left - Question */}
            <div>
              <label className="block text-base font-medium text-black mb-10">
                Co tě na dovolené nejvíce baví? (poznávání památek, relaxace u moře, sportovní aktivity, gastronomické zážitky, ...)
              </label>
              <TextArea
                value={formData.mainInterests}
                onChange={(e) => handleInputChange('mainInterests', e.target.value)}
                rows={3}
                placeholder="Popište co vás na cestování nejvíce zajímá..."
                className="focus-ring"
              />
            </div>

            {/* Right - Image */}
            <div className="hidden lg:block">
              <div className="flex flex-col h-full justify-center items-center">
                <div className="w-full aspect-[3/2] overflow-hidden rounded-2xl">
                  <img
                    src={`${BASE_PATH}/images/custom-itinerary-form-13.png`}
                    alt="Inspirační obrázek pro hlavní zájmy"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Separator for Hlavní zájmy */}
          <div className="border-t border-gray-200 my-10"></div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Left - Question */}
            <div>
              <label className="block text-base font-medium text-black mb-10">
                Jsou pro tebe důležité specifické aktivity, které bys na dovolené rád/a zažil/a? (např. potápění, turistika, degustace vín, ...)
              </label>
              <TextArea
                value={formData.specificActivities}
                onChange={(e) => handleInputChange('specificActivities', e.target.value)}
                rows={3}
                placeholder="Uveďte konkrétní aktivity, které chcete zažít..."
                className="focus-ring"
              />
            </div>

            {/* Right - Image */}
            <div className="hidden lg:block">
              <div className="flex flex-col h-full justify-center items-center">
                <div className="w-full aspect-[3/2] overflow-hidden rounded-2xl">
                  <img
                    src={`${BASE_PATH}/images/custom-itinerary-form-14.png`}
                    alt="Inspirační obrázek pro specifické aktivity"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Separator for Specifické aktivity */}
          <div className="border-t border-gray-200 my-10"></div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Left - Question */}
            <div>
              <label className="block text-base font-medium text-black mb-10">
                Máš nějaké specifické požadavky na ubytování? (typ ubytování, vybavení, ...)
              </label>
              <TextArea
                value={formData.accommodationRequirements}
                onChange={(e) => handleInputChange('accommodationRequirements', e.target.value)}
                rows={2}
                placeholder="Popište požadavky na ubytování..."
                className="focus-ring"
              />
            </div>

            {/* Right - Image */}
            <div className="hidden lg:block">
              <div className="flex flex-col h-full justify-center items-center">
                <div className="w-full aspect-[3/2] overflow-hidden rounded-2xl">
                  <img
                    src={`${BASE_PATH}/images/custom-itinerary-form-15.png`}
                    alt="Inspirační obrázek pro ubytování"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Separator for Požadavky na ubytování */}
          <div className="border-t border-gray-200 my-10"></div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Left - Question */}
            <div>
              <label className="block text-base font-medium text-black mb-10">
                Jaký typ stravování preferuješ? (snídaně v hotelu, vlastní vaření, stravování v restauracích, ...)
              </label>
              <TextArea
                value={formData.diningPreferences}
                onChange={(e) => handleInputChange('diningPreferences', e.target.value)}
                rows={2}
                placeholder="Popište preference ohledně stravování..."
                className="focus-ring"
              />
            </div>

            {/* Right - Image */}
            <div className="hidden lg:block">
              <div className="flex flex-col h-full justify-center items-center">
                <div className="w-full aspect-[3/2] overflow-hidden rounded-2xl">
                  <img
                    src={`${BASE_PATH}/images/custom-itinerary-form-16.png`}
                    alt="Inspirační obrázek pro stravování"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Separator for Preference stravování */}
          <div className="border-t border-gray-200 my-10"></div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Left - Question */}
            <div>
              <label className="block text-base font-medium text-black mb-10">
                Máš zájem o organizované výlety a exkurze?
              </label>
              <TextArea
                value={formData.organizedTours}
                onChange={(e) => handleInputChange('organizedTours', e.target.value)}
                rows={2}
                placeholder="Ano/Ne a případně jaké typy výletů vás zajímají..."
                className="focus-ring"
              />
            </div>

            {/* Right - Image */}
            <div className="hidden lg:block">
              <div className="flex flex-col h-full justify-center items-center">
                <div className="w-full aspect-[3/2] overflow-hidden rounded-2xl">
                  <img
                    src={`${BASE_PATH}/images/custom-itinerary-form-17.png`}
                    alt="Inspirační obrázek pro organizované výlety"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Dokončení',
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Left - Question */}
            <div>
              <label className="block text-base font-medium text-black mb-10">
                Máš nějaké zdravotní omezení, která by mohla ovlivnit tvou cestu?
              </label>
              <TextArea
                value={formData.healthRestrictions}
                onChange={(e) => handleInputChange('healthRestrictions', e.target.value)}
                rows={2}
                placeholder="Uveďte případná zdravotní omezení..."
                className="focus-ring"
              />
            </div>

            {/* Right - Image */}
            <div className="hidden lg:block">
              <div className="flex flex-col h-full justify-center items-center">
                <div className="w-full aspect-[3/2] overflow-hidden rounded-2xl">
                  <img
                    src={`${BASE_PATH}/images/custom-itinerary-form-18.png`}
                    alt="Inspirační obrázek pro zdravotní omezení"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Separator for Zdravotní omezení */}
          <div className="border-t border-gray-200 my-10"></div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Left - Question */}
            <div>
              <label className="block text-base font-medium text-black mb-10">
                Cestuješ s domácím mazlíčkem?
              </label>
              <TextArea
                value={formData.travelWithPet}
                onChange={(e) => handleInputChange('travelWithPet', e.target.value)}
                rows={2}
                placeholder="Ano/Ne a případně jaký mazlíček..."
                className="focus-ring"
              />
            </div>

            {/* Right - Image */}
            <div className="hidden lg:block">
              <div className="flex flex-col h-full justify-center items-center">
                <div className="w-full aspect-[3/2] overflow-hidden rounded-2xl">
                  <img
                    src={`${BASE_PATH}/images/custom-itinerary-form-19.png`}
                    alt="Inspirační obrázek pro cestování s mazlíčkem"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
          {/* Separator for Cestování s mazlíčkem */}
          <div className="border-t border-gray-200 my-10"></div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Left - Question */}
            <div>
              <label className="block text-base font-medium text-black mb-10">
                Je ještě něco, co bys mi o sobě rád/a sdělil/a, abych ti mohla lépe vytvořit itinerář na míru?
              </label>
              <TextArea
                value={formData.additionalInfo}
                onChange={(e) => handleInputChange('additionalInfo', e.target.value)}
                rows={4}
                placeholder="Uveďte cokoliv dalšího, co považujete za důležité..."
                className="focus-ring"
              />
            </div>

            {/* Right - Image */}
            <div className="hidden lg:block">
              <div className="flex flex-col h-full justify-center items-center">
                <div className="w-full aspect-[3/2] overflow-hidden rounded-2xl">
                  <img
                    src={`${BASE_PATH}/images/custom-itinerary-form-20.png`}
                    alt="Inspirační obrázek pro dodatečné informace"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>

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
      {/* Toast Notification */}
      {notification.show && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm p-4 rounded-lg shadow-lg transition-all duration-300 ${
          notification.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
          notification.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
          'bg-blue-100 text-blue-800 border border-blue-200'
        }`}>
          <div className="flex items-center space-x-2">
            {notification.type === 'success' && (
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {notification.type === 'error' && (
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <p className="text-sm font-medium">{notification.message}</p>
          </div>
        </div>
      )}

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