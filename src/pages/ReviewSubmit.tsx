import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { getReviewRequest, submitReview } from '../lib/reviews';
import type { ReviewRequestContext, ReviewRequestProduct } from '../lib/reviews';
import { REVIEWS_DISCLOSURE } from '../components/reviews/disclosure';
import { ROUTES } from '../constants';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_token: 'Odkaz není platný. Zkontroluj, že jsi jej zkopíroval/a celý z e-mailu.',
  not_found: 'Odkaz není platný. Zkontroluj, že jsi jej zkopíroval/a celý z e-mailu.',
  expired: 'Platnost odkazu už bohužel vypršela.',
  order_not_completed: 'K této objednávce nelze recenzi vložit.',
  rate_limited: 'Příliš mnoho pokusů — zkus to prosím za chvíli.',
  request_failed: 'Něco se pokazilo. Zkus to prosím znovu, nebo mi napiš na cestybezmapy@gmail.com.',
};

const MIN_TEXT = 10;
const MAX_TEXT = 2000;

interface ProductFormState {
  rating: number;
  text: string;
  submitting: boolean;
  submitted: boolean;
  error: string | null;
}

const StarPicker = ({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled: boolean }) => (
  <div className="flex gap-1" role="radiogroup" aria-label="Hodnocení">
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        role="radio"
        aria-checked={value === star}
        aria-label={`${star} z 5 hvězdiček`}
        disabled={disabled}
        onClick={() => onChange(star)}
        className="p-1 disabled:opacity-50"
      >
        <svg
          className={`w-8 h-8 ${star <= value ? 'text-green-800' : 'text-gray-300'} transition-colors`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      </button>
    ))}
  </div>
);

const ReviewSubmit = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [context, setContext] = useState<ReviewRequestContext | null>(null);
  const [reviewerName, setReviewerName] = useState('');
  const [forms, setForms] = useState<Record<string, ProductFormState>>({});

  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (!token) {
        setLoadError(ERROR_MESSAGES.invalid_token);
        setLoading(false);
        return;
      }
      const result = await getReviewRequest(token);
      if (!isMounted) return;
      if (!result.ok) {
        setLoadError(ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.request_failed);
      } else {
        setContext(result.data);
        setReviewerName(result.data.customer_name ?? '');
        setForms(
          Object.fromEntries(
            result.data.products.map((p) => [
              p.product_id,
              { rating: 0, text: '', submitting: false, submitted: p.already_reviewed, error: null },
            ]),
          ),
        );
      }
      setLoading(false);
    }
    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- fire-and-forget load v useEffect (vzor ProductDetail)
    load();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const updateForm = useCallback((productId: string, patch: Partial<ProductFormState>) => {
    setForms((prev) => ({ ...prev, [productId]: { ...prev[productId], ...patch } }));
  }, []);

  const handleSubmit = useCallback(
    async (product: ReviewRequestProduct) => {
      const form = forms[product.product_id];
      const name = reviewerName.trim();
      if (form.rating < 1) {
        updateForm(product.product_id, { error: 'Vyber prosím počet hvězdiček.' });
        return;
      }
      if (form.text.trim().length < MIN_TEXT) {
        updateForm(product.product_id, { error: `Text recenze musí mít alespoň ${MIN_TEXT} znaků.` });
        return;
      }
      if (name.length < 1 || name.length > 100) {
        updateForm(product.product_id, { error: 'Vyplň prosím jméno (max 100 znaků).' });
        return;
      }
      updateForm(product.product_id, { submitting: true, error: null });
      const result = await submitReview({
        token,
        product_id: product.product_id,
        rating: form.rating,
        review_text: form.text.trim(),
        reviewer_name: name,
      });
      if (result.ok) {
        updateForm(product.product_id, { submitting: false, submitted: true });
      } else {
        updateForm(product.product_id, {
          submitting: false,
          error:
            result.error === 'already_reviewed'
              ? 'Tento produkt jsi už ohodnotil/a — díky!'
              : (ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.request_failed),
        });
      }
    },
    [forms, reviewerName, token, updateForm],
  );

  return (
    <Layout ready>
      <main className="max-w-3xl mx-auto px-5 py-16" role="main">
        <h1 className="text-3xl font-bold text-green-800 mb-4">Napsat recenzi</h1>

        {loading && <p className="text-gray-600">Načítám…</p>}

        {!loading && loadError && (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <p className="text-gray-700 mb-6">{loadError}</p>
            <Link to={ROUTES.TRAVEL_GUIDES} className="text-green-800 font-medium underline">
              Zpět na průvodce
            </Link>
          </div>
        )}

        {!loading && context && (
          <>
            <p className="text-gray-600 mb-2">
              Díky, že si najdeš chvilku! Tvoje recenze bude po kontrole zveřejněna se jménem uvedeným níže.
            </p>
            <p className="text-sm text-gray-500 mb-8">{REVIEWS_DISCLOSURE}</p>

            <label className="block mb-8">
              <span className="text-sm font-medium text-gray-700">Tvoje jméno (bude zveřejněno)</span>
              <input
                type="text"
                value={reviewerName}
                maxLength={100}
                onChange={(e) => setReviewerName(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-green-800 focus:outline-none"
              />
            </label>

            <div className="space-y-8">
              {context.products.map((product) => {
                const form = forms[product.product_id];
                return (
                  <section
                    key={product.product_id}
                    aria-label={`Recenze: ${product.title}`}
                    className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100"
                  >
                    <h2 className="text-xl font-bold text-gray-900 mb-4">{product.title}</h2>
                    {form.submitted ? (
                      <p className="text-green-800 font-medium">
                        ✓ Recenze odeslána — po schválení se objeví na webu. Díky!
                      </p>
                    ) : (
                      <>
                        <StarPicker
                          value={form.rating}
                          onChange={(v) => updateForm(product.product_id, { rating: v, error: null })}
                          disabled={form.submitting}
                        />
                        <textarea
                          value={form.text}
                          maxLength={MAX_TEXT}
                          rows={5}
                          placeholder="Jak se ti s průvodcem cestovalo? Co ti nejvíc pomohlo?"
                          onChange={(e) => updateForm(product.product_id, { text: e.target.value, error: null })}
                          className="mt-4 block w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-green-800 focus:outline-none"
                        />
                        <div className="mt-1 text-xs text-gray-400 text-right">
                          {form.text.trim().length}/{MAX_TEXT} (min. {MIN_TEXT})
                        </div>
                        {form.error && <p className="mt-2 text-sm text-red-600">{form.error}</p>}
                        <button
                          type="button"
                          onClick={() => {
                            // eslint-disable-next-line @typescript-eslint/no-floating-promises -- fire-and-forget submit handler
                            handleSubmit(product);
                          }}
                          disabled={form.submitting}
                          className="mt-4 bg-green-800 hover:bg-green-900 text-white px-8 py-3 rounded-2xl font-medium transition-all duration-300 disabled:opacity-50"
                        >
                          {form.submitting ? 'Odesílám…' : 'Odeslat recenzi'}
                        </button>
                      </>
                    )}
                  </section>
                );
              })}
            </div>
          </>
        )}
      </main>
    </Layout>
  );
};

ReviewSubmit.displayName = 'ReviewSubmit';

export default ReviewSubmit;
