import crypto from 'node:crypto';
import type { Request } from 'express';

/**
 * Single-user authentication, using only node:crypto.
 *
 * Passwords are hashed with scrypt (memory-hard, so a leaked hash is
 * expensive to attack) and sessions are random tokens stored *hashed* in the
 * database -- a copy of reseller.db therefore doesn't hand someone a working
 * session, only useless digests.
 */

const SCRYPT_KEYLEN = 64;
/** N=2^15 keeps a single login around 100ms, which is the right trade here. */
const SCRYPT_PARAMS = { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password.normalize('NFKC'), salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/** Constant-time verify. Returns false on a malformed stored hash. */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;

  const [, saltHex, hashHex] = parts;
  if (!saltHex || !hashHex) return false;

  let expected: Buffer;
  try {
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (expected.length !== SCRYPT_KEYLEN) return false;

  const derived = crypto.scryptSync(
    password.normalize('NFKC'),
    Buffer.from(saltHex, 'hex'),
    SCRYPT_KEYLEN,
    SCRYPT_PARAMS,
  );
  return crypto.timingSafeEqual(derived, expected);
}

/* -------------------------------------------------------------------------- */
/* Session tokens                                                             */
/* -------------------------------------------------------------------------- */

export const SESSION_COOKIE = 'reseller_session';

export function newSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** What we persist. The raw token exists only in the user's cookie. */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Unguessable directory name for a product's media. */
export function newMediaToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/* -------------------------------------------------------------------------- */
/* Cookies                                                                    */
/* -------------------------------------------------------------------------- */

/** Minimal Cookie header parser -- avoids a dependency for one header. */
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;

  for (const pair of header.split(';')) {
    const eq = pair.indexOf('=');
    if (eq < 1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!name) continue;
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

export function serializeSessionCookie(
  token: string,
  maxAgeSeconds: number,
  secure: boolean,
): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    // Lax still sends the cookie on a top-level navigation, so opening the
    // handoff link from your notes app works, while blocking cross-site POSTs.
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearedSessionCookie(secure: boolean): string {
  return serializeSessionCookie('', 0, secure);
}

/* -------------------------------------------------------------------------- */
/* Login throttling                                                           */
/* -------------------------------------------------------------------------- */

interface Attempt {
  count: number;
  firstAt: number;
  blockedUntil: number;
}

const attempts = new Map<string, Attempt>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const BLOCK_MS = 15 * 60 * 1000;

export function clientKey(req: Request): string {
  // Behind Cloudflare/nginx the socket address is the proxy, so prefer the
  // forwarded client. Only trusted when TRUST_PROXY is on (see config).
  const forwarded = req.get('x-forwarded-for');
  if (process.env.TRUST_PROXY === '1' && forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

/** Seconds to wait, or 0 when the caller may attempt a login now. */
export function loginBlockedFor(key: string): number {
  const record = attempts.get(key);
  if (!record) return 0;
  const remaining = record.blockedUntil - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

export function recordFailedLogin(key: string): void {
  const now = Date.now();
  const record = attempts.get(key);

  if (!record || now - record.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now, blockedUntil: 0 });
    return;
  }

  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_MS;
    record.count = 0;
    record.firstAt = now;
  }
}

export function clearFailedLogins(key: string): void {
  attempts.delete(key);
}

/** Test-only hook so the throttle doesn't leak between test cases. */
export function resetLoginThrottle(): void {
  attempts.clear();
}
