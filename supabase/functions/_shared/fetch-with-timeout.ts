/**
 * fetch() with a hard deadline. Without this, a slow/rate-limited upstream
 * (Gemini, the astrology API) holds the edge function invocation open until
 * the platform's own timeout -- under concurrent load that ties up function
 * instances and DB connections for far longer than the request actually
 * needs, instead of failing fast so callers can fall back (moderation fails
 * open to SAFE, icebreaker falls back to a static line, etc).
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
