import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { supabase } from '../lib/supabase';

interface DownloadItem {
  product_id: string | null;
  product_title: string;
  download_url: string;
}

// get-download-url Edge Function has no published TS types on the client; the invoke()
// response is asserted to the subset of fields this component reads (no runtime shape
// change, same pattern as src/utils/ares.ts lookupIco / src/lib/blog.ts fetchPreviewPost).
// `success`/`asset_type`/`downloads`/`error` are all optional here (rather than mirroring
// the server's stricter GetDownloadResponse contract) to match the pre-existing defensive
// `data?.x` accesses below, which already assumed no guaranteed shape.
interface DownloadInvokeData {
  success?: boolean;
  asset_type?: 'product_pdf' | 'custom_itinerary_pdf';
  downloads?: DownloadItem[];
  error?: string;
}

interface DownloadReadyData {
  success: true;
  asset_type: 'product_pdf' | 'custom_itinerary_pdf';
  downloads: DownloadItem[];
}

type DownloadState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'error'; data: null; error: string }
  | { status: 'ready'; data: DownloadReadyData; error: null };

export default function Stahnout() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<DownloadState>({ status: 'loading', data: null, error: null });

  useEffect(() => {
    if (!token) {
      setState({ status: 'error', data: null, error: 'V URL chybí token. Zkontroluj odkaz v emailu.' });
      return;
    }

    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- pre-existing fire-and-forget async IIFE inside useEffect (useEffect callbacks can't be async)
    (async () => {
      try {
        const { data, error } = (await supabase.functions.invoke('get-download-url', {
          body: { token },
        })) as { data: DownloadInvokeData | null; error: { message?: string } | null };

        if (cancelled) return;

        if (error) {
          setState({
            status: 'error',
            data: null,
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string message must fall through to fallback (?? would change behavior)
            error: error.message || 'Nepodařilo se načíst odkaz ke stažení.',
          });
          return;
        }

        if (!data?.success || !data?.downloads?.length) {
          setState({
            status: 'error',
            data: null,
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string message must fall through to fallback (?? would change behavior)
            error: data?.error || 'Tento odkaz nelze použít. Pokud potřebuješ pomoc, napiš na cestybezmapy@gmail.com.',
          });
          return;
        }

        // By this point `data.success`/`data.downloads.length` have been verified truthy
        // above; TS control-flow narrowing doesn't propagate through the optional-chained
        // guard, so the already-validated shape is asserted here (no new runtime check).
        setState({ status: 'ready', data: data as DownloadReadyData, error: null });
      } catch (err) {
        if (!cancelled) {
          const fnErr = err as { message?: string } | null | undefined;
          setState({
            status: 'error',
            data: null,
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- '||' intentional: empty-string message must fall through to fallback (?? would change behavior)
            error: fnErr?.message || 'Něco se pokazilo.',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const headerByAssetType = state.data?.asset_type === 'custom_itinerary_pdf'
    ? 'Tvůj individuální itinerář'
    : 'Tvé průvodce';

  function handleDownload(url: string) {
    window.open(url, '_blank');
  }

  return (
    <Layout>
      <main className="min-h-[60vh] bg-[#f7f5f0] flex items-start justify-center px-4 py-16">
        <div className="max-w-xl w-full bg-white rounded-lg shadow-sm px-8 py-12">
          {state.status === 'loading' && (
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-green-800 mb-4"></div>
              <p className="text-gray-700">Připravuji odkaz ke stažení…</p>
            </div>
          )}

          {state.status === 'error' && (
            <div className="text-center">
              <h1 className="text-2xl font-bold text-green-900 mb-4">Něco se pokazilo</h1>
              <p className="text-gray-700 mb-4">{state.error}</p>
              <p className="text-gray-700">
                Pokud problém přetrvává, napiš na{' '}
                <a href="mailto:cestybezmapy@gmail.com" className="text-green-800 hover:text-green-900 font-medium underline">
                  cestybezmapy@gmail.com
                </a>{' '}
                — spolu to vyřešíme.
              </p>
            </div>
          )}

          {state.status === 'ready' && (
            <div className="text-center">
              <h1 className="text-2xl font-bold text-green-900 mb-4">{headerByAssetType}</h1>
              <p className="text-gray-700 mb-8">Klikni na tlačítko níže pro stažení.</p>
              <div className="flex flex-col gap-4 mb-8">
                {state.data.downloads.map((download, idx) => (
                  <button
                    key={download.product_id ?? idx}
                    type="button"
                    onClick={() => handleDownload(download.download_url)}
                    className="bg-green-800 hover:bg-green-900 text-white font-bold py-4 px-8 rounded-lg transition-colors duration-200 min-h-12 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 focus:outline-none"
                  >
                    Stáhnout: {download.product_title}
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-500">
                Odkaz funguje bez časového omezení — můžeš ho použít kdykoliv. Stahuj prosím jen pro vlastní použití.
              </p>
            </div>
          )}
        </div>
      </main>
    </Layout>
  );
}

Stahnout.displayName = 'Stahnout';
