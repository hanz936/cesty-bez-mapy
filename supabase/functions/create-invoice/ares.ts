// IČO mod-11 checksum validation per Czech statistical office.
// Algorithm: weights 8,7,6,5,4,3,2 applied to first 7 digits.
// Check digit = (11 - (sum % 11)) % 10.
// This naturally handles boundary cases: remainder 0 -> check digit 1; remainder 1 -> check digit 0.

export function isValidIco(ico: string): boolean {
  if (!/^\d{8}$/.test(ico)) return false;
  const weights = [8, 7, 6, 5, 4, 3, 2];
  const digits = ico.split("").map(Number);
  const sum = weights.reduce((acc, w, i) => acc + w * digits[i], 0);
  const expected = (11 - (sum % 11)) % 10;
  return digits[7] === expected;
}
