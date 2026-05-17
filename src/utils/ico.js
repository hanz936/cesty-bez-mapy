// ico.js
// IČO mod-11 checksum validation. Mirrors Edge Function ares.ts.
// Formula: check digit = (11 - (sum % 11)) % 10. The outer % 10 cleanly
// handles all boundary cases (remainder 0 → 1; remainder 1 → 0).

export function isValidIco(ico) {
  if (typeof ico !== 'string' || !/^\d{8}$/.test(ico)) return false;
  const weights = [8, 7, 6, 5, 4, 3, 2];
  const digits = ico.split('').map(Number);
  const sum = weights.reduce((acc, w, i) => acc + w * digits[i], 0);
  const expected = (11 - (sum % 11)) % 10;
  return digits[7] === expected;
}
