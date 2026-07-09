import { describe, it, expect } from 'vitest';
import { sanitizeUmamiPayload } from './umamiBeforeSend';

describe('sanitizeUmamiPayload', () => {
  it('strips session_id from the url', () => {
    const out = sanitizeUmamiPayload('event', {
      url: '/cestovni-pruvodci/objednavka/potvrzeni?session_id=cs_test_123',
    });
    expect(out!.url).toBe('/cestovni-pruvodci/objednavka/potvrzeni');
  });

  it('strips token but keeps utm params', () => {
    const out = sanitizeUmamiPayload('event', { url: '/x?utm_source=instagram&token=abc' });
    expect(out!.url).toBe('/x?utm_source=instagram');
  });

  it('leaves a url without query untouched', () => {
    const out = sanitizeUmamiPayload('event', { url: '/cestovni-pruvodci' });
    expect(out!.url).toBe('/cestovni-pruvodci');
  });

  it('returns the payload even when there is no url', () => {
    const payload = { foo: 1 };
    expect(sanitizeUmamiPayload('event', payload)).toBe(payload);
  });
});
