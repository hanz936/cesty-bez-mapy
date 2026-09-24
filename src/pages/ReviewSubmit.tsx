import { useState, useEffect, useCallback, useRef, type KeyboardEvent } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import PageTitle from '../components/common/PageTitle';
import { getReviewRequest, submitReview } from '../lib/reviews';
import type { ReviewRequestContext, ReviewRequestProduct } from '../lib/reviews';
import { ROUTES } from '../constants';
import { StarIcon } from '../components/ui/RatingStars';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_token: 'Odkaz není platný. Zkontroluj, že jsi ho zkopíroval/a celý z e-mailu.',
  not_found: 'Odkaz není platný. Zkontroluj, že jsi ho zkopíroval/a celý z e-mailu.',
  expired: 'Platnost odkazu už bohužel vypršela.',
  order_not_completed: 'K této objednávce nelze recenzi vložit.',
  rate_limited: 'Příliš mnoho pokusů. Zkus to prosím za chvíli.',
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

const StarPicker = ({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled: boolean }) => {
  const starRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // WAI-ARIA APG radio-group pattern: šipky posouvají výběr (s wrapem přes
  // okraje) a fokus se přesouvá na nově vybrané radio; roving tabindex níže
  // nechává v tab-orderu jen jedno radio (vybrané, resp. první bez výběru).
  const selectStar = (star: number) => {
    onChange(star);
    starRefs.current[star - 1]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      selectStar(value >= 5 ? 1 : value + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      selectStar(value <= 1 ? 5 : value - 1);
    }
  };

  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Hodnocení">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          ref={(el) => {
            starRefs.current[star - 1] = el;
          }}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} z 5 hvězdiček`}
          tabIndex={star === (value || 1) ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(star)}
          onKeyDown={handleKeyDown}
          className="p-1 disabled:opacity-50"
        >
          {/* Nevybraná hvězda je obrys, ne bledá výplň: `gray-300` měla vůči bílé 1,47 : 1,
              takže před prvním klikem nebyl ovládací prvek skoro vidět (WCAG 2.2 SC 1.4.11,
              nález N-A10-2). Ztmavit výplň nejde — `gray-500` má vůči zelené vybrané hvězdě
              taky jen 1,47 : 1 a stavy by splynuly. Obrys `gray-500` má vůči bílé 4,84 : 1
              a vybranou od nevybrané odliší tvar (plná × obrys), ne jen barva. */}
          <StarIcon
            className={`w-8 h-8 transition-colors ${
              star <= value ? 'text-green-800' : 'text-gray-500 fill-none stroke-current stroke-[1.5] [stroke-linejoin:round]'
            }`}
          />
        </button>
      ))}
    </div>
  );
};

StarPicker.displayName = 'StarPicker';

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
              ? 'Tento produkt jsi už ohodnotil/a, díky!'
              : (ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.request_failed),
        });
      }
    },
    [forms, reviewerName, token, updateForm],
  );

  return (
    <Layout ready>
      <PageTitle title="Napsat recenzi" noindex />
      <div className="max-w-3xl mx-auto px-5 py-16">
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
            <p className="text-gray-600 mb-4">
              Díky, že si najdeš chvilku! Napiš pár vět o tom, jak se ti s průvodcem cestovalo. Recenze vyjde
              pod jménem, které vyplníš níže.
            </p>
            {/* Jednou pro všechny produkty v objednávce, ne u každého tlačítka „Odeslat" —
                u víc průvodců by se věta opakovala. Rozhodnutí usera 2026-09-24 (audit B-5),
                znění schvaluje Jana. Viz `disclosure.ts`. */}
            <p className="text-sm text-gray-600 mb-8">
              Co před zveřejněním kontrolujeme, popisuje stránka{' '}
              <Link to={ROUTES.REVIEWS_VERIFICATION} className="text-green-800 underline">
                Ověřování recenzí
              </Link>
              .
            </p>

            <label className="block mb-8">
              <span className="text-sm font-medium text-gray-700">Tvoje jméno (bude zveřejněno)</span>
              <input
                type="text"
                value={reviewerName}
                maxLength={100}
                onChange={(e) => setReviewerName(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-green-800 focus:outline-hidden"
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
                        ✓ Díky moc! Recenze je odeslaná.
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
                          aria-label={`Text recenze: ${product.title}`}
                          placeholder="Jak se ti s průvodcem cestovalo? Co ti nejvíc pomohlo?"
                          onChange={(e) => updateForm(product.product_id, { text: e.target.value, error: null })}
                          className="mt-4 block w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-green-800 focus:outline-hidden"
                        />
                        {/* `gray-500`, ne `gray-400`: počítadlo je text a `gray-400` má vůči bílé
                            jen 2,60 : 1 (WCAG 2.2 SC 1.4.3 chce 4,5 : 1). */}
                        <div className="mt-1 text-xs text-gray-500 text-right">
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
      </div>
    </Layout>
  );
};

ReviewSubmit.displayName = 'ReviewSubmit';

export default ReviewSubmit;
