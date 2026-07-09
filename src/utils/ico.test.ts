import { describe, it, expect } from 'vitest';
import { isValidIco } from './ico.js';

describe('isValidIco', () => {
  it('accepts valid IČOs (real entities)', () => {
    expect(isValidIco('27082440')).toBe(true); // Seznam.cz
    expect(isValidIco('00006947')).toBe(true);
  });
  it('rejects bad checksum', () => {
    expect(isValidIco('12345678')).toBe(false);
    expect(isValidIco('00000000')).toBe(false);
  });
  it('rejects malformed input', () => {
    expect(isValidIco('')).toBe(false);
    expect(isValidIco('1234567')).toBe(false);
    expect(isValidIco('123456789')).toBe(false);
    expect(isValidIco('abcdefgh')).toBe(false);
    expect(isValidIco('12 345 678')).toBe(false);
    expect(isValidIco(null)).toBe(false);
    expect(isValidIco(undefined)).toBe(false);
  });
});
