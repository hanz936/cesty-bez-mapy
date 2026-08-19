import { describe, it, expect } from 'vitest';
import { clampPage, REVIEWS_PAGE_SIZE, PRODUCT_REVIEWS_LIMIT } from './reviews';

describe('konstanty recenzí', () => {
  it('drží dohodnuté hodnoty', () => {
    expect(REVIEWS_PAGE_SIZE).toBe(10);
    expect(PRODUCT_REVIEWS_LIMIT).toBe(3);
  });
});

describe('clampPage', () => {
  it('bez segmentu strany vrací první stranu', () => {
    expect(clampPage(undefined, 3)).toBe(1);
  });

  it('platnou stranu propustí', () => {
    expect(clampPage('2', 3)).toBe(2);
    expect(clampPage('3', 3)).toBe(3);
  });

  it('stranu nad rozsah ořízne na poslední platnou', () => {
    expect(clampPage('99', 3)).toBe(3);
    expect(clampPage('99999999999999999999', 3)).toBe(3);
  });

  it('cokoli, co není kladné celé číslo bez vodicí nuly, spadne na první stranu', () => {
    for (const raw of ['0', '-1', 'abc', '2.5', '2.0', '+2', '02', '0x2', '2e1', ' 2 ', '', '٢', 'Infinity']) {
      expect(clampPage(raw, 3)).toBe(1);
    }
  });

  it('při nule stran vrací vždy 1, aby nevznikla strana 0', () => {
    expect(clampPage('5', 0)).toBe(1);
    expect(clampPage(undefined, 0)).toBe(1);
  });
});
