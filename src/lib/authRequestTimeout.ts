export const AUTH_REQUEST_TIMEOUT_MS = 15_000;

// Only /auth/v1/ is limited: PostgREST, Storage and Edge Functions may legitimately take long.
export function createAuthTimeoutFetch(timeoutMs: number): typeof fetch {
  return (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    let pathname: string;
    try {
      pathname = new URL(url).pathname;
    } catch {
      // Unparsable (e.g. relative) URL: let fetch resolve or reject it itself.
      return globalThis.fetch(input, init);
    }
    if (!pathname.startsWith('/auth/v1/')) {
      return globalThis.fetch(input, init);
    }

    const callerSignal =
      init?.signal ?? (input instanceof Request ? input.signal : null);
    // Old browsers without these APIs get the request unchanged, with no limit.
    if (
      typeof AbortSignal.timeout !== 'function' ||
      (callerSignal && typeof AbortSignal.any !== 'function')
    ) {
      return globalThis.fetch(input, init);
    }

    const timeout = AbortSignal.timeout(timeoutMs);
    return globalThis.fetch(input, {
      ...init,
      signal: callerSignal ? AbortSignal.any([callerSignal, timeout]) : timeout,
    });
  };
}
