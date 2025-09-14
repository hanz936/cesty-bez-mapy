import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { Button, Form, Input, TextArea, Dropdown } from '../components/ui';
import { BASE_PATH, ROUTES } from '../constants';

// Statická data košíku (mockup - stejné jako v Cart komponente)
const MOCK_CART_ITEMS = [
  {
    id: 1,
    title: 'Roadtrip po Itálii na 20 dní',
    price: 699,
    image: `${BASE_PATH}/images/guide-italy-roadtrip.png`,
    alt: 'Malebná italská krajina s cestou vedoucí mezi kopci',
    duration: '20 dní',
    quantity: 1
  },
  {
    id: 0,
    title: 'Itinerář na míru – cesta šitá jen pro tebe',
    price: 999,
    image: `${BASE_PATH}/images/custom-itinerary.png`,
    alt: 'Otevřená mapa s tužkou a poznámkami pro plánování cesty na míru',
    duration: 'Dle potřeb',
    quantity: 1
  }
];

const CheckoutItem = React.memo(({ item }) => {
  const [imageError, setImageError] = useState(false);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  return (
    <div className="flex gap-4 py-4 border-b border-gray-100 last:border-b-0">
      <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
        {!imageError ? (
          <img 
            src={item.image} 
            alt={item.alt}
            className="w-full h-full object-cover"
            onError={handleImageError}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
            <span className="text-green-800 text-xl">🗺️</span>
          </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-black line-clamp-2 leading-tight mb-1">
          {item.title}
        </h4>
        <p className="text-xs text-gray-600 mb-2">
          📅 {item.duration}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            Množství: {item.quantity}
          </span>
          <span className="text-lg font-bold text-green-800">
            {item.price.toLocaleString()} Kč
          </span>
        </div>
      </div>
    </div>
  );
});

CheckoutItem.displayName = 'CheckoutItem';

const Checkout = React.memo(() => {
  const navigate = useNavigate();
  
  // Form state
  const [formData, setFormData] = useState({
    // Kontaktní údaje
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    
    // Fakturační adresa
    company: '',
    street: '',
    city: '',
    postalCode: '',
    country: 'Česká republika',
    
    // Platba
    paymentMethod: 'card',
    
    // Dodatečné informace
    notes: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Výpočty
  const cartItems = MOCK_CART_ITEMS;
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal;
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const countryOptions = [
    'Česká republika',
    'Slovensko',
    'Německo',
    'Rakousko',
    'Polsko',
    'Maďarsko'
  ];

  const paymentOptions = [
    { value: 'card', label: 'Platební karta' },
    { value: 'transfer', label: 'Bankovní převod' }
  ];

  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  }, [errors]);

  const validateForm = useCallback(() => {
    const newErrors = {};
    
    if (!formData.firstName.trim()) newErrors.firstName = 'Jméno je povinné';
    if (!formData.lastName.trim()) newErrors.lastName = 'Příjmení je povinné';
    if (!formData.email.trim()) {
      newErrors.email = 'E-mail je povinný';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Neplatný e-mail';
    }
    if (!formData.phone.trim()) newErrors.phone = 'Telefon je povinný';
    if (!formData.street.trim()) newErrors.street = 'Ulice je povinná';
    if (!formData.city.trim()) newErrors.city = 'Město je povinné';
    if (!formData.postalCode.trim()) newErrors.postalCode = 'PSČ je povinné';
    
    return newErrors;
  }, [formData]);

  const handleBackToCart = useCallback(() => {
    // V reálné aplikaci bychom otevřeli košík
    navigate(ROUTES.TRAVEL_GUIDES);
  }, [navigate]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setIsSubmitting(true);
    setErrors({});
    
    try {
      // Simulace objednávky
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Úspěšná objednávka - přechod na confirmation stránku
      const orderNumber = `CBM-2024-${Math.random().toString().slice(2, 8)}`;
      navigate(`${ROUTES.ORDER_CONFIRMATION}?name=${encodeURIComponent(formData.firstName + ' ' + formData.lastName)}&order=${orderNumber}`);
      
    } catch {
      setErrors({ submit: 'Něco se pokazilo. Zkus to prosím znovu.' });
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, navigate]);

  // Automatické poescrollování na vrchol při načtení stránky
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <Layout>
      <main className="min-h-screen bg-white">
        {/* Header Section */}
        <section className="relative pt-6 pb-8 bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Breadcrumb */}
            <nav className="mb-6">
              <button 
                onClick={handleBackToCart}
                className="flex items-center text-sm sm:text-base text-gray-600 hover:text-green-700 transition-colors group"
              >
                <svg className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Zpět do košíku
              </button>
            </nav>

            {/* Title Section */}
            <div className="text-center">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black leading-tight">
                Dokončení objednávky
              </h1>
              
              {/* Progress Steps */}
              <div className="flex items-center justify-center mt-8">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                      ✓
                    </div>
                    <span className="ml-2 text-sm text-gray-600">Košík</span>
                  </div>
                  <div className="w-12 h-px bg-gray-300"></div>
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                      2
                    </div>
                    <span className="ml-2 text-sm text-black font-medium">Objednávka</span>
                  </div>
                  <div className="w-12 h-px bg-gray-300"></div>
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center text-sm font-medium">
                      3
                    </div>
                    <span className="ml-2 text-sm text-gray-600">Potvrzení</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className="py-8 lg:py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
              
              {/* Levá strana - Formulář */}
              <div className="lg:col-span-2">
                <div className="card-base p-6 lg:p-8">
                  <Form onSubmit={handleSubmit} spacing="lg">
                    
                    {/* Kontaktní údaje */}
                    <div>
                      <h2 className="text-xl font-bold text-green-800 mb-6 border-b border-gray-200 pb-3">
                        Kontaktní údaje
                      </h2>
                      <div className="grid sm:grid-cols-2 gap-6">
                        <Input
                          type="text"
                          label="Jméno"
                          required
                          value={formData.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                          placeholder="Tvé jméno"
                          error={errors.firstName}
                          className="focus-ring"
                        />
                        <Input
                          type="text"
                          label="Příjmení"
                          required
                          value={formData.lastName}
                          onChange={(e) => handleInputChange('lastName', e.target.value)}
                          placeholder="Tvé příjmení"
                          error={errors.lastName}
                          className="focus-ring"
                        />
                      </div>
                      <div className="grid sm:grid-cols-2 gap-6">
                        <Input
                          type="email"
                          label="E-mail"
                          required
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          placeholder="tvuj@email.cz"
                          error={errors.email}
                          className="focus-ring"
                        />
                        <Input
                          type="tel"
                          label="Telefon"
                          required
                          value={formData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          placeholder="+420 123 456 789"
                          error={errors.phone}
                          className="focus-ring"
                        />
                      </div>
                    </div>

                    {/* Fakturační adresa */}
                    <div>
                      <h2 className="text-xl font-bold text-green-800 mb-6 border-b border-gray-200 pb-3">
                        Fakturační adresa
                      </h2>
                      <div className="space-y-6">
                        <Input
                          type="text"
                          label="Firma (nepovinné)"
                          value={formData.company}
                          onChange={(e) => handleInputChange('company', e.target.value)}
                          placeholder="Název firmy"
                          className="focus-ring"
                        />
                        <Input
                          type="text"
                          label="Ulice a číslo popisné"
                          required
                          value={formData.street}
                          onChange={(e) => handleInputChange('street', e.target.value)}
                          placeholder="Např. Václavské náměstí 123"
                          error={errors.street}
                          className="focus-ring"
                        />
                        <div className="grid sm:grid-cols-3 gap-6">
                          <Input
                            type="text"
                            label="Město"
                            required
                            value={formData.city}
                            onChange={(e) => handleInputChange('city', e.target.value)}
                            placeholder="Praha"
                            error={errors.city}
                            className="focus-ring"
                          />
                          <Input
                            type="text"
                            label="PSČ"
                            required
                            value={formData.postalCode}
                            onChange={(e) => handleInputChange('postalCode', e.target.value)}
                            placeholder="12000"
                            error={errors.postalCode}
                            className="focus-ring"
                          />
                          <Dropdown
                            label="Země"
                            value={formData.country}
                            onChange={(e) => handleInputChange('country', e.target.value)}
                            options={countryOptions}
                            fullWidth={true}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Způsob platby */}
                    <div>
                      <h2 className="text-xl font-bold text-green-800 mb-6 border-b border-gray-200 pb-3">
                        Způsob platby
                      </h2>
                      <div className="space-y-4">
                        {paymentOptions.map(option => (
                          <label key={option.value} className="flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-green-600 transition-colors">
                            <input
                              type="radio"
                              name="paymentMethod"
                              value={option.value}
                              checked={formData.paymentMethod === option.value}
                              onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                              className="w-4 h-4 text-green-600 focus:ring-green-500 mr-3"
                            />
                            <span className="text-black font-medium">{option.label}</span>
                          </label>
                        ))}
                      </div>
                      
                      {/* Bezpečnostní info */}
                      <div className="flex items-center mt-4 p-4 bg-green-50 rounded-lg">
                        <svg className="w-5 h-5 text-green-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <p className="text-sm text-green-800">
                          Tvé platební údaje jsou chráněny SSL šifrováním
                        </p>
                      </div>
                    </div>

                    {/* Dodatečné poznámky */}
                    <div>
                      <h2 className="text-xl font-bold text-green-800 mb-6 border-b border-gray-200 pb-3">
                        Dodatečné informace
                      </h2>
                      <TextArea
                        label="Poznámky k objednávce (nepovinné)"
                        rows={4}
                        value={formData.notes}
                        onChange={(e) => handleInputChange('notes', e.target.value)}
                        placeholder="Máš nějaké speciální požadavky nebo poznámky k objednávce?"
                        className="focus-ring"
                      />
                    </div>

                    {/* Error message */}
                    {errors.submit && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-600 text-sm">{errors.submit}</p>
                      </div>
                    )}
                  </Form>
                </div>
              </div>

              {/* Pravá strana - Souhrn objednávky */}
              <div className="lg:col-span-1">
                <div className="card-base p-6 sticky top-8">
                  <h2 className="text-xl font-bold text-black mb-6">
                    Souhrn objednávky
                  </h2>

                  {/* Seznam položek */}
                  <div className="space-y-1 mb-6">
                    {cartItems.map((item) => (
                      <CheckoutItem key={item.id} item={item} />
                    ))}
                  </div>

                  {/* Cenový souhrn */}
                  <div className="space-y-3 mb-6 pt-4 border-t border-gray-200">
                    <div className="flex justify-between text-sm text-black">
                      <span>Mezisoučet ({itemCount} {itemCount === 1 ? 'položka' : itemCount < 5 ? 'položky' : 'položek'}):</span>
                      <span>{subtotal.toLocaleString()} Kč</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>DPH (21%):</span>
                      <span>Zahrnuto v ceně</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-black pt-3 border-t border-gray-300">
                      <span>Celkem k úhradě:</span>
                      <span className="text-green-800">{total.toLocaleString()} Kč</span>
                    </div>
                  </div>

                  {/* Objednat tlačítko */}
                  <Button
                    onClick={handleSubmit}
                    variant="green"
                    size="lg"
                    fullWidth
                    disabled={isSubmitting}
                    className="mb-4"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Zpracovávám...
                      </div>
                    ) : (
                      `Objednat za ${total.toLocaleString()} Kč`
                    )}
                  </Button>

                  {/* Podmínky */}
                  <p className="text-xs text-gray-500 text-center">
                    Objednávkou souhlasíš s našimi{' '}
                    <a href="#" className="text-green-600 hover:text-green-700">obchodními podmínkami</a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
});

Checkout.displayName = 'Checkout';

export default Checkout;