/**
 * Resilient fetch with retries for transient failures.
 *
 * Retries network-level errors (`TypeError: fetch failed`, DNS failures,
 * refused connections) and optionally idempotent-safe HTTP statuses
 * (502/503/504). AbortErrors are never retried.
 *
 * NOTE: retries re-send the request, so the body must be re-sendable
 * (string, URLSearchParams, …). Callers with one-shot or non-idempotent
 * requests (e.g. submitting a render job) should pass `retryOnStatuses: []`.
 */

export interface FetchRetryOptions {
  /** Extra attempts after the first try. Default 2. */
  retries?: number;
  /** Base backoff delay in ms. Default 800. */
  initialDelayMs?: number;
  /** Backoff multiplier per attempt. Default 2. */
  backoffFactor?: number;
  /** HTTP statuses worth retrying. Default [502, 503, 504]. */
  retryOnStatuses?: number[];
}

const DEFAULT_RETRY_STATUSES = [502, 503, 504];

function delay(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError'))
  );
}

export async function fetchWithRetry(
  input: string | URL | Request,
  init?: RequestInit,
  options?: FetchRetryOptions,
): Promise<Response> {
  const retries = options?.retries ?? 2;
  const initialDelayMs = options?.initialDelayMs ?? 800;
  const backoffFactor = options?.backoffFactor ?? 2;
  const retryOnStatuses = options?.retryOnStatuses ?? DEFAULT_RETRY_STATUSES;

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(input, init);
      if (attempt < retries && retryOnStatuses.includes(response.status)) {
        await delay(initialDelayMs * Math.pow(backoffFactor, attempt), init?.signal);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (isAbortError(error) || init?.signal?.aborted) throw error;
      // Only network-level failures are retried — anything else (e.g. a
      // malformed request) surfaces immediately.
      if (attempt < retries && error instanceof TypeError) {
        await delay(initialDelayMs * Math.pow(backoffFactor, attempt), init?.signal);
        continue;
      }
      throw error;
    }
  }
  throw lastError ?? new Error('Fetch failed after retries.');
}

/**
 * Human-friendly message for a fetch-level failure reaching a backend.
 * Turns raw `TypeError: fetch failed` into something actionable.
 */
export function friendlyFetchError(error: unknown, backendUrl: string): string {
  if (error instanceof TypeError) {
    return (
      `Cannot reach the backend at ${backendUrl} (${error.message || 'fetch failed'}). ` +
      'Check that the server is running and the Backend URL is correct.'
    );
  }
  return error instanceof Error ? error.message : 'Request failed.';
}
