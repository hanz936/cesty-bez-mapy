import { describe, it, expect } from 'vitest';
import { reviewCountLabel } from './reviewCountLabel';

describe('reviewCountLabel', () => {
  it('1 → recenze', () => expect(reviewCountLabel(1)).toBe('recenze'));
  it('2 až 4 → recenze', () => {
    expect(reviewCountLabel(2)).toBe('recenze');
    expect(reviewCountLabel(4)).toBe('recenze');
  });
  it('5 a víc → recenzí', () => {
    expect(reviewCountLabel(5)).toBe('recenzí');
    expect(reviewCountLabel(12)).toBe('recenzí');
    expect(reviewCountLabel(100)).toBe('recenzí');
  });
  it('0 → recenzí', () => expect(reviewCountLabel(0)).toBe('recenzí'));
});
