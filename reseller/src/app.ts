import path from 'node:path';
import express from 'express';
import { config, ensureDirs } from './config.js';
import { api, requireApiKey } from './routes/api.js';
import { handoff } from './routes/handoff.js';

/** Build the Express app. Separate from index.ts so tests can mount it. */
export function createApp(): express.Express {
  ensureDirs();

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  /**
   * Media has to be served without an API key: eBay, Instagram and Facebook
   * publish by *fetching* these URLs themselves, and they can't send a header.
   * Only product photos live under this path.
   */
  app.use(
    '/media',
    express.static(config.paths.media, { maxAge: '7d', index: false, dotfiles: 'deny' }),
  );

  app.use('/handoff', handoff);
  app.use('/api', requireApiKey, api);

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true });
  });

  app.use(express.static(path.join(import.meta.dirname, 'web'), { index: 'index.html' }));

  // JSON errors for the API instead of Express's HTML error page.
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      console.error('[http]', err);
      if (!res.headersSent) res.status(500).json({ error: message });
    },
  );

  return app;
}
