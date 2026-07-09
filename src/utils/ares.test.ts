import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { lookupIco } from './ares.js';

describe('lookupIco', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('returns parsed company data on success', async () => {
    (global.fetch as unknown as Mock).mockResolvedValueOnce({
      ok: true,
      // eslint-disable-next-line @typescript-eslint/require-await -- mock Response.json() is intentionally async (code under test awaits res.json()); byte-identical
      json: async () => ({
        obchodniJmeno: 'Seznam.cz, a.s.',
        dic: 'CZ27082440',
        sidlo: {
          nazevUlice: 'Radlická',
          cisloDomovni: '3294',
          cisloOrientacni: '10',
          nazevObce: 'Praha',
          psc: '15000',
        },
      }),
    });
    const result = await lookupIco('27082440');
    expect(result!.name).toBe('Seznam.cz, a.s.');
    expect(result!.dic).toBe('CZ27082440');
    expect(result!.street).toContain('Radlická');
    expect(result!.city).toBe('Praha');
    expect(result!.zip).toBe('15000');
  });

  it('returns null on 404', async () => {
    (global.fetch as unknown as Mock).mockResolvedValueOnce({ ok: false, status: 404 });
    const result = await lookupIco('99999999');
    expect(result).toBeNull();
  });

  it('throws on network error', async () => {
    (global.fetch as unknown as Mock).mockRejectedValueOnce(new Error('network down'));
    await expect(lookupIco('27082440')).rejects.toThrow('network down');
  });

  it('formats street with cisloOrientacni when present', async () => {
    (global.fetch as unknown as Mock).mockResolvedValueOnce({
      ok: true,
      // eslint-disable-next-line @typescript-eslint/require-await -- mock Response.json() is intentionally async (code under test awaits res.json()); byte-identical
      json: async () => ({
        obchodniJmeno: 'X',
        sidlo: { nazevUlice: 'Hlavní', cisloDomovni: '1', cisloOrientacni: '5', nazevObce: 'P', psc: '11111' },
      }),
    });
    const r = await lookupIco('27082440');
    expect(r!.street).toBe('Hlavní 1/5');
  });

  it('formats street without cisloOrientacni', async () => {
    (global.fetch as unknown as Mock).mockResolvedValueOnce({
      ok: true,
      // eslint-disable-next-line @typescript-eslint/require-await -- mock Response.json() is intentionally async (code under test awaits res.json()); byte-identical
      json: async () => ({
        obchodniJmeno: 'X',
        sidlo: { nazevUlice: 'Hlavní', cisloDomovni: '1', nazevObce: 'P', psc: '11111' },
      }),
    });
    const r = await lookupIco('27082440');
    expect(r!.street).toBe('Hlavní 1');
  });
});
