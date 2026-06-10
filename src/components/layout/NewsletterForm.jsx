import { useState, useCallback } from 'react';
import TurnstileField from '../ui/TurnstileField';
import logger from '../../utils/logger';

const PRIVACY_POLICY_VERSION = '2026-06-01';

const NewsletterForm = () => {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState(null);
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'done' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      if (!email) {
        setErrorMsg('Zadej prosím svůj e-mail.');
        return;
      }

      if (!token) {
        setErrorMsg('Počkej prosím na bezpečnostní ověření.');
        return;
      }

      setStatus('loading');
      setErrorMsg('');

      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscribe-newsletter`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            email,
            captchaToken: token,
            privacy_policy_version: PRIVACY_POLICY_VERSION,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          logger.error('[NewsletterForm] subscribe-newsletter error', null, { status: res.status, data });

          if (res.status === 400 && data.error === 'invalid_email') {
            setErrorMsg('Neplatný e-mail. Zkontroluj adresu a zkus to znovu.');
          } else if (res.status === 400 && data.error === 'captcha_required') {
            setErrorMsg('Bezpečnostní ověření nebylo dokončeno. Obnov stránku a zkus to znovu.');
          } else if (res.status === 403) {
            setErrorMsg('Bezpečnostní ověření selhalo. Obnov stránku a zkus to znovu.');
          } else if (res.status === 503) {
            setErrorMsg('Ověření momentálně není dostupné. Zkus to za chvíli.');
          } else {
            setErrorMsg('Něco se pokazilo. Zkus to znovu.');
          }

          setStatus('error');
          return;
        }

        setStatus('done');
        setEmail('');
        setToken(null);
      } catch (err) {
        logger.error('[NewsletterForm] network error', err);
        setErrorMsg('Chyba sítě. Zkontroluj připojení a zkus to znovu.');
        setStatus('error');
      }
    },
    [email, token]
  );

  if (status === 'done') {
    return (
      <div className="text-center md:text-left">
        <h3 className="text-green-800 font-bold text-base uppercase tracking-wider mb-6">
          Novinky na e-mail
        </h3>
        <p role="status" className="text-sm text-green-800 font-medium leading-relaxed">
          Děkujeme! Zkontroluj e-mail a potvrď přihlášení k odběru.
        </p>
      </div>
    );
  }

  return (
    <div className="text-center md:text-left">
      <div className="mb-6">
        <h3 className="text-green-800 font-bold text-base uppercase tracking-wider">
          Novinky na e-mail
        </h3>
      </div>

      <form
        onSubmit={handleSubmit}
        aria-label="Přihlášení k odběru novinek"
        noValidate
      >
        <div className="mb-3">
          <label
            htmlFor="newsletter-email"
            className="block text-sm text-black mb-1 font-medium"
          >
            E-mail
          </label>
          <input
            id="newsletter-email"
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (status === 'error') {
                setStatus('idle');
                setErrorMsg('');
              }
            }}
            placeholder="tvuj@email.cz"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent bg-white text-black placeholder-gray-400"
            disabled={status === 'loading'}
          />
        </div>

        <TurnstileField
          onVerify={setToken}
          onExpire={() => setToken(null)}
          onError={() => setToken(null)}
        />

        {(status === 'error' || errorMsg) && (
          <p
            role="alert"
            className="text-red-600 text-xs mt-2 mb-2 leading-relaxed"
          >
            {errorMsg}
          </p>
        )}

        <button
          type="submit"
          disabled={status === 'loading' || !token}
          className="w-full mt-3 px-4 py-2 text-sm font-semibold text-white bg-green-800 rounded-lg hover:bg-green-700 transition-colors duration-300 motion-reduce:transition-none disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none supports-hover:focus-visible:ring-2 supports-hover:focus-visible:ring-green-600 supports-hover:focus-visible:ring-offset-2"
        >
          {status === 'loading' ? (
            <span className="flex items-center justify-center gap-2">
              <span
                className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              Přihlašuji...
            </span>
          ) : (
            'Přihlásit se k odběru'
          )}
        </button>

        <p className="text-xs text-gray-500 mt-3 leading-relaxed">
          Přihlášením souhlasíte se zpracováním e-mailu pro zasílání novinek.
          Odhlásit se můžete kdykoli.{' '}
          <a
            href="#soukromi"
            className="text-green-700 hover:text-green-800 underline transition-colors duration-300 motion-reduce:transition-none focus:outline-none"
          >
            Ochrana údajů
          </a>
          .
        </p>
      </form>
    </div>
  );
};

NewsletterForm.displayName = 'NewsletterForm';

export default NewsletterForm;
