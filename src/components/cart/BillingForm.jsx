import { useEffect, useState } from 'react';
import { lookupIco } from '../../utils/ares.js';
import { isValidIco } from '../../utils/ico.js';
import { wasBlockedByCsp } from '../../utils/cspBlocked.js';

export function BillingForm({ value, onChange, marketingConsent, setMarketingConsent }) {
  const [icoError, setIcoError] = useState('');
  const [loading, setLoading] = useState(false);
  const [icoInput, setIcoInput] = useState(value.company_ico ?? '');

  useEffect(() => {
    setIcoInput(value.company_ico ?? '');
  }, [value.company_ico]);

  function update(patch) {
    onChange({ ...value, ...patch });
  }

  async function handleIcoBlur(e) {
    const ico = e.target.value.trim();
    if (!ico) { setIcoError(''); return; }
    if (!isValidIco(ico)) {
      setIcoError('Neplatné IČO');
      return;
    }
    setIcoError('');
    setLoading(true);
    try {
      const data = await lookupIco(ico);
      if (data) {
        update({
          company_ico: ico,
          company_name: data.name,
          company_dic: data.dic,
          billing_street: data.street,
          billing_city: data.city,
          billing_zip: data.zip,
        });
      }
    } catch (err) {
      // Distinguish CSP block from real ARES outage in dev. Production behavior
      // unchanged — user can still type fields manually, payment is not blocked.
      if (import.meta.env.DEV) {
        const aresUrl = `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`;
        await new Promise((r) => setTimeout(r, 0)); // let securitypolicyviolation dispatch
        if (wasBlockedByCsp(aresUrl)) {
          console.warn('[BillingForm] ARES lookup blocked by CSP — add ares.gov.cz to connect-src');
        } else {
          console.warn('[BillingForm] ARES lookup failed:', err);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-green-700";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={!!value.is_company}
          onChange={(e) => update({ is_company: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300 text-green-700 focus:ring-green-700"
        />
        Koupit na firmu (chci fakturu)
      </label>

      {setMarketingConsent && (
        <div className="mt-4">
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={!!marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="mt-1"
            />
            <span>
              Chci dostávat novinky a tipy na cesty e-mailem (nepovinné). Odhlásit se můžete kdykoli.{' '}
              Více v <a href="#soukromi" className="underline">zásadách ochrany osobních údajů</a>.
            </span>
          </label>
        </div>
      )}

      {value.is_company && (
        <div className="mt-4 p-4 bg-gray-50 rounded-md space-y-3">
          <label className="block">
            <span className={labelClass}>IČO *</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{8}"
              value={icoInput}
              onChange={(e) => { setIcoInput(e.target.value); update({ company_ico: e.target.value }); }}
              onBlur={handleIcoBlur}
              required
              className={inputClass}
            />
            {loading && <span className="block text-xs text-gray-500 mt-1">Načítám z ARES…</span>}
            {icoError && <span className="block text-xs text-red-600 mt-1">{icoError}</span>}
          </label>
          <label className="block">
            <span className={labelClass}>Název firmy *</span>
            <input
              type="text"
              value={value.company_name ?? ''}
              onChange={(e) => update({ company_name: e.target.value })}
              required
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>DIČ</span>
            <input
              type="text"
              value={value.company_dic ?? ''}
              onChange={(e) => update({ company_dic: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Ulice a č.p. *</span>
            <input
              type="text"
              value={value.billing_street ?? ''}
              onChange={(e) => update({ billing_street: e.target.value })}
              required
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Město *</span>
            <input
              type="text"
              value={value.billing_city ?? ''}
              onChange={(e) => update({ billing_city: e.target.value })}
              required
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>PSČ *</span>
            <input
              type="text"
              inputMode="numeric"
              value={value.billing_zip ?? ''}
              onChange={(e) => update({ billing_zip: e.target.value })}
              required
              className={inputClass}
            />
          </label>
        </div>
      )}
    </div>
  );
}
