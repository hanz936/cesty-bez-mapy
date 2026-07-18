import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sentry/react', () => ({ addBreadcrumb: vi.fn() }));

import logger from './logger';
import * as Sentry from '@sentry/react';

describe('logger → Sentry breadcrumbs (kvíz plán Task 0)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('warn: console.warn (dev/test větev) + breadcrumb level warning, jen message', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    logger.warn('Pozor na tohle', { detail: 1 });
    expect(consoleSpy).toHaveBeenCalledWith('Pozor na tohle', { detail: 1 });
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'logger',
      level: 'warning',
      message: 'Pozor na tohle',
    });
    consoleSpy.mockRestore();
  });

  it('error: console.error (dev/test větev) + breadcrumb level error, jen message', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logger.error('Načtení selhalo', new Error('boom'));
    expect(consoleSpy).toHaveBeenCalled();
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'logger',
      level: 'error',
      message: 'Načtení selhalo',
    });
    consoleSpy.mockRestore();
  });

  it('info a debug breadcrumb nepřidávají', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    logger.info('jen info');
    logger.debug('jen debug');
    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
    logSpy.mockRestore();
    debugSpy.mockRestore();
  });
});
