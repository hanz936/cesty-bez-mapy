import { describe, it, expect } from 'vitest';
import { paginationItems } from './paginationItems';

describe('paginationItems', () => {
  it('do sedmi stran vypíše všechny', () => {
    expect(paginationItems(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('uprostřed dlouhé sekvence zkrátí obě strany', () => {
    expect(paginationItems(10, 30)).toEqual([1, 'gap', 9, 10, 11, 'gap', 30]);
  });

  it('na začátku zkrátí jen konec', () => {
    expect(paginationItems(2, 30)).toEqual([1, 2, 3, 'gap', 30]);
  });

  it('na konci zkrátí jen začátek', () => {
    expect(paginationItems(30, 30)).toEqual([1, 'gap', 29, 30]);
  });

  it('nikdy nevyrobí stranu mimo rozsah', () => {
    expect(paginationItems(1, 30)).toEqual([1, 2, 'gap', 30]);
  });
});
