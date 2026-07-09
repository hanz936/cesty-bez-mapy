import { describe, it, expect } from 'vitest';
import { PUBLIC_PAGES } from './publicRoutes';
import { ROUTES } from './routes';

describe('PUBLIC_PAGES', () => {
  it('má unikátní cesty, každá s neprázdným title a description', () => {
    const paths = PUBLIC_PAGES.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of PUBLIC_PAGES) {
      expect(p.path.startsWith('/')).toBe(true);
      expect(p.title.trim().length).toBeGreaterThan(0);
      expect(p.description.trim().length).toBeGreaterThan(0);
    }
  });
  it('NEobsahuje transakční/soukromé routy', () => {
    const paths = PUBLIC_PAGES.map((p) => p.path);
    expect(paths).not.toContain(ROUTES.CHECKOUT);
    expect(paths).not.toContain(ROUTES.ORDER_CONFIRMATION);
    expect(paths).not.toContain(ROUTES.DOWNLOAD);
    expect(paths).not.toContain(ROUTES.CUSTOM_ITINERARY_FORM);
  });
});
