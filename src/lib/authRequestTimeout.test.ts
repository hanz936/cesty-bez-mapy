// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUTH_REQUEST_TIMEOUT_MS,
  createAuthTimeoutFetch,
} from './authRequestTimeout';

const BASE = 'https://test.supabase.co';

const hangingStub = () =>
  vi.fn<typeof fetch>(
    (_input, init) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () =>
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- forwards the abort reason as fetch does
          reject(init.signal!.reason),
        );
      }),
  );
const resolvingStub = () =>
  vi.fn<typeof fetch>(() =>
    Promise.resolve(new Response('{}', { status: 200 })),
  );

const originalTimeout = Object.getOwnPropertyDescriptor(
  AbortSignal,
  'timeout',
)!;
const originalAny = Object.getOwnPropertyDescriptor(AbortSignal, 'any')!;

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(AbortSignal, 'timeout', originalTimeout);
  Object.defineProperty(AbortSignal, 'any', originalAny);
});

const missing = { value: undefined, configurable: true, writable: true };

describe('createAuthTimeoutFetch', () => {
  it('adds a time limit to auth requests', async () => {
    const stub = hangingStub();
    vi.stubGlobal('fetch', stub);
    const f = createAuthTimeoutFetch(20);
    await expect(
      f(`${BASE}/auth/v1/user`, { method: 'GET' }),
    ).rejects.toMatchObject({
      name: 'TimeoutError',
    });
    expect(stub).toHaveBeenCalledTimes(1);
    expect(stub.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
    expect(stub.mock.calls[0][1]?.method).toBe('GET');
  });

  it('resolves normally when the auth response arrives in time', async () => {
    vi.stubGlobal('fetch', resolvingStub());
    const f = createAuthTimeoutFetch(20);
    await expect(
      f(`${BASE}/auth/v1/token?grant_type=refresh_token`, { method: 'POST' }),
    ).resolves.toBeInstanceOf(Response);
  });

  it.each([
    `${BASE}/rest/v1/products?select=id`,
    `${BASE}/storage/v1/object/products-images/a.png`,
    `${BASE}/functions/v1/create-stripe-product`,
    `${BASE}/rest/v1/x?redirect=/auth/v1/user`,
  ])('passes non-auth requests through unchanged: %s', async (url) => {
    const stub = resolvingStub();
    vi.stubGlobal('fetch', stub);
    const f = createAuthTimeoutFetch(20);
    const init = { method: 'POST' };
    await f(url, init);
    expect(stub).toHaveBeenCalledWith(url, init);
    expect(stub.mock.calls[0][1]).toBe(init);
  });

  it('passes a relative URL through unchanged', async () => {
    const stub = resolvingStub();
    vi.stubGlobal('fetch', stub);
    const f = createAuthTimeoutFetch(20);
    const init = { method: 'GET' };
    await f('/auth/v1/user', init);
    expect(stub).toHaveBeenCalledWith('/auth/v1/user', init);
    expect(stub.mock.calls[0][1]).toBe(init);
  });

  it("keeps the caller's signal", async () => {
    const stub = hangingStub();
    vi.stubGlobal('fetch', stub);
    const f = createAuthTimeoutFetch(10_000);
    const caller = new AbortController();
    const pending = f(`${BASE}/auth/v1/user`, { signal: caller.signal });
    caller.abort('stop');
    await expect(pending).rejects.toBe('stop');
    expect(stub.mock.calls[0][1]?.signal).not.toBe(caller.signal);
  });

  it('reads the URL from Request and URL inputs', async () => {
    vi.stubGlobal('fetch', hangingStub());
    const f = createAuthTimeoutFetch(20);
    await expect(
      f(new Request(`${BASE}/auth/v1/logout?scope=local`, { method: 'POST' })),
    ).rejects.toMatchObject({ name: 'TimeoutError' });
    await expect(f(new URL(`${BASE}/auth/v1/user`))).rejects.toMatchObject({
      name: 'TimeoutError',
    });
  });

  it('passes auth requests through when AbortSignal.timeout is missing', async () => {
    Object.defineProperty(AbortSignal, 'timeout', missing);
    const stub = resolvingStub();
    vi.stubGlobal('fetch', stub);
    const f = createAuthTimeoutFetch(20);
    const init = { method: 'GET' };
    await f(`${BASE}/auth/v1/user`, init);
    expect(stub.mock.calls[0][1]).toBe(init);
  });

  it('passes auth requests through when AbortSignal.any is missing and a caller signal exists', async () => {
    Object.defineProperty(AbortSignal, 'any', missing);
    const stub = resolvingStub();
    vi.stubGlobal('fetch', stub);
    const f = createAuthTimeoutFetch(20);
    const init = { signal: new AbortController().signal };
    await f(`${BASE}/auth/v1/user`, init);
    expect(stub.mock.calls[0][1]).toBe(init);
  });

  it('passes an auth Request through unchanged when AbortSignal.any is missing', async () => {
    Object.defineProperty(AbortSignal, 'any', missing);
    const stub = resolvingStub();
    vi.stubGlobal('fetch', stub);
    const f = createAuthTimeoutFetch(20);
    const request = new Request(`${BASE}/auth/v1/user`);
    await f(request);
    expect(stub.mock.calls[0][0]).toBe(request);
    expect(stub.mock.calls[0][1]).toBeUndefined();
  });

  it('uses a limit of 15 seconds', () => {
    expect(AUTH_REQUEST_TIMEOUT_MS).toBe(15_000);
  });
});
