import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

/**
 * Covers the thing that makes this deployable: that an unauthenticated
 * request genuinely cannot reach the UI, the API, or another product's media.
 */

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reseller-auth-'));
process.env.DATA_DIR = dataDir;
process.env.SESSION_TTL_DAYS = '30';

const { hashPassword, verifyPassword, parseCookies, SESSION_COOKIE, resetLoginThrottle } =
  await import('../src/core/auth.js');

const PASSWORD = 'correct-horse-battery-staple';
process.env.ADMIN_PASSWORD_HASH = hashPassword(PASSWORD);
process.env.APP_API_KEY = 'script-key';

const { createApp } = await import('../src/app.js');

let server: Server;
let base: string;

before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

/** Sign in and return the session cookie value. */
async function signIn(password = PASSWORD): Promise<Response> {
  return fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password, next: '/' }).toString(),
    redirect: 'manual',
  });
}

function cookieFrom(res: Response): string {
  const header = res.headers.get('set-cookie') ?? '';
  const value = parseCookies(header.split(';')[0])[SESSION_COOKIE];
  assert.ok(value, 'a session cookie was set');
  return `${SESSION_COOKIE}=${value}`;
}

describe('password hashing', () => {
  it('verifies the right password', () => {
    assert.ok(verifyPassword(PASSWORD, hashPassword(PASSWORD)));
  });

  it('rejects the wrong password', () => {
    assert.equal(verifyPassword('nope', hashPassword(PASSWORD)), false);
  });

  it('salts, so the same password hashes differently each time', () => {
    assert.notEqual(hashPassword(PASSWORD), hashPassword(PASSWORD));
  });

  it('rejects a malformed stored hash instead of throwing', () => {
    for (const bad of ['', 'garbage', 'scrypt$only-two', 'bcrypt$aa$bb', 'scrypt$zz$zz']) {
      assert.equal(verifyPassword(PASSWORD, bad), false, bad);
    }
  });

  it('normalizes unicode, so the same typed password always matches', () => {
    // "é" composed vs. decomposed -- different bytes, same password.
    const stored = hashPassword('café-password-1');
    assert.ok(verifyPassword('café-password-1', stored));
  });
});

describe('cookie parsing', () => {
  it('reads multiple cookies', () => {
    const jar = parseCookies('a=1; b=two; reseller_session=abc123');
    assert.equal(jar.a, '1');
    assert.equal(jar.reseller_session, 'abc123');
  });

  it('survives junk without throwing', () => {
    assert.deepEqual(parseCookies(undefined), {});
    assert.deepEqual(parseCookies('novalue'), {});
    assert.deepEqual(parseCookies('=orphan'), {});
  });
});

describe('the gate', () => {
  it('redirects an anonymous browser to the login page', async () => {
    const res = await fetch(`${base}/`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    assert.match(res.headers.get('location') ?? '', /^\/login/);
  });

  it('answers an anonymous API call with 401 JSON, not a redirect', async () => {
    const res = await fetch(`${base}/api/channels`, { redirect: 'manual' });
    assert.equal(res.status, 401);
    assert.equal((await res.json() as { login: string }).login, '/login');
  });

  it('keeps the handoff page private too', async () => {
    const res = await fetch(`${base}/handoff/1`, { redirect: 'manual' });
    assert.equal(res.status, 302);
  });

  it('leaves the health check open for process supervisors', async () => {
    const res = await fetch(`${base}/healthz`);
    assert.equal(res.status, 200);
  });

  it('still accepts an X-API-Key for scripts', async () => {
    const res = await fetch(`${base}/api/channels`, { headers: { 'X-API-Key': 'script-key' } });
    assert.equal(res.status, 200);
  });

  it('rejects a wrong X-API-Key', async () => {
    const res = await fetch(`${base}/api/channels`, {
      headers: { 'X-API-Key': 'guess', 'X-Requested-With': 'fetch' },
      redirect: 'manual',
    });
    assert.equal(res.status, 401);
  });
});

describe('signing in', () => {
  it('rejects the wrong password without setting a cookie', async () => {
    resetLoginThrottle();
    const res = await signIn('wrong-password-entirely');
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('set-cookie'), null);
  });

  it('sets an HttpOnly, SameSite=Lax session cookie on success', async () => {
    resetLoginThrottle();
    const res = await signIn();
    assert.equal(res.status, 302);
    const header = res.headers.get('set-cookie') ?? '';
    assert.match(header, /HttpOnly/);
    assert.match(header, /SameSite=Lax/);
    assert.match(header, /Max-Age=\d+/);
  });

  it('opens up the API once signed in', async () => {
    resetLoginThrottle();
    const cookie = cookieFrom(await signIn());
    const res = await fetch(`${base}/api/channels`, { headers: { cookie } });
    assert.equal(res.status, 200);
  });

  it('throttles repeated wrong guesses', async () => {
    resetLoginThrottle();
    let sawBlock = false;
    for (let i = 0; i < 10; i++) {
      const res = await signIn(`guess-number-${i}`);
      if (res.status === 429) {
        sawBlock = true;
        break;
      }
    }
    assert.ok(sawBlock, 'brute force was blocked before 10 attempts');
    resetLoginThrottle();
  });

  it('will not bounce ?next= to another site', async () => {
    const hostile = [
      'https://evil.example/steal',
      '//evil.example/steal',
      '/\\evil.example/steal',
      'javascript:alert(1)',
      '/ok\r\nX-Injected: 1',
    ];

    for (const next of hostile) {
      resetLoginThrottle();
      const res = await fetch(`${base}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ password: PASSWORD, next }).toString(),
        redirect: 'manual',
      });
      assert.equal(res.status, 302, next);
      assert.equal(res.headers.get('location'), '/', `redirected off-site for ${next}`);
    }
  });

  it('honours a legitimate same-site next path', async () => {
    resetLoginThrottle();
    const res = await fetch(`${base}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ password: PASSWORD, next: '/handoff/1' }).toString(),
      redirect: 'manual',
    });
    assert.equal(res.headers.get('location'), '/handoff/1');
  });

  it('ignores an API key passed in the query string', async () => {
    // Header only -- a query key would land in every access log en route.
    const res = await fetch(`${base}/api/channels?key=script-key`, {
      headers: { 'X-Requested-With': 'fetch' },
      redirect: 'manual',
    });
    assert.equal(res.status, 401);
  });

  it('signing out invalidates the cookie server-side', async () => {
    resetLoginThrottle();
    const cookie = cookieFrom(await signIn());

    await fetch(`${base}/logout`, { method: 'POST', headers: { cookie }, redirect: 'manual' });

    const res = await fetch(`${base}/api/channels`, {
      headers: { cookie, 'X-Requested-With': 'fetch' },
      redirect: 'manual',
    });
    assert.equal(res.status, 401, 'the old cookie no longer works');
  });
});

describe('media privacy', () => {
  /**
   * A media path that isn't a real file falls through the static handler to
   * the authenticated catch-all, so "not served as media" shows up as the
   * login redirect rather than a 404. Following the redirect would land on the
   * login page and read as a misleading 200, hence redirect: 'manual'.
   */
  it('does not serve a directory listing', async () => {
    const res = await fetch(`${base}/media/`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    assert.match(res.headers.get('location') ?? '', /^\/login/);
  });

  it('gives nothing away for a guessed product id', async () => {
    // Paths are random 32-hex tokens, so the old /media/1/... shape is dead.
    const res = await fetch(`${base}/media/1/photo-1.jpg`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    assert.notEqual(res.headers.get('content-type'), 'image/jpeg');
  });

  it('refuses to walk out of the media directory', async () => {
    const res = await fetch(`${base}/media/..%2f..%2freseller.db`, { redirect: 'manual' });
    assert.ok(res.status >= 300, `traversal was not served (got ${res.status})`);
    assert.doesNotMatch(res.headers.get('content-type') ?? '', /sqlite|octet-stream/);
  });
});
