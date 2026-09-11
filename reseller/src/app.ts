import path from 'node:path';
import express from 'express';
import { config, ensureDirs } from './config.js';
import { api } from './routes/api.js';
import { handoff } from './routes/handoff.js';
import { auth, requireSession } from './routes/auth.js';
import { purgeExpiredSessions } from './db/index.js';

/**
 * Refuse anything that isn't loopback when no password is configured.
 *
 * Without this, forgetting ADMIN_PASSWORD_HASH before putting the app behind a
 * tunnel would publish an unauthenticated listing tool -- including your
 * marketplace sessions -- to the internet. Failing closed is the only sane
 * default here.
 */
function localhostOnly(): express.RequestHandler {
  const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

  return (req, res, next) => {
    const address = req.socket.remoteAddress ?? '';
    if (loopback.has(address)) {
      next();
      return;
    }
    res.status(403).type('text').send(
      'This instance has no password set, so it only answers on localhost.\n' +
        'Run `npm run set-password` and put the hash in ADMIN_PASSWORD_HASH.\n',
    );
  };
}

export function createApp(): express.Express {
  ensureDirs();
  purgeExpiredSessions();

  const app = express();
  app.disable('x-powered-by');

  // Needed for req.secure and req.ip behind Cloudflare Tunnel / nginx.
  if (config.trustProxy) app.set('trust proxy', true);

  if (!config.passwordHash) app.use(localhostOnly());

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '64kb' }));

  // Liveness check for whatever supervises the process. No data, no auth.
  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  /**
   * Media is the one deliberately unauthenticated path: eBay, Instagram and
   * Facebook publish by fetching these URLs themselves and cannot send a
   * header. Directory names are random 32-hex tokens (not product ids), so the
   * files are unguessable rather than merely unlinked, and `index: false`
   * keeps the directory itself unlistable.
   */
  app.use(
    '/media',
    express.static(config.paths.media, { maxAge: '7d', index: false, dotfiles: 'deny' }),
  );

  app.use(auth);
  app.use('/handoff', requireSession, handoff);
  app.use('/api', requireSession, api);

  // Everything else -- the UI itself -- is behind the session too.
  app.use(requireSession, express.static(path.join(import.meta.dirname, 'web'), { index: 'index.html' }));

  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      console.error('[http]', err);
      if (!res.headersSent) res.status(500).json({ error: message });
    },
  );

  return app;
}
