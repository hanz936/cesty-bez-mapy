// ARES REST API client for IČO lookups (public, no auth).
// Reference: https://ares.gov.cz/swagger-ui/

const ARES_BASE = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty';

interface AresSidlo {
  nazevUlice?: string;
  cisloDomovni?: string;
  cisloOrientacni?: string;
  nazevObce?: string;
  psc?: string;
}

interface AresEconomicSubject {
  obchodniJmeno?: string;
  dic?: string;
  sidlo?: AresSidlo;
}

export interface IcoLookupResult {
  name: string;
  dic: string;
  street: string;
  city: string;
  zip: string;
}

function formatStreet(sidlo: AresSidlo | undefined): string {
  if (!sidlo) return '';
  const street = sidlo.nazevUlice ?? '';
  const cd = sidlo.cisloDomovni ?? '';
  const co = sidlo.cisloOrientacni ?? '';
  let num = cd;
  if (co) num = cd ? `${cd}/${co}` : co;
  return [street, num].filter(Boolean).join(' ').trim();
}

export async function lookupIco(ico: string): Promise<IcoLookupResult | null> {
  const res = await fetch(`${ARES_BASE}/${encodeURIComponent(ico)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`ARES returned ${res.status}`);
  // ARES has no published TS/OpenAPI types; the REST response is asserted to
  // the subset of fields this module reads (no runtime shape change).
  const data = (await res.json()) as AresEconomicSubject;
  return {
    name: data.obchodniJmeno ?? '',
    dic: data.dic ?? '',
    street: formatStreet(data.sidlo),
    city: data.sidlo?.nazevObce ?? '',
    zip: data.sidlo?.psc ?? '',
  };
}
