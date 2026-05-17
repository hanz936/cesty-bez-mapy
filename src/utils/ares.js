// ARES REST API client for IČO lookups (public, no auth).
// Reference: https://ares.gov.cz/swagger-ui/

const ARES_BASE = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty';

function formatStreet(sidlo) {
  if (!sidlo) return '';
  const street = sidlo.nazevUlice ?? '';
  const cd = sidlo.cisloDomovni ?? '';
  const co = sidlo.cisloOrientacni ?? '';
  let num = cd;
  if (co) num = cd ? `${cd}/${co}` : co;
  return [street, num].filter(Boolean).join(' ').trim();
}

export async function lookupIco(ico) {
  const res = await fetch(`${ARES_BASE}/${encodeURIComponent(ico)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`ARES returned ${res.status}`);
  const data = await res.json();
  return {
    name: data.obchodniJmeno ?? '',
    dic: data.dic ?? '',
    street: formatStreet(data.sidlo),
    city: data.sidlo?.nazevObce ?? '',
    zip: data.sidlo?.psc ?? '',
  };
}
