import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';

const root = process.cwd();
/** Everything the app writes lives here. Override to relocate (or isolate tests). */
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(root, 'data');

function bool(name: string, fallback = false): boolean {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  return v === '1' || v.toLowerCase() === 'true';
}

function int(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) ? v : fallback;
}

export const config = {
  port: int('PORT', 3000),
  /** Strip a trailing slash so we can always join with `/...`. */
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/+$/, ''),
  apiKey: process.env.APP_API_KEY || '',

  brand: {
    name: process.env.BRAND_NAME || 'My Closet',
    handle: process.env.BRAND_HANDLE || '',
    callToAction: process.env.STORY_CALL_TO_ACTION || 'DM to buy',
  },

  paths: {
    data: dataDir,
    media: path.join(dataDir, 'media'),
    outbox: path.join(dataDir, 'outbox'),
    sessions: path.join(dataDir, 'sessions'),
    db: path.join(dataDir, 'reseller.db'),
  },

  browser: {
    headful: bool('BROWSER_HEADFUL'),
    slowMo: int('BROWSER_SLOWMO_MS', 0),
    /** Fill the listing form and screenshot it, but don't hit publish. */
    dryRun: bool('BROWSER_DRY_RUN'),
    /**
     * Use a Chromium already on the system instead of Playwright's download.
     * Needed in containers that ship their own browser.
     */
    executablePath: process.env.CHROMIUM_PATH || undefined,
  },

  graphApiVersion: process.env.GRAPH_API_VERSION || 'v21.0',

  queue: {
    pollIntervalMs: int('QUEUE_POLL_MS', 1500),
    maxAttempts: int('QUEUE_MAX_ATTEMPTS', 3),
    /** Backoff schedule in seconds, indexed by attempt number. */
    backoffSeconds: [30, 180, 900],
  },
} as const;

export function ensureDirs(): void {
  for (const dir of Object.values(config.paths)) {
    if (dir.endsWith('.db')) continue;
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** True when the app is reachable from the public internet (needed by eBay/IG/FB). */
export function hasPublicUrl(): boolean {
  return /^https:\/\//.test(config.publicBaseUrl) && !/localhost|127\.0\.0\.1/.test(config.publicBaseUrl);
}

export function mediaUrl(relativePath: string): string {
  return `${config.publicBaseUrl}/media/${relativePath.split(path.sep).join('/')}`;
}
