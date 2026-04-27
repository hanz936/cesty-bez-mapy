import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { Button } from '../components/ui';
import { ROUTES } from '../constants';
import { supabase } from '../lib/supabase';
import { useCart } from '../contexts';

const CustomItineraryPreview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, removeFromCart, isInCart } = useCart();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [product, setProduct] = useState(null);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [cartError, setCartError] = useState(null);

  useEffect(() => {
    const fetchRequest = async () => {
      try {
        // Fetch the custom itinerary request
        const { data, error: fetchError } = await supabase
          .from('custom_itinerary_requests')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) {
          console.error('Chyba při načítání požadavku:', fetchError);
          setError('Požadavek nebyl nalezen.');
          setLoading(false);
          return;
        }

        setRequest(data);
        setLoading(false);
      } catch (err) {
        console.error('Neočekávaná chyba:', err);
        setError('Chyba při načítání požadavku.');
        setLoading(false);
      }
    };

    if (id) {
      fetchRequest();
    } else {
      setError('Chybí ID požadavku.');
      setLoading(false);
    }
  }, [id]);

  // Načtení produktu "Itinerář na míru" pro zobrazení ceny
  useEffect(() => {
    const fetchProduct = async () => {
      const { data } = await supabase
        .from('products')
        .select('id, title, price, slug, stripe_price_id, image_url, duration')
        .eq('slug', 'itinerar-na-miru')
        .eq('is_active', true)
        .eq('is_deleted', false)
        .single();
      setProduct(data);
    };
    fetchProduct();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleAddToCart = async () => {
    setIsAddingToCart(true);
    setCartError(null);

    try {
      // Ověřit že máme produkt a request
      if (!product) {
        throw new Error('Produkt "Itinerář na míru" nebyl nalezen');
      }

      if (!product.stripe_price_id) {
        throw new Error('Produkt není nakonfigurován pro platby');
      }

      if (!request?.id) {
        throw new Error('Chybí ID požadavku');
      }

      // Pokud je produkt už v košíku, odebrat ho (může mít jiné request_id)
      if (isInCart(product.id)) {
        removeFromCart(product.id);
      }

      // Přidat do košíku s novým request ID
      addToCart({
        ...product,
        customItineraryRequestId: request.id
      });

      // Přesměrovat na checkout
      navigate(ROUTES.CHECKOUT);

    } catch (err) {
      console.error('Error adding to cart:', err);
      setCartError(err.message);
    } finally {
      setIsAddingToCart(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-white flex items-center justify-center px-4">
          <div className="max-w-2xl w-full text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Načítám tvůj dotazník...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !request) {
    return (
      <Layout>
        <div className="min-h-screen bg-white flex items-center justify-center px-4">
          <div className="max-w-2xl w-full text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Něco se pokazilo</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button
              onClick={() => navigate(ROUTES.CUSTOM_ITINERARY_DETAIL)}
              variant="green"
              size="md"
            >
              Zpět na itinerář na míru
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // Destructure form_data for easier access
  const formData = request.form_data || {};

  return (
    <Layout>
      {/* Print/Screen Buttons - Hidden in print */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
            <button
              onClick={() => navigate(ROUTES.CUSTOM_ITINERARY_DETAIL)}
              className="text-sm text-gray-600 hover:text-green-700 transition-colors flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Zpět
            </button>
            <div className="flex gap-3">
              <Button
                onClick={handlePrint}
                variant="secondary"
                size="md"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Vytisknout / Uložit PDF
              </Button>
              <Button
                onClick={handleAddToCart}
                variant="green"
                size="md"
                disabled={isAddingToCart || !product}
              >
                {isAddingToCart
                  ? 'Načítám...'
                  : product
                    ? `Zaplatit ${product.price.toLocaleString()} Kč`
                    : 'Načítám cenu...'}
              </Button>
              {cartError && (
                <p className="text-red-600 text-sm mt-2">{cartError}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Preview Content - Optimized for printing */}
      <main className="min-h-screen bg-white print:bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:py-0">
          {/* Header */}
          <div className="mb-8 print:mb-6">
            <h1 className="text-3xl sm:text-4xl font-bold text-green-800 mb-2 print:text-2xl">
              Tvůj cestovní profil - Itinerář na míru
            </h1>
            <p className="text-gray-600 text-sm print:text-xs">
              Vyplněno: {new Date(request.created_at).toLocaleDateString('cs-CZ')}
            </p>
          </div>

          {/* Basic Information */}
          <section className="mb-8 print:mb-6 print:break-inside-avoid">
            <h2 className="text-2xl font-bold text-green-700 mb-4 pb-2 border-b-2 border-green-200 print:text-xl">
              Základní informace
            </h2>
            <div className="space-y-3 text-gray-800">
              <div>
                <span className="font-semibold">Jméno:</span> {request.customer_name}
              </div>
              <div>
                <span className="font-semibold">Email:</span> {request.customer_email}
              </div>
            </div>
          </section>

          {/* Travel Preferences */}
          <section className="mb-8 print:mb-6 print:break-inside-avoid">
            <h2 className="text-2xl font-bold text-green-700 mb-4 pb-2 border-b-2 border-green-200 print:text-xl">
              Cestovní preference
            </h2>
            <div className="space-y-3 text-gray-800">
              {formData.vacation_type && formData.vacation_type.length > 0 && (
                <div>
                  <span className="font-semibold">Typ dovolené:</span> {formData.vacation_type.join(', ')}
                </div>
              )}
              {formData.vacation_type_other && (
                <div>
                  <span className="font-semibold">Jiný typ:</span> {formData.vacation_type_other}
                </div>
              )}
              {formData.duration && (
                <div>
                  <span className="font-semibold">Délka pobytu:</span> {formData.duration}
                </div>
              )}
              {formData.custom_duration && (
                <div>
                  <span className="font-semibold">Počet dní:</span> {formData.custom_duration}
                </div>
              )}
            </div>
          </section>

          {/* Travel Details */}
          <section className="mb-8 print:mb-6 print:break-inside-avoid">
            <h2 className="text-2xl font-bold text-green-700 mb-4 pb-2 border-b-2 border-green-200 print:text-xl">
              Cestování a termín
            </h2>
            <div className="space-y-3 text-gray-800">
              {formData.travel_group && (
                <div>
                  <span className="font-semibold">Cestovní skupina:</span> {formData.travel_group}
                </div>
              )}
              {formData.family_details && (
                <div>
                  <span className="font-semibold">Podrobnosti o rodině:</span> {formData.family_details}
                </div>
              )}
              {formData.friends_count && (
                <div>
                  <span className="font-semibold">Počet přátel:</span> {formData.friends_count}
                </div>
              )}
              {formData.preferred_term && formData.preferred_term.length > 0 && (
                <div>
                  <span className="font-semibold">Preferovaný termín:</span> {formData.preferred_term.join(', ')}
                </div>
              )}
              {formData.specific_term && (
                <div>
                  <span className="font-semibold">Konkrétní termín:</span> {formData.specific_term}
                </div>
              )}
              {formData.budget_category && (
                <div>
                  <span className="font-semibold">Rozpočet:</span> {formData.budget_category}
                </div>
              )}
              {formData.budget_amount && (
                <div>
                  <span className="font-semibold">Orientační částka:</span> {formData.budget_amount}
                </div>
              )}
              {formData.transportation && formData.transportation.length > 0 && (
                <div>
                  <span className="font-semibold">Doprava:</span> {formData.transportation.join(', ')}
                </div>
              )}
              {formData.transportation_other && (
                <div>
                  <span className="font-semibold">Jiná doprava:</span> {formData.transportation_other}
                </div>
              )}
            </div>
          </section>

          {/* Destinations */}
          <section className="mb-8 print:mb-6 print:break-inside-avoid">
            <h2 className="text-2xl font-bold text-green-700 mb-4 pb-2 border-b-2 border-green-200 print:text-xl">
              Destinace a preference
            </h2>
            <div className="space-y-3 text-gray-800">
              {formData.specific_destination && (
                <div>
                  <span className="font-semibold">Konkrétní destinace:</span> {formData.specific_destination}
                </div>
              )}
              {formData.open_to_suggestions && (
                <div>
                  <span className="font-semibold">Otevřený návrhům:</span> {formData.open_to_suggestions}
                </div>
              )}
              {formData.preferred_continents && (
                <div>
                  <span className="font-semibold">Preferované kontinenty:</span> {formData.preferred_continents}
                </div>
              )}
              {formData.climate_preferences && (
                <div>
                  <span className="font-semibold">Klimatické preference:</span> {formData.climate_preferences}
                </div>
              )}
              {formData.culture_vs_nature && (
                <div>
                  <span className="font-semibold">Kultura vs příroda:</span> {formData.culture_vs_nature}
                </div>
              )}
              {formData.specific_factors && (
                <div>
                  <span className="font-semibold">Specifické faktory:</span> {formData.specific_factors}
                </div>
              )}
            </div>
          </section>

          {/* Interests and Activities */}
          <section className="mb-8 print:mb-6 print:break-inside-avoid">
            <h2 className="text-2xl font-bold text-green-700 mb-4 pb-2 border-b-2 border-green-200 print:text-xl">
              Zájmy a aktivity
            </h2>
            <div className="space-y-3 text-gray-800">
              {formData.main_interests && (
                <div>
                  <span className="font-semibold">Hlavní zájmy:</span> {formData.main_interests}
                </div>
              )}
              {formData.specific_activities && (
                <div>
                  <span className="font-semibold">Specifické aktivity:</span> {formData.specific_activities}
                </div>
              )}
              {formData.accommodation_requirements && (
                <div>
                  <span className="font-semibold">Požadavky na ubytování:</span> {formData.accommodation_requirements}
                </div>
              )}
              {formData.dining_preferences && (
                <div>
                  <span className="font-semibold">Preference stravování:</span> {formData.dining_preferences}
                </div>
              )}
              {formData.organized_tours && (
                <div>
                  <span className="font-semibold">Organizované výlety:</span> {formData.organized_tours}
                </div>
              )}
            </div>
          </section>

          {/* Additional Information */}
          <section className="mb-8 print:mb-6 print:break-inside-avoid">
            <h2 className="text-2xl font-bold text-green-700 mb-4 pb-2 border-b-2 border-green-200 print:text-xl">
              Dodatečné informace
            </h2>
            <div className="space-y-3 text-gray-800">
              {formData.health_restrictions && (
                <div>
                  <span className="font-semibold">Zdravotní omezení:</span> {formData.health_restrictions}
                </div>
              )}
              {formData.travel_with_pet && (
                <div>
                  <span className="font-semibold">Cestování s mazlíčkem:</span> {formData.travel_with_pet}
                </div>
              )}
              {formData.additional_info && (
                <div>
                  <span className="font-semibold">Dodatečné informace:</span> {formData.additional_info}
                </div>
              )}
            </div>
          </section>

          {/* Footer */}
          <footer className="mt-12 pt-6 border-t border-gray-200 text-center text-sm text-gray-500 print:mt-8">
            <p>Vygenerováno aplikací Cesty bez mapy - www.cestybezmapy.cz</p>
          </footer>
        </div>
      </main>
    </Layout>
  );
};

export default CustomItineraryPreview;
