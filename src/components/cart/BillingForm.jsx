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

  return (
    <div className="billing-form">
      <label>
        <input
          type="checkbox"
          checked={!!value.is_company}
          onChange={(e) => update({ is_company: e.target.checked })}
        />
        Koupit na firmu (chci fakturu)
      </label>

      {value.is_company && (
        <div className="billing-fields">
          <label>
            IČO *
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{8}"
              value={icoInput}
              onChange={(e) => { setIcoInput(e.target.value); update({ company_ico: e.target.value }); }}
              onBlur={handleIcoBlur}
              required
            />
            {loading && <span className="hint">Načítám z ARES…</span>}
            {icoError && <span className="error">{icoError}</span>}
          </label>
          <label>
            Název firmy *
            <input
              type="text"
              value={value.company_name ?? ''}
              onChange={(e) => update({ company_name: e.target.value })}
              required
            />
          </label>
          <label>
            DIČ
            <input
              type="text"
              value={value.company_dic ?? ''}
              onChange={(e) => update({ company_dic: e.target.value })}
            />
          </label>
          <label>
            Ulice a č.p. *
            <input
              type="text"
              value={value.billing_street ?? ''}
              onChange={(e) => update({ billing_street: e.target.value })}
              required
            />
          </label>
          <label>
            Město *
            <input
              type="text"
              value={value.billing_city ?? ''}
              onChange={(e) => update({ billing_city: e.target.value })}
              required
            />
          </label>
          <label>
            PSČ *
            <input
              type="text"
              inputMode="numeric"
              value={value.billing_zip ?? ''}
              onChange={(e) => update({ billing_zip: e.target.value })}
              required
            />
          </label>
        </div>
      )}
    </div>
  );
}
