import { useEffect, useState } from 'react';
import { lookupIco } from '../../utils/ares.js';
import { isValidIco } from '../../utils/ico.js';

export function BillingForm({ value, onChange }) {
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
    } catch {
      // ARES outage — leave fields editable, no error blocks payment
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
