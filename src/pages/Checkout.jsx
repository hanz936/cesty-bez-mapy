// ================================================
// Checkout Page - Stripe Checkout Flow
// ================================================
// Zobrazuje souhrn objednávky a redirectuje na Stripe Checkout
// ================================================

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { Button, TurnstileField } from '../components/ui';
import { BillingForm } from '../components/cart/BillingForm.jsx';
import { BASE_PATH, ROUTES } from '../constants';
import { useCart } from '../contexts';
import { supabase } from '../lib/supabase';

// Komponenta pro položku v checkoutu
const CheckoutItem = React.memo(({ item }) => {
  const [imageError, setImageError] = useState(false);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  // Sestavení URL obrázku
  const imageUrl = item.image?.startsWith('http')
    ? item.image
    : item.image
      ? `${BASE_PATH}${item.image}`
      : null;

  return (
    <div className="flex gap-4 py-4 border-b border-gray-100 last:border-b-0">
      <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={item.alt || item.title}
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
        {item.duration && (
          <p className="text-xs text-gray-600 mb-2">
            📅 {item.duration}
          </p>
        )}
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

const PRIVACY_POLICY_VERSION = '2026-06-01';

const Checkout = React.memo(() => {
  const navigate = useNavigate();
  const { cartItems, cartTotal, itemCount } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [billing, setBilling] = useState({ is_company: false });
  const [marketingConsent, setMarketingConsent] = useState(false);

  // Automatické poescrollování na vrchol při načtení stránky
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Redirect na průvodce pokud je košík prázdný
  useEffect(() => {
    if (cartItems.length === 0) {
      navigate(ROUTES.TRAVEL_GUIDES);
    }
  }, [cartItems.length, navigate]);

  // Zpět na průvodce
  const handleBackToShop = useCallback(() => {
    navigate(ROUTES.TRAVEL_GUIDES);
  }, [navigate]);

  // Vytvoření Stripe Checkout Session a redirect
  const handleCheckout = useCallback(async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Přihlášení anonymního uživatele pokud není přihlášen
      let userId = null;
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Anonymní přihlášení pro guest checkout - vyžaduje Turnstile token
        if (!captchaToken) {
          setError('Počkej prosím na bezpečnostní ověření.');
          setIsProcessing(false);
          return;
        }
        const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously({
          options: { captchaToken },
        });
        if (anonError) {
          console.error('Anonymous sign-in error:', anonError);
        } else {
          userId = anonData.user?.id;
        }
      } else {
        userId = user.id;
      }

      // Příprava line_items pro Edge Function
      const lineItems = cartItems.map(item => ({
        product_id: item.id,
        quantity: item.quantity || 1,
        custom_itinerary_request_id: item.customItineraryRequestId || null,
      }));

      // Sestavení URL pro success a cancel
      const baseUrl = window.location.origin;
      const successUrl = `${baseUrl}${ROUTES.ORDER_CONFIRMATION}?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${baseUrl}${ROUTES.CHECKOUT}`;

      // Volání Edge Function pro vytvoření Checkout Session
      const { data, error: fnError } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          line_items: lineItems,
          success_url: successUrl,
          cancel_url: cancelUrl,
          user_id: userId,
          billing,
          marketing_consent: marketingConsent,
          privacy_policy_version: PRIVACY_POLICY_VERSION,
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Nepodařilo se vytvořit platební session');
      }

      if (!data?.url) {
        throw new Error('Nepodařilo se získat URL pro platbu');
      }

      // Redirect na Stripe Checkout
      window.location.href = data.url;

    } catch (err) {
      console.error('Checkout error:', err);
      setError(err.message || 'Nastala chyba při zpracování platby. Zkus to prosím znovu.');
      setIsProcessing(false);
    }
  }, [cartItems, captchaToken, billing, marketingConsent]);

  // Prázdný košík - přesměrování probíhá v useEffect
  if (cartItems.length === 0) {
    return (
      <Layout>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-700 mb-4"></div>
            <p className="text-gray-600">Přesměrovávám...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <main className="min-h-screen bg-white">
        {/* Header Section */}
        <section className="relative pt-6 pb-8 bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Breadcrumb */}
            <nav className="mb-6">
              <button
                onClick={handleBackToShop}
                className="flex items-center text-sm sm:text-base text-gray-600 hover:text-green-700 transition-colors group"
              >
                <svg className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Zpět na průvodce
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
                    <span className="ml-2 text-sm text-black font-medium">Platba</span>
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
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="card-base p-6 lg:p-8">

              {/* Souhrn objednávky */}
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
                  <span>{cartTotal.toLocaleString()} Kč</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-black pt-3 border-t border-gray-300">
                  <span>Celkem k úhradě:</span>
                  <span className="text-green-800">{cartTotal.toLocaleString()} Kč</span>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="p-4 mb-6 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              {/* Info o Stripe */}
              <div className="flex items-start gap-3 p-4 mb-6 bg-blue-50 border border-blue-200 rounded-lg">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-blue-800">
                  Po kliknutí na tlačítko budeš přesměrován/a na bezpečnou platební bránu Stripe,
                  kde zadáš platební údaje.
                </p>
              </div>

              {/* Fakturační údaje (volitelně B2B) */}
              <div className="mb-6">
                <BillingForm
                  value={billing}
                  onChange={setBilling}
                  marketingConsent={marketingConsent}
                  setMarketingConsent={setMarketingConsent}
                />
              </div>

              {/* Turnstile bezpečnostní ověření */}
              <TurnstileField
                onVerify={setCaptchaToken}
                onExpire={() => setCaptchaToken(null)}
                onError={() => setCaptchaToken(null)}
              />

              {/* Platební tlačítko */}
              <Button
                onClick={handleCheckout}
                variant="green"
                size="lg"
                fullWidth
                disabled={isProcessing || !captchaToken}
                className="mb-4"
              >
                {isProcessing ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Přesměrovávám na platbu...
                  </div>
                ) : (
                  `Zaplatit ${cartTotal.toLocaleString()} Kč`
                )}
              </Button>

              {/* Bezpečnostní info */}
              <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  SSL šifrování
                </div>
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z"/>
                  </svg>
                  Powered by Stripe
                </div>
              </div>

              {/* Podmínky */}
              <p className="text-xs text-gray-500 text-center mt-4">
                Pokračováním souhlasíš s našimi{' '}
                <a href="#" className="text-green-600 hover:text-green-700">obchodními podmínkami</a>
              </p>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
});

Checkout.displayName = 'Checkout';

export default Checkout;
