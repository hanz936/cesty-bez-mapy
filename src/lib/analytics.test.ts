import { describe, it, expect, vi, afterEach } from 'vitest';
import { trackEvent, ANALYTICS_EVENTS } from './analytics';

afterEach(() => {
  delete window.umami;
  vi.restoreAllMocks();
});

describe('trackEvent', () => {
  it('no-ops (no throw) when window.umami is undefined', () => {
    expect(() => trackEvent('add-to-cart')).not.toThrow();
  });

  it('calls umami.track with name only when no data', () => {
    const track = vi.fn();
    window.umami = { track };
    trackEvent('itinerary-start');
    expect(track).toHaveBeenCalledWith('itinerary-start');
  });

  it('calls umami.track with name and data', () => {
    const track = vi.fn();
    window.umami = { track };
    trackEvent('purchase', { revenue: 199, currency: 'CZK', items: 2 });
    expect(track).toHaveBeenCalledWith('purchase', { revenue: 199, currency: 'CZK', items: 2 });
  });

  it('never throws if umami.track throws', () => {
    window.umami = {
      track: () => {
        throw new Error('boom');
      },
    };
    expect(() => trackEvent('purchase', { revenue: 1, currency: 'CZK' })).not.toThrow();
  });

  it('exposes kebab-case event name constants', () => {
    expect(ANALYTICS_EVENTS.PURCHASE).toBe('purchase');
    expect(ANALYTICS_EVENTS.ADD_TO_CART).toBe('add-to-cart');
  });
});
