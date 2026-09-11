import { PermanentError } from '../core/types.js';

export interface ApiErrorShape {
  status: number;
  body: string;
}

/**
 * Turn an HTTP failure into the right kind of error.
 *
 * The queue retries with backoff, so this decision matters: a 401 from a bad
 * token or a 400 from a missing category will fail identically on every retry
 * and should surface immediately, while a 429 or a 502 is worth another go.
 */
export function classifyHttpError(channel: string, status: number, body: string): Error {
  const snippet = body.length > 600 ? `${body.slice(0, 600)}…` : body;
  const message = `${channel} API returned ${status}: ${snippet}`;

  const retryable = status === 429 || status === 408 || status >= 500;
  return retryable ? new Error(message) : new PermanentError(message);
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  /** JSON body; mutually exclusive with `body`. */
  json?: unknown;
  body?: string | Uint8Array | FormData;
  /** Label used in error messages. */
  channel: string;
  timeoutMs?: number;
  /**
   * Cache key for the OAuth token this request uses. On a 401/403 the cached
   * token is dropped, so a revoked or rotated credential is re-fetched on the
   * next attempt instead of being served from cache until it expires.
   */
  tokenKey?: string;
}

/** fetch() with a timeout, JSON encoding, and error classification. */
export async function apiRequest<T>(url: string, opts: RequestOptions): Promise<T> {
  const { channel, timeoutMs = 60_000 } = opts;
  const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };

  let body = opts.body;
  if (opts.json !== undefined) {
    body = JSON.stringify(opts.json);
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers,
      body,
      signal: controller.signal,
    });
  } catch (err) {
    // Network-level failure (DNS, reset, timeout) -- worth retrying.
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`${channel}: request to ${new URL(url).host} failed (${reason})`);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  if (!res.ok) {
    if (opts.tokenKey && (res.status === 401 || res.status === 403)) {
      invalidateToken(opts.tokenKey);
    }
    throw classifyHttpError(channel, res.status, text);
  }

  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    // Some endpoints (eBay publish, Etsy state change) return an empty or
    // non-JSON 204; callers of those ignore the result.
    return undefined as T;
  }
}

/* -------------------------------------------------------------------------- */
/* OAuth refresh-token cache                                                  */
/* -------------------------------------------------------------------------- */

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();

/**
 * Exchange a long-lived refresh token for an access token, caching it until
 * shortly before it expires. Without this every photo upload in a multi-image
 * listing would burn another token request.
 */
export async function getAccessToken(
  key: string,
  fetchToken: () => Promise<{ access_token: string; expires_in?: number }>,
): Promise<string> {
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.accessToken;

  const result = await fetchToken();
  if (!result?.access_token) {
    throw new PermanentError(`${key}: token endpoint did not return an access_token`);
  }

  // Refresh a minute early to avoid racing the expiry.
  const ttlMs = Math.max(60, (result.expires_in ?? 7200) - 60) * 1000;
  tokenCache.set(key, { accessToken: result.access_token, expiresAt: Date.now() + ttlMs });
  return result.access_token;
}

/** Drop a cached token, e.g. after a 401, so the next call re-fetches. */
export function invalidateToken(key: string): void {
  tokenCache.delete(key);
}

/** Report which of the given env vars are unset, for the UI's setup checklist. */
export function missingEnv(...names: string[]): string[] {
  return names.filter((n) => !process.env[n] || process.env[n]!.trim() === '');
}
