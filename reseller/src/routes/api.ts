import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { config } from '../config.js';
import { describeChannels, getAdapter } from '../channels/registry.js';
import {
  deleteProduct,
  enqueuePost,
  getLogs,
  getMediaForProduct,
  getPostById,
  getProduct,
  insertProduct,
  listPostsForProduct,
  listProducts,
  listRecentPosts,
} from '../db/index.js';
import { ingestPhoto, renderStoryImage } from '../core/media.js';
import { buildCaption, buildDescription, formatPrice } from '../core/listing.js';
import { kickWorker } from '../core/queue.js';

const MAX_PHOTOS = 12;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: MAX_PHOTOS, fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Reject anything that isn't an image before it reaches sharp.
    cb(null, /^image\/(jpeg|png|webp|heic|heif|avif|gif)$/i.test(file.mimetype));
  },
});

/** Accepts "45", "45.00", "$45" and returns cents. */
function parsePriceToCents(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const cleaned = String(raw).replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

/** Treat a cleared form field as absent rather than as an invalid value. */
const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const productSchema = z.object({
  title: z.string().trim().min(1, 'A product name is required').max(300),
  description: z.string().trim().max(20_000).optional(),
  price: z.string().optional(),
  currency: z.preprocess(
    blankToUndefined,
    z.string().trim().length(3, 'Currency must be a 3-letter code like USD').default('USD'),
  ),
  quantity: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().min(1).max(999).default(1),
  ),
  brand: z.string().trim().max(120).optional(),
  category: z.string().trim().max(120).optional(),
  condition: z.string().trim().max(60).optional(),
  size: z.string().trim().max(60).optional(),
  color: z.string().trim().max(60).optional(),
  sku: z.string().trim().max(80).optional(),
  tags: z.string().optional(),
});

/** Require X-API-Key when one is configured. */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  if (!config.apiKey) {
    next();
    return;
  }
  const provided = req.get('X-API-Key') ?? (req.query.key as string | undefined);
  if (provided === config.apiKey) {
    next();
    return;
  }
  res.status(401).json({ error: 'Missing or invalid API key' });
}

export const api = Router();

api.get('/channels', (_req, res) => {
  res.json({ channels: describeChannels(), publicBaseUrl: config.publicBaseUrl });
});

/**
 * The one endpoint the whole system exists for: photos + a name in, listings
 * queued for every channel the seller ticked.
 */
api.post('/products', upload.array('photos', MAX_PHOTOS), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    res.status(400).json({ error: 'Add at least one photo.' });
    return;
  }

  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) {
    // Name the field, so "must be a 3-letter code" says which one.
    const problems = parsed.error.issues.map((issue) => {
      const field = issue.path.join('.');
      return field ? `${field}: ${issue.message}` : issue.message;
    });
    res.status(400).json({ error: problems.join('; ') });
    return;
  }
  const input = parsed.data;

  // `channels` arrives as a repeated field or a comma-joined string.
  const rawChannels = req.body.channels;
  const requested = (Array.isArray(rawChannels) ? rawChannels : String(rawChannels ?? '').split(','))
    .map((c: string) => c.trim())
    .filter(Boolean);

  const unknown = requested.filter((id: string) => !getAdapter(id));
  if (unknown.length > 0) {
    res.status(400).json({ error: `Unknown channel(s): ${unknown.join(', ')}` });
    return;
  }
  if (requested.length === 0) {
    res.status(400).json({ error: 'Pick at least one channel to post to.' });
    return;
  }

  const tags = (input.tags ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 30);

  const product = insertProduct({
    sku: input.sku || `${slugify(input.title) || 'item'}-${Date.now().toString(36)}`,
    title: input.title,
    description: input.description ?? null,
    priceCents: parsePriceToCents(input.price),
    currency: input.currency.toUpperCase(),
    quantity: input.quantity,
    brand: input.brand ?? null,
    category: input.category ?? null,
    condition: input.condition ?? null,
    size: input.size ?? null,
    color: input.color ?? null,
    tags,
  });

  try {
    for (const [index, file] of files.entries()) {
      await ingestPhoto(product.id, file.buffer, index + 1);
    }
    // Story render always uses the first photo -- the one the seller led with.
    const firstFile = files[0];
    if (firstFile) await renderStoryImage(product.id, firstFile.buffer, product);
  } catch (err) {
    deleteProduct(product.id);
    const reason = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: `Could not process those photos: ${reason}` });
    return;
  }

  for (const channelId of requested) enqueuePost(product.id, channelId);
  kickWorker();

  res.status(201).json({
    product,
    queued: requested,
    caption: buildCaption(product),
    description: buildDescription(product),
  });
});

api.get('/products', (_req, res) => {
  const products = listProducts().map((p) => ({
    ...p,
    priceLabel: formatPrice(p.priceCents, p.currency),
    posts: listPostsForProduct(p.id),
    thumbnail:
      getMediaForProduct(p.id).find((m) => m.role === 'square')?.relativePath ?? null,
  }));
  res.json({ products });
});

api.get('/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const product = getProduct(id);
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  res.json({
    product,
    priceLabel: formatPrice(product.priceCents, product.currency),
    caption: buildCaption(product),
    description: buildDescription(product),
    media: getMediaForProduct(id),
    posts: listPostsForProduct(id),
  });
});

api.delete('/products/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!getProduct(id)) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  deleteProduct(id);
  res.json({ ok: true });
});

api.get('/posts', (_req, res) => {
  res.json({ posts: listRecentPosts() });
});

api.get('/posts/:id/logs', (req, res) => {
  const id = Number(req.params.id);
  const post = getPostById(id);
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }
  res.json({ post, logs: getLogs(id) });
});

/** Re-queue a single failed channel without re-uploading the product. */
api.post('/posts/:id/retry', (req, res) => {
  const id = Number(req.params.id);
  const post = getPostById(id);
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }
  const updated = enqueuePost(post.productId, post.channelId);
  kickWorker();
  res.json({ post: updated });
});
