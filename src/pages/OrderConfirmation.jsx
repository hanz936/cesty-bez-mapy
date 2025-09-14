import React, { useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { Button } from '../components/ui';
import { BASE_PATH, ROUTES } from '../constants';

// Statická data objednávky (mockup)
const MOCK_ORDER = {
  orderNumber: 'CBM-2024-001234',
  customerName: 'Jan Novák',
  email: 'jan.novak@email.cz',
  items: [
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
  ],
  total: 1698,
  orderDate: new Date().toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
};

const OrderItem = React.memo(({ item }) => {
  return (
    <div className="flex gap-4 py-4 border-b border-gray-100 last:border-b-0">
      <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
        <div className="w-full h-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
          <span className="text-green-800 text-xl">🗺️</span>
        </div>
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
          <span className="text-sm font-bold text-green-800">
            {item.price.toLocaleString()} Kč
          </span>
        </div>
      </div>
    </div>
  );
});

OrderItem.displayName = 'OrderItem';

const OrderConfirmation = React.memo(() => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Získání jména z URL parametrů (fallback na mockup)
  const customerName = searchParams.get('name') || MOCK_ORDER.customerName;
  const orderNumber = searchParams.get('order') || MOCK_ORDER.orderNumber;

  const handleContinueShopping = useCallback(() => {
    navigate(ROUTES.TRAVEL_GUIDES);
  }, [navigate]);

  const handleViewMyOrders = useCallback(() => {
    // V reálné aplikaci by zde byl přechod na seznam objednávek
    navigate(ROUTES.TRAVEL_GUIDES);
  }, [navigate]);

  // Automatické poescrollování na vrchol při načtení stránky
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <Layout>
      <main className="min-h-screen bg-white">
        {/* Hero Success Section */}
        <section className="py-12 lg:py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            
            {/* Success Icon */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8">
              <svg className="w-10 h-10 sm:w-12 sm:h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            {/* Success Message */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-black mb-4">
              Děkujeme za objednávku!
            </h1>
            
            <p className="text-lg sm:text-xl text-gray-700 mb-2">
              Ahoj {customerName.split(' ')[0]}! Tvá objednávka byla úspěšně přijata.
            </p>
            
            <p className="text-base text-gray-600 mb-8">
              Potvrzení jsme ti poslali na e-mail a začneme připravovat tvé itineráře.
            </p>

            {/* Order Number */}
            <div className="inline-flex items-center bg-green-50 border border-green-200 rounded-lg px-4 py-2 mb-12">
              <span className="text-sm text-gray-600 mr-2">Číslo objednávky:</span>
              <span className="font-mono text-sm font-bold text-green-800">{orderNumber}</span>
            </div>
          </div>
        </section>

        {/* Order Details Section */}
        <section className="pb-12 lg:pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
              
              {/* Left - Next Steps */}
              <div className="card-base p-6 lg:p-8">
                <h2 className="text-xl font-bold text-green-800 mb-6">
                  Co bude následovat?
                </h2>
                
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                      1
                    </div>
                    <div>
                      <h3 className="font-medium text-black mb-1">Potvrzení objednávky</h3>
                      <p className="text-sm text-gray-600">Poslali jsme ti e-mail s detaily objednávky na {MOCK_ORDER.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                      2
                    </div>
                    <div>
                      <h3 className="font-medium text-black mb-1">Příprava itinerářů</h3>
                      <p className="text-sm text-gray-600">Začneme připravovat tvé cestovní průvodce podle zadaných požadavků</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold">
                      3
                    </div>
                    <div>
                      <h3 className="font-medium text-black mb-1">Dodání průvodců</h3>
                      <p className="text-sm text-gray-600">Do 3-5 pracovních dnů ti pošleme hotové itineráře</p>
                    </div>
                  </div>
                </div>

                {/* Support Info */}
                <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-black mb-2">Potřebuješ pomoct?</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Pokud máš jakékoli dotazy k objednávce, neváhej se ozvat.
                  </p>
                  <div className="flex items-center text-sm text-green-700">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    info@cestybezmapy.cz
                  </div>
                </div>
              </div>

              {/* Right - Order Summary */}
              <div className="card-base p-6 lg:p-8">
                <h2 className="text-xl font-bold text-black mb-6">
                  Souhrn objednávky
                </h2>

                {/* Order Info */}
                <div className="mb-6 pb-4 border-b border-gray-200">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Datum objednávky:</span>
                    <span>{MOCK_ORDER.orderDate}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Číslo objednávky:</span>
                    <span className="font-mono">{orderNumber}</span>
                  </div>
                </div>

                {/* Order Items */}
                <div className="space-y-1 mb-6">
                  {MOCK_ORDER.items.map((item) => (
                    <OrderItem key={item.id} item={item} />
                  ))}
                </div>

                {/* Total */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex justify-between text-lg font-bold text-black mb-2">
                    <span>Celkem k úhradě:</span>
                    <span className="text-green-800">{MOCK_ORDER.total.toLocaleString()} Kč</span>
                  </div>
                  <p className="text-xs text-gray-500">DPH 21% je zahrnuto v ceně</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12">
              <Button
                onClick={handleContinueShopping}
                variant="green"
                size="lg"
                className="px-8"
              >
                Pokračovat v nákupu
              </Button>
              
              <Button
                onClick={handleViewMyOrders}
                variant="secondary"
                size="lg"
                className="px-8"
              >
                Zobrazit mé objednávky
              </Button>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
});

OrderConfirmation.displayName = 'OrderConfirmation';

export default OrderConfirmation;