import Database from 'better-sqlite3';
import { config, ensureDirs } from '../config.js';
import type { MediaAsset, PostRecord, PostStatus, Product } from '../core/types.js';

ensureDirs();

export const db = new Database(config.paths.db);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sku          TEXT    NOT NULL UNIQUE,
  title        TEXT    NOT NULL,
  description  TEXT,
  price_cents  INTEGER,
  currency     TEXT    NOT NULL DEFAULT 'USD',
  quantity     INTEGER NOT NULL DEFAULT 1,
  brand        TEXT,
  category     TEXT,
  condition    TEXT,
  size         TEXT,
  color        TEXT,
  tags         TEXT    NOT NULL DEFAULT '[]',
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS media (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  relative_path TEXT    NOT NULL,
  role          TEXT    NOT NULL,
  position      INTEGER NOT NULL DEFAULT 0,
  width         INTEGER NOT NULL DEFAULT 0,
  height        INTEGER NOT NULL DEFAULT 0,
  bytes         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_media_product ON media(product_id, role, position);

CREATE TABLE IF NOT EXISTS posts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  channel_id   TEXT    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'queued',
  attempts     INTEGER NOT NULL DEFAULT 0,
  external_id  TEXT,
  external_url TEXT,
  message      TEXT,
  artifacts    TEXT    NOT NULL DEFAULT '[]',
  run_after    TEXT    NOT NULL DEFAULT (datetime('now')),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(product_id, channel_id)
);
CREATE INDEX IF NOT EXISTS idx_posts_claimable ON posts(status, run_after);

CREATE TABLE IF NOT EXISTS logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  message    TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_logs_post ON logs(post_id, id);
`);

/* -------------------------------------------------------------------------- */
/* Row mapping                                                                */
/* -------------------------------------------------------------------------- */

type ProductRow = {
  id: number; sku: string; title: string; description: string | null;
  price_cents: number | null; currency: string; quantity: number;
  brand: string | null; category: string | null; condition: string | null;
  size: string | null; color: string | null; tags: string; created_at: string;
};

type MediaRow = {
  id: number; product_id: number; relative_path: string; role: string;
  position: number; width: number; height: number; bytes: number;
};

type PostRow = {
  id: number; product_id: number; channel_id: string; status: string;
  attempts: number; external_id: string | null; external_url: string | null;
  message: string | null; artifacts: string; run_after: string;
  created_at: string; updated_at: string;
};

/** Tolerate hand-edited/corrupt JSON columns rather than crashing a request. */
function parseJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    title: row.title,
    description: row.description,
    priceCents: row.price_cents,
    currency: row.currency,
    quantity: row.quantity,
    brand: row.brand,
    category: row.category,
    condition: row.condition,
    size: row.size,
    color: row.color,
    tags: parseJsonArray(row.tags),
    createdAt: row.created_at,
  };
}

function toMedia(row: MediaRow): MediaAsset {
  return {
    id: row.id,
    productId: row.product_id,
    relativePath: row.relative_path,
    role: row.role as MediaAsset['role'],
    position: row.position,
    width: row.width,
    height: row.height,
    bytes: row.bytes,
  };
}

function toPost(row: PostRow): PostRecord {
  return {
    id: row.id,
    productId: row.product_id,
    channelId: row.channel_id,
    status: row.status as PostStatus,
    attempts: row.attempts,
    externalId: row.external_id,
    externalUrl: row.external_url,
    message: row.message,
    artifacts: parseJsonArray(row.artifacts),
    runAfter: row.run_after,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* -------------------------------------------------------------------------- */
/* Products                                                                   */
/* -------------------------------------------------------------------------- */

export interface NewProduct {
  sku: string;
  title: string;
  description?: string | null;
  priceCents?: number | null;
  currency?: string;
  quantity?: number;
  brand?: string | null;
  category?: string | null;
  condition?: string | null;
  size?: string | null;
  color?: string | null;
  tags?: string[];
}

export function insertProduct(p: NewProduct): Product {
  const info = db
    .prepare(
      `INSERT INTO products
         (sku, title, description, price_cents, currency, quantity, brand,
          category, condition, size, color, tags)
       VALUES
         (@sku, @title, @description, @priceCents, @currency, @quantity, @brand,
          @category, @condition, @size, @color, @tags)`,
    )
    .run({
      sku: p.sku,
      title: p.title,
      description: p.description ?? null,
      priceCents: p.priceCents ?? null,
      currency: p.currency ?? 'USD',
      quantity: p.quantity ?? 1,
      brand: p.brand ?? null,
      category: p.category ?? null,
      condition: p.condition ?? null,
      size: p.size ?? null,
      color: p.color ?? null,
      tags: JSON.stringify(p.tags ?? []),
    });
  return getProduct(Number(info.lastInsertRowid))!;
}

export function getProduct(id: number): Product | undefined {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow | undefined;
  return row ? toProduct(row) : undefined;
}

export function listProducts(limit = 100): Product[] {
  const rows = db
    .prepare('SELECT * FROM products ORDER BY id DESC LIMIT ?')
    .all(limit) as ProductRow[];
  return rows.map(toProduct);
}

export function deleteProduct(id: number): void {
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
}

/* -------------------------------------------------------------------------- */
/* Media                                                                      */
/* -------------------------------------------------------------------------- */

export function insertMedia(m: Omit<MediaAsset, 'id'>): MediaAsset {
  const info = db
    .prepare(
      `INSERT INTO media (product_id, relative_path, role, position, width, height, bytes)
       VALUES (@productId, @relativePath, @role, @position, @width, @height, @bytes)`,
    )
    .run(m);
  return { ...m, id: Number(info.lastInsertRowid) };
}

export function getMediaForProduct(productId: number): MediaAsset[] {
  const rows = db
    .prepare('SELECT * FROM media WHERE product_id = ? ORDER BY role, position, id')
    .all(productId) as MediaRow[];
  return rows.map(toMedia);
}

/* -------------------------------------------------------------------------- */
/* Posts                                                                      */
/* -------------------------------------------------------------------------- */

/** Queue a product for a channel. Re-queues an existing row on retry. */
export function enqueuePost(productId: number, channelId: string): PostRecord {
  db.prepare(
    `INSERT INTO posts (product_id, channel_id, status, run_after)
     VALUES (?, ?, 'queued', datetime('now'))
     ON CONFLICT(product_id, channel_id) DO UPDATE SET
       status     = 'queued',
       attempts   = 0,
       message    = NULL,
       run_after  = datetime('now'),
       updated_at = datetime('now')`,
  ).run(productId, channelId);
  return getPost(productId, channelId)!;
}

export function getPost(productId: number, channelId: string): PostRecord | undefined {
  const row = db
    .prepare('SELECT * FROM posts WHERE product_id = ? AND channel_id = ?')
    .get(productId, channelId) as PostRow | undefined;
  return row ? toPost(row) : undefined;
}

export function getPostById(id: number): PostRecord | undefined {
  const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as PostRow | undefined;
  return row ? toPost(row) : undefined;
}

export function listPostsForProduct(productId: number): PostRecord[] {
  const rows = db
    .prepare('SELECT * FROM posts WHERE product_id = ? ORDER BY channel_id')
    .all(productId) as PostRow[];
  return rows.map(toPost);
}

export function listRecentPosts(limit = 200): PostRecord[] {
  const rows = db
    .prepare('SELECT * FROM posts ORDER BY updated_at DESC, id DESC LIMIT ?')
    .all(limit) as PostRow[];
  return rows.map(toPost);
}

/**
 * Atomically claim the next due job. The UPDATE..WHERE status='queued' is the
 * lock: if two workers race, only one row is changed.
 */
export function claimNextPost(): PostRecord | undefined {
  const claim = db.transaction((): PostRecord | undefined => {
    const row = db
      .prepare(
        `SELECT * FROM posts
          WHERE status = 'queued' AND run_after <= datetime('now')
          ORDER BY run_after, id
          LIMIT 1`,
      )
      .get() as PostRow | undefined;
    if (!row) return undefined;

    const res = db
      .prepare(
        `UPDATE posts
            SET status = 'running', attempts = attempts + 1, updated_at = datetime('now')
          WHERE id = ? AND status = 'queued'`,
      )
      .run(row.id);
    if (res.changes === 0) return undefined;

    return getPostById(row.id);
  });
  return claim();
}

export function markPostResult(
  id: number,
  status: PostStatus,
  fields: {
    externalId?: string | null;
    externalUrl?: string | null;
    message?: string | null;
    artifacts?: string[];
  } = {},
): void {
  db.prepare(
    `UPDATE posts SET
       status       = @status,
       external_id  = COALESCE(@externalId, external_id),
       external_url = COALESCE(@externalUrl, external_url),
       message      = @message,
       artifacts    = @artifacts,
       updated_at   = datetime('now')
     WHERE id = @id`,
  ).run({
    id,
    status,
    externalId: fields.externalId ?? null,
    externalUrl: fields.externalUrl ?? null,
    message: fields.message ?? null,
    artifacts: JSON.stringify(fields.artifacts ?? []),
  });
}

/** Put a failed job back in the queue after `delaySeconds`. */
export function requeuePost(id: number, delaySeconds: number, message: string): void {
  db.prepare(
    `UPDATE posts SET
       status     = 'queued',
       message    = @message,
       run_after  = datetime('now', @offset),
       updated_at = datetime('now')
     WHERE id = @id`,
  ).run({ id, message, offset: `+${Math.max(0, Math.round(delaySeconds))} seconds` });
}

/** Reset jobs left 'running' by a crash so they get picked up again. */
export function recoverStuckPosts(): number {
  const res = db
    .prepare(
      `UPDATE posts SET status = 'queued', updated_at = datetime('now')
        WHERE status = 'running'`,
    )
    .run();
  return res.changes;
}

/* -------------------------------------------------------------------------- */
/* Logs                                                                       */
/* -------------------------------------------------------------------------- */

export function addLog(postId: number, message: string): void {
  db.prepare('INSERT INTO logs (post_id, message) VALUES (?, ?)').run(postId, message);
}

export function getLogs(postId: number, limit = 100): { message: string; createdAt: string }[] {
  const rows = db
    .prepare('SELECT message, created_at FROM logs WHERE post_id = ? ORDER BY id DESC LIMIT ?')
    .all(postId, limit) as { message: string; created_at: string }[];
  return rows.reverse().map((r) => ({ message: r.message, createdAt: r.created_at }));
}
