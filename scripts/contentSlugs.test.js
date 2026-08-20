// @vitest-environment node
// `contentSlugs.mjs` čte `process.env.VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`
// přímo (ne přes `import.meta.env`), takže je testu musíme dodat ručně.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchProductSlugs } from './contentSlugs.mjs';

describe('fetchProductSlugs', () => {
  const originalUrl = process.env.VITE_SUPABASE_URL;
  const originalKey = process.env.VITE_SUPABASE_ANON_KEY;

  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = 'https://example.test';
    process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  afterEach(() => {
    process.env.VITE_SUPABASE_URL = originalUrl;
    process.env.VITE_SUPABASE_ANON_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  it('dotaz žádá review_count a drží filtry is_active/is_deleted', async () => {
    // Bez tohohle testu by tichá regrese selectu (revert, rebase, „úklid") nezčervenala
    // ani jeden test: `reviewPageRange` by dostávala všude `undefined`, prerender by
    // vyrobil jen strany 1 a sitemapa by nenabídla žádnou stránku recenzí.
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);

    await fetchProductSlugs();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('select=slug,review_count');
    expect(url).toContain('is_active=eq.true');
    expect(url).toContain('is_deleted=eq.false');
  });
});
