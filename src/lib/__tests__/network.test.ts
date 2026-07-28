import { withTimeout, fetchWithTimeout, invokeSupabaseFunctionWithTimeout } from '../network';

describe('withTimeout', () => {
  it('resolves with the underlying promise value when it settles first', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000)).resolves.toBe('ok');
  });

  it('rejects with the underlying rejection when it settles first', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000)).rejects.toThrow('boom');
  });

  it('rejects with a timeout error when the promise never settles in time', async () => {
    jest.useFakeTimers();
    const neverResolves = new Promise(() => {});
    const result = withTimeout(neverResolves, 5000, 'custom timeout message');

    // Attach the rejection expectation before advancing timers so the
    // rejection is observed instead of becoming an unhandled rejection.
    const expectation = expect(result).rejects.toThrow('custom timeout message');
    jest.advanceTimersByTime(5000);
    await expectation;
    jest.useRealTimers();
  });

  it('uses the default timeout message when none is provided', async () => {
    jest.useFakeTimers();
    const neverResolves = new Promise(() => {});
    const result = withTimeout(neverResolves, 1000);
    const expectation = expect(result).rejects.toThrow('Request timed out');
    jest.advanceTimersByTime(1000);
    await expectation;
    jest.useRealTimers();
  });
});

describe('fetchWithTimeout', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('returns the response when fetch resolves before the timeout', async () => {
    const fakeResponse = { ok: true } as Response;
    globalThis.fetch = jest.fn().mockResolvedValue(fakeResponse);

    const result = await fetchWithTimeout('https://example.com', {}, 1000);
    expect(result).toBe(fakeResponse);
  });

  it('aborts the request and throws a timeout error when fetch takes too long', async () => {
    jest.useFakeTimers();
    globalThis.fetch = jest.fn((_url: string, options: RequestInit) => {
      return new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    }) as unknown as typeof fetch;

    const result = fetchWithTimeout('https://example.com', {}, 1000);
    const expectation = expect(result).rejects.toThrow('Request timed out');
    jest.advanceTimersByTime(1000);
    await expectation;
  });

  it('propagates non-abort errors unchanged', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('network down'));
    await expect(fetchWithTimeout('https://example.com', {}, 1000)).rejects.toThrow('network down');
  });
});

describe('invokeSupabaseFunctionWithTimeout', () => {
  it('resolves with the invoked function result', async () => {
    const result = await invokeSupabaseFunctionWithTimeout(() => Promise.resolve({ data: 42 }), 1000);
    expect(result).toEqual({ data: 42 });
  });

  it('times out with a Supabase-specific message', async () => {
    jest.useFakeTimers();
    const result = invokeSupabaseFunctionWithTimeout(() => new Promise(() => {}), 5000);
    const expectation = expect(result).rejects.toThrow('Supabase function request timed out');
    jest.advanceTimersByTime(5000);
    await expectation;
    jest.useRealTimers();
  });
});
