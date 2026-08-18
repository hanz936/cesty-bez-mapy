/** Časová zóna webu. Zákazníci i provoz jsou čeští, takže pražský kalendářní
 *  den je to, co je „datum recenze" — a musí být stejné ve viditelném textu
 *  i v `datePublished`, jinak markujeme přesnější údaj, než stránka ukazuje. */
const SITE_TIME_ZONE = 'Europe/Prague';

export function formatReviewDate(iso: string): string {
  return new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: SITE_TIME_ZONE,
  }).format(new Date(iso));
}

/**
 * `YYYY-MM-DD` v pražské zóně — pro `datePublished` v JSON-LD.
 * NEPOUŽÍVAT `iso.slice(0, 10)`: to je datum v UTC, takže u recenzí vzniklých
 * mezi 22:00 UTC a půlnocí ukazovalo o den míň, než měla karta vedle.
 */
export function reviewDateIso(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: SITE_TIME_ZONE,
  }).formatToParts(new Date(iso));
  const get = (type: 'year' | 'month' | 'day') => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
