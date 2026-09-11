import { Router, type NextFunction, type Request, type Response } from 'express';
import { config } from '../config.js';
import {
  SESSION_COOKIE,
  clearFailedLogins,
  clearedSessionCookie,
  clientKey,
  hashSessionToken,
  loginBlockedFor,
  newSessionToken,
  parseCookies,
  recordFailedLogin,
  serializeSessionCookie,
  verifyPassword,
} from '../core/auth.js';
import { createSession, deleteSession, sessionIsValid } from '../db/index.js';
import { escapeXml } from '../core/text.js';

export const auth = Router();

/** Cookies get the Secure flag once the app is actually served over https. */
function useSecureCookie(req: Request): boolean {
  return req.secure || req.get('x-forwarded-proto') === 'https';
}

function sessionTokenFrom(req: Request): string | undefined {
  return parseCookies(req.get('cookie'))[SESSION_COOKIE];
}

export function isSignedIn(req: Request): boolean {
  const token = sessionTokenFrom(req);
  return token !== undefined && token !== '' && sessionIsValid(hashSessionToken(token));
}

/**
 * A valid X-API-Key is an alternative to a browser session, for scripts.
 *
 * Header only, deliberately: a key passed as ?key=... would be written to
 * every reverse-proxy access log it passes through, and leak via Referer.
 */
export function hasValidApiKey(req: Request): boolean {
  if (!config.apiKey) return false;
  const provided = req.get('X-API-Key');
  return typeof provided === 'string' && provided === config.apiKey;
}

/**
 * Gate for the UI: redirect a browser to the login page, but answer an API or
 * fetch() call with 401 JSON so the front end can react instead of rendering
 * a login page into a data slot.
 */
export function requireSession(req: Request, res: Response, next: NextFunction): void {
  if (isSignedIn(req) || hasValidApiKey(req)) {
    next();
    return;
  }

  // originalUrl, not path: inside a mounted router req.path is relative to the
  // mount point, so req.path for /api/channels is just "/channels".
  const wantsJson =
    req.originalUrl.startsWith('/api') ||
    (req.get('accept') ?? '').includes('application/json') ||
    req.get('x-requested-with') === 'fetch';

  if (wantsJson) {
    res.status(401).json({ error: 'Not signed in', login: '/login' });
    return;
  }

  const target = req.originalUrl && req.originalUrl !== '/' ? `?next=${encodeURIComponent(req.originalUrl)}` : '';
  res.redirect(302, `/login${target}`);
}

/**
 * Only allow a same-site path, so ?next= can't be used to bounce you to
 * another site after signing in.
 *
 * Rejects "//evil.example" and "/\evil.example" alike: some browsers read a
 * leading slash-backslash as protocol-relative, which makes it an open
 * redirect just as much as the double slash does.
 */
function safeNext(raw: unknown): string {
  if (typeof raw !== 'string' || raw === '') return '/';
  if (raw[0] !== '/') return '/';
  if (raw[1] === '/' || raw[1] === '\\') return '/';
  // Control characters can be used to smuggle a second header or URL.
  if (/[\u0000-\u001f\u007f]/.test(raw)) return '/';
  return raw;
}

function loginPage(options: { error?: string; next: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in · Reseller Autopost</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
         background: #0b0d10; color: #eef0f4; padding: 24px;
         font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }
  form { width: 100%; max-width: 340px; background: #14171c; border: 1px solid #262b34;
         border-radius: 14px; padding: 26px; }
  h1 { font-size: 17px; margin: 0 0 4px; display: flex; align-items: center; gap: 9px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: #7ee2a8; }
  p.sub { margin: 0 0 20px; color: #99a0ad; font-size: 13px; }
  label { display: block; font-size: 13px; color: #99a0ad; margin-bottom: 6px; }
  input { width: 100%; background: #1a1e25; border: 1px solid #262b34; color: #eef0f4;
          border-radius: 9px; padding: 11px 12px; font: inherit; }
  input:focus { outline: none; border-color: #7ee2a8; }
  button { width: 100%; margin-top: 16px; border: 0; border-radius: 999px; padding: 12px;
           background: #7ee2a8; color: #07110b; font: inherit; font-weight: 700;
           cursor: pointer; }
  .error { margin: 14px 0 0; padding: 10px 12px; border-radius: 9px; font-size: 13px;
           background: #2a1618; border: 1px solid #4a2327; color: #f08a8a; }
</style>
</head>
<body>
<form method="post" action="/login">
  <h1><span class="dot"></span> Reseller Autopost</h1>
  <p class="sub">This page is private. Sign in to continue.</p>

  <input type="hidden" name="next" value="${escapeXml(options.next)}">
  <label for="password">Password</label>
  <input id="password" name="password" type="password" autocomplete="current-password"
         autofocus required>
  <button type="submit">Sign in</button>
  ${options.error ? `<p class="error">${escapeXml(options.error)}</p>` : ''}
</form>
</body>
</html>`;
}

auth.get('/login', (req, res) => {
  if (isSignedIn(req)) {
    res.redirect(302, safeNext(req.query.next));
    return;
  }
  res
    .status(200)
    .type('html')
    .send(loginPage({ next: safeNext(req.query.next) }));
});

auth.post('/login', (req, res) => {
  const next = safeNext((req.body as Record<string, unknown> | undefined)?.next);
  const key = clientKey(req);

  const blockedFor = loginBlockedFor(key);
  if (blockedFor > 0) {
    const minutes = Math.ceil(blockedFor / 60);
    res
      .status(429)
      .type('html')
      .send(loginPage({ next, error: `Too many attempts. Try again in ${minutes} min.` }));
    return;
  }

  if (!config.passwordHash) {
    res
      .status(500)
      .type('html')
      .send(loginPage({ next, error: 'No password is set. Run: npm run set-password' }));
    return;
  }

  const password = String((req.body as Record<string, unknown> | undefined)?.password ?? '');
  if (!password || !verifyPassword(password, config.passwordHash)) {
    recordFailedLogin(key);
    res.status(401).type('html').send(loginPage({ next, error: 'Wrong password.' }));
    return;
  }

  clearFailedLogins(key);

  const token = newSessionToken();
  createSession(hashSessionToken(token), config.sessionTtlSeconds, req.get('user-agent') ?? '');
  res.setHeader(
    'Set-Cookie',
    serializeSessionCookie(token, config.sessionTtlSeconds, useSecureCookie(req)),
  );
  res.redirect(302, next);
});

auth.post('/logout', (req, res) => {
  const token = sessionTokenFrom(req);
  if (token) deleteSession(hashSessionToken(token));
  res.setHeader('Set-Cookie', clearedSessionCookie(useSecureCookie(req)));
  res.redirect(302, '/login');
});
