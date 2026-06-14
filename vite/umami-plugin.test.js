// @vitest-environment node
//
// This plugin imports `loadEnv` from `vite`, which pulls in esbuild. esbuild's
// internal TextEncoder/Uint8Array invariant check is incompatible with jsdom's
// globals (the project's default test environment), so this file runs under
// the plain `node` environment instead.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { umamiPlugin } from './umami-plugin.js';

const HTML = '<html><head><title>x</title></head><body></body></html>';

function resolved(plugin, { isProduction }) {
  // Minimal stand-in for Vite's ResolvedConfig.
  plugin.configResolved({ mode: isProduction ? 'production' : 'development', root: process.cwd(), isProduction });
}

describe('umamiPlugin', () => {
  beforeEach(() => { process.env.VITE_UMAMI_WEBSITE_ID = 'test-id-123'; });
  afterEach(() => { delete process.env.VITE_UMAMI_WEBSITE_ID; delete process.env.VITE_UMAMI_SRC; });

  it('injects the tracker in a production build with a website id', () => {
    const plugin = umamiPlugin();
    resolved(plugin, { isProduction: true });
    const out = plugin.transformIndexHtml(HTML);
    expect(out).toContain('data-website-id="test-id-123"');
    expect(out).toContain('data-before-send="umamiBeforeSend"');
    expect(out).toContain('window.umamiBeforeSend=');
    expect(out).toContain('data-domains="cestybezmapy.cz,www.cestybezmapy.cz"');
    expect(out).toContain('https://cloud.umami.is/script.js');
  });

  it('does nothing in a non-production build', () => {
    const plugin = umamiPlugin();
    resolved(plugin, { isProduction: false });
    expect(plugin.transformIndexHtml(HTML)).toBe(HTML);
  });

  it('does nothing when website id is missing', () => {
    delete process.env.VITE_UMAMI_WEBSITE_ID;
    const plugin = umamiPlugin();
    resolved(plugin, { isProduction: true });
    expect(plugin.transformIndexHtml(HTML)).toBe(HTML);
  });

  it('honors a custom VITE_UMAMI_SRC', () => {
    process.env.VITE_UMAMI_SRC = 'https://eu.umami.is/script.js';
    const plugin = umamiPlugin();
    resolved(plugin, { isProduction: true });
    expect(plugin.transformIndexHtml(HTML)).toContain('https://eu.umami.is/script.js');
  });
});
