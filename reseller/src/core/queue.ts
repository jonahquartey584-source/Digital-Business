import { config } from '../config.js';
import { getAdapter } from '../channels/registry.js';
import {
  addLog,
  claimNextPost,
  getProduct,
  markPostResult,
  recoverStuckPosts,
  requeuePost,
} from '../db/index.js';
import { buildPublishContext } from './listing.js';
import { isPermanent, type PostRecord } from './types.js';

let running = false;
let timer: NodeJS.Timeout | null = null;

function backoffSeconds(attempt: number): number {
  const schedule = config.queue.backoffSeconds;
  return schedule[Math.min(attempt - 1, schedule.length - 1)] ?? 900;
}

async function runOne(post: PostRecord): Promise<void> {
  const log = (message: string) => {
    addLog(post.id, message);
    console.log(`[${post.channelId}#${post.id}] ${message}`);
  };

  const adapter = getAdapter(post.channelId);
  if (!adapter) {
    markPostResult(post.id, 'failed', { message: `Unknown channel "${post.channelId}"` });
    return;
  }

  const product = getProduct(post.productId);
  if (!product) {
    markPostResult(post.id, 'failed', { message: 'Product no longer exists' });
    return;
  }

  // Check setup before doing any work, so a missing token reads as a setup
  // problem rather than three retries of an opaque 401.
  const missing = adapter.missingConfig();
  if (missing.length > 0) {
    const message = `${adapter.label} is not set up yet — missing: ${missing.join(', ')}`;
    log(message);
    markPostResult(post.id, 'skipped', { message });
    return;
  }

  try {
    log(`Starting ${adapter.label} (attempt ${post.attempts})`);
    const ctx = buildPublishContext(product, adapter, log);
    const result = await adapter.publish(ctx);

    markPostResult(post.id, result.status, {
      externalId: result.externalId ?? null,
      externalUrl: result.externalUrl ?? null,
      message: result.message ?? null,
      artifacts: result.artifacts ?? [],
    });
    log(result.message ?? `Finished: ${result.status}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`Error: ${message}`);

    const giveUp = isPermanent(err) || post.attempts >= config.queue.maxAttempts;
    if (giveUp) {
      markPostResult(post.id, 'failed', { message });
      return;
    }

    const delay = backoffSeconds(post.attempts);
    log(`Retrying in ${delay}s (attempt ${post.attempts}/${config.queue.maxAttempts})`);
    requeuePost(post.id, delay, message);
  }
}

/**
 * Drain the queue one job at a time.
 *
 * Deliberately sequential: a browser-automation job is a whole Chromium
 * instance, and posting the same item to five marketplaces in parallel from
 * one IP is exactly the pattern that gets a reseller's account flagged.
 */
async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const post = claimNextPost();
      if (!post) break;
      await runOne(post);
    }
  } catch (err) {
    console.error('[queue] worker error:', err);
  } finally {
    running = false;
  }
}

export function startWorker(): void {
  const recovered = recoverStuckPosts();
  if (recovered > 0) {
    console.log(`[queue] re-queued ${recovered} job(s) left running by a previous shutdown`);
  }

  timer = setInterval(() => {
    void tick();
  }, config.queue.pollIntervalMs);
  // Don't hold the process open just for the poll timer.
  timer.unref();

  void tick();
}

export function stopWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

/** Nudge the worker immediately after something is enqueued. */
export function kickWorker(): void {
  void tick();
}
