// ================================================
// Order Confirmation Page
// ================================================
// Zobrazuje potvrzení objednávky a download linky pro PDF
// - Načte objednávku podle session_id
// - Zobrazí download tlačítka pro každé PDF
// - Vyprázdní košík
// ================================================

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { Button } from '../components/ui';
import { ROUTES } from '../constants';
import { useCart } from '../contexts';
import { supabase } from '../lib/supabase';

// Komponenta pro položku objednávky
const OrderItem = React.memo(({ item, onDownload, isDownloading }) => {
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
        {item.duration && (
          <p className="text-xs text-gray-600 mb-2">
            📅 {item.duration}
          </p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-green-800">
            {item.price?.toLocaleString()} Kč
          </span>
          {item.has_pdf && onDownload && (
            <button
              onClick={() => onDownload(item.id)}
              disabled={isDownloading}
              className="text-xs text-green-700 hover:text-green-800 font-medium flex items-center disabled:opacity-50"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Stáhnout PDF
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

OrderItem.displayName = 'OrderItem';

// Loading komponenta
const LoadingState = () => (
  <Layout>
    <main className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center px-4">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-700 mb-4"></div>
        <h2 className="text-xl font-bold text-black mb-2">Ověřujeme platbu...</h2>
        <p className="text-gray-600">Trvá to jen chvilku.</p>
      </div>
    </main>
  </Layout>
);

// Error komponenta
const ErrorState = ({ message, onRetry }) => (
  <Layout>
    <main className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center px-4 max-w-md">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-black mb-2">Něco se pokazilo</h2>
        <p className="text-gray-600 mb-6">{message}</p>
        <Button onClick={onRetry} variant="green" size="md">
          Zkusit znovu
        </Button>
      </div>
    </main>
  </Layout>
);

const OrderConfirmation = React.memo(() => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();

  const [order, setOrder] = useState(null);
  const [downloadToken, setDownloadToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const pollingRef = useRef(null);
  const cartClearedRef = useRef(false);

  const sessionId = searchParams.get('session_id');

  // Načtení objednávky z Edge Function
  const fetchOrder = useCallback(async () => {
    if (!sessionId) {
      setError('Chybí identifikátor platby');
      setLoading(false);
      return true;
    }

    try {
      const { data, error: fnError } = await supabase.functions.invoke('get-order-by-session', {
        body: { session_id: sessionId },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Nepodařilo se načíst objednávku');
      }

      if (data.status === 'pending') {
        setError('Platba ještě nebyla dokončena. Zkuste obnovit stránku.');
        setLoading(false);
        return true;
      }

      if (data.status === 'processing') {
        // Webhook ještě nezpracoval - pokračujeme v pollingu
        return false;
      }

      if (data.status === 'completed' && data.order) {
        setOrder(data.order);
        setDownloadToken(data.download_token);
        setLoading(false);

        // Vyprázdnit košík (jen jednou)
        if (!cartClearedRef.current) {
          clearCart();
          cartClearedRef.current = true;
        }

        return true;
      }

      throw new Error('Neočekávaná odpověď od serveru');
    } catch (err) {
      console.error('Error fetching order:', err);
      setError(err.message || 'Nepodařilo se načíst objednávku');
      setLoading(false);
      return true;
    }
  }, [sessionId, clearCart]);

  // Polling pro čekání na webhook
  useEffect(() => {
    if (!sessionId) {
      setError('Chybí identifikátor platby. Zkontrolujte URL.');
      setLoading(false);
      return;
    }

    let attempts = 0;
    const maxAttempts = 30;

    const poll = async () => {
      const done = await fetchOrder();
      attempts++;

      if (!done && attempts < maxAttempts) {
        pollingRef.current = setTimeout(poll, 1000);
      } else if (attempts >= maxAttempts && !order) {
        setError('Zpracování objednávky trvá déle než obvykle. Kontaktujte nás prosím.');
        setLoading(false);
      }
    };

    poll();

    return () => {
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Automatické scroll na vrchol
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Stažení PDF
  const handleDownload = useCallback(async (productId) => {
    if (!downloadToken) {
      setError('Download token není dostupný');
      return;
    }

    setIsDownloading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('get-download-url', {
        body: { token: downloadToken },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Nepodařilo se získat odkaz ke stažení');
      }

      if (data.downloads) {
        const download = data.downloads.find(d => d.product_id === productId);
        if (download) {
          window.open(download.download_url, '_blank');
        }
      }
    } catch (err) {
      console.error('Download error:', err);
      setError(err.message || 'Nepodařilo se stáhnout soubor');
    } finally {
      setIsDownloading(false);
    }
  }, [downloadToken]);

  // Stažení všech PDF
  const handleDownloadAll = useCallback(async () => {
    if (!downloadToken) {
      setError('Download token není dostupný');
      return;
    }

    setIsDownloading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('get-download-url', {
        body: { token: downloadToken },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Nepodařilo se získat odkazy ke stažení');
      }

      if (data.downloads && data.downloads.length > 0) {
        for (const download of data.downloads) {
          window.open(download.download_url, '_blank');
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } catch (err) {
      console.error('Download error:', err);
      setError(err.message || 'Nepodařilo se stáhnout soubory');
    } finally {
      setIsDownloading(false);
    }
  }, [downloadToken]);

  const handleContinueShopping = useCallback(() => {
    navigate(ROUTES.TRAVEL_GUIDES);
  }, [navigate]);

  const handleRetry = useCallback(() => {
    setError(null);
    setLoading(true);
    fetchOrder();
  }, [fetchOrder]);

  // Loading state
  if (loading) {
    return <LoadingState />;
  }

  // Error state
  if (error && !order) {
    return <ErrorState message={error} onRetry={handleRetry} />;
  }

  // Formátování data
  const orderDate = order?.created_at
    ? new Date(order.created_at).toLocaleDateString('cs-CZ', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : new Date().toLocaleDateString('cs-CZ', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

  // Počet PDF ke stažení
  const pdfCount = order?.items?.filter(item => item.has_pdf).length || 0;

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
              Ahoj {order?.customer_name?.split(' ')[0] || 'cestovateli'}! Tvá objednávka byla úspěšně zpracována.
            </p>

            <p className="text-base text-gray-600 mb-8">
              Potvrzení jsme ti poslali na e-mail {order?.customer_email}.
            </p>

            {/* Order ID */}
            <div className="inline-flex items-center bg-green-50 border border-green-200 rounded-lg px-4 py-2 mb-8">
              <span className="text-sm text-gray-600 mr-2">ID objednávky:</span>
              <span className="font-mono text-sm font-bold text-green-800">{order?.id?.substring(0, 8)}</span>
            </div>

            {/* Download CTA */}
            {pdfCount > 0 && downloadToken && (
              <div className="mt-4">
                <Button
                  onClick={handleDownloadAll}
                  variant="green"
                  size="lg"
                  disabled={isDownloading}
                  className="px-8"
                >
                  {isDownloading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Stahuji...
                    </div>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Stáhnout {pdfCount === 1 ? 'průvodce' : 'průvodce'} ({pdfCount})
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-500 mt-2">
                  Odkaz je platný 7 dní od nákupu
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Order Details Section */}
        <section className="pb-12 lg:pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">

              {/* Left - Download Info */}
              <div className="card-base p-6 lg:p-8">
                <h2 className="text-xl font-bold text-green-800 mb-6">
                  Tvé průvodce
                </h2>

                {pdfCount > 0 ? (
                  <>
                    <div className="flex items-center gap-3 p-4 mb-6 bg-green-50 border border-green-200 rounded-lg">
                      <svg className="w-6 h-6 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-green-800">
                        Tvé PDF průvodce jsou připraveny ke stažení!
                      </p>
                    </div>

                    <div className="space-y-4">
                      {order?.items?.filter(item => item.has_pdf).map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <span className="text-sm font-medium text-black">{item.title}</span>
                          </div>
                          <button
                            onClick={() => handleDownload(item.id)}
                            disabled={isDownloading}
                            className="text-green-700 hover:text-green-800 disabled:opacity-50"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-gray-600">
                    Tvá objednávka neobsahuje žádné PDF soubory ke stažení.
                  </p>
                )}

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
                    cestybezmapy@gmail.com
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
                    <span>{orderDate}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>E-mail:</span>
                    <span>{order?.customer_email}</span>
                  </div>
                </div>

                {/* Order Items */}
                <div className="space-y-1 mb-6">
                  {order?.items?.map((item) => (
                    <OrderItem
                      key={item.id}
                      item={item}
                      onDownload={item.has_pdf ? handleDownload : null}
                      isDownloading={isDownloading}
                    />
                  ))}
                </div>

                {/* Total */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex justify-between text-lg font-bold text-black mb-2">
                    <span>Celkem zaplaceno:</span>
                    <span className="text-green-800">{order?.total_amount?.toLocaleString()} Kč</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12">
              <Button
                onClick={handleContinueShopping}
                variant="secondary"
                size="lg"
                className="px-8"
              >
                Prozkoumat další průvodce
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
