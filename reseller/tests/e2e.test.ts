import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

/**
 * End-to-end: a photo and a name go in over HTTP, and a finished story image
 * plus a settled post record come out. Runs against the Snapchat channel
 * because it's the one adapter that needs no credentials, so the whole
 * pipeline -- upload, sharp, story render, queue, adapter -- is exercised
 * without touching anybody's marketplace account.
 */

// config reads process.env at import time, so point it at a scratch dir first.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reseller-e2e-'));
process.env.DATA_DIR = dataDir;
process.env.APP_API_KEY = 'test-key';
process.env.BRAND_NAME = 'Test Closet';
process.env.BRAND_HANDLE = '@testcloset';
process.env.PUBLIC_BASE_URL = 'http://127.0.0.1:0';

const { createApp } = await import('../src/app.js');
const { startWorker, stopWorker } = await import('../src/core/queue.js');
const sharp = (await import('sharp')).default;

let server: Server;
let base: string;

async function makePhoto(): Promise<Buffer> {
  return sharp({ create: { width: 1200, height: 1600, channels: 3, background: '#3b6ea5' } })
    .jpeg()
    .toBuffer();
}

before(async () => {
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  startWorker();
});

after(async () => {
  stopWorker();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const auth = { 'X-API-Key': 'test-key' };

describe('API auth', () => {
  it('rejects a request with no key', async () => {
    const res = await fetch(`${base}/api/channels`);
    assert.equal(res.status, 401);
  });

  it('accepts a request with the key', async () => {
    const res = await fetch(`${base}/api/channels`, { headers: auth });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { channels: { id: string }[] };
    assert.ok(body.channels.some((c) => c.id === 'ebay'));
    assert.ok(body.channels.some((c) => c.id === 'snapchat'));
  });
});

describe('validation', () => {
  it('refuses a product with no photo', async () => {
    const form = new FormData();
    form.set('title', 'No photos here');
    form.set('channels', 'snapchat');
    const res = await fetch(`${base}/api/products`, { method: 'POST', headers: auth, body: form });
    assert.equal(res.status, 400);
    assert.match(((await res.json()) as { error: string }).error, /at least one photo/i);
  });

  it('refuses a product with no channels', async () => {
    const form = new FormData();
    form.set('title', 'Nowhere to go');
    const photo = await makePhoto();
    form.append('photos', new Blob([new Uint8Array(photo)], { type: 'image/jpeg' }), 'a.jpg');
    const res = await fetch(`${base}/api/products`, { method: 'POST', headers: auth, body: form });
    assert.equal(res.status, 400);
    assert.match(((await res.json()) as { error: string }).error, /at least one channel/i);
  });

  it('treats cleared optional fields as absent', async () => {
    const form = new FormData();
    form.set('title', 'Cleared fields are fine');
    form.set('channels', 'snapchat');
    form.set('currency', '');
    form.set('quantity', '');
    form.set('price', '');
    const photo = await makePhoto();
    form.append('photos', new Blob([new Uint8Array(photo)], { type: 'image/jpeg' }), 'a.jpg');

    const res = await fetch(`${base}/api/products`, { method: 'POST', headers: auth, body: form });
    assert.equal(res.status, 201);
    const { product } = (await res.json()) as {
      product: { currency: string; quantity: number; priceCents: number | null };
    };
    assert.equal(product.currency, 'USD', 'currency fell back to the default');
    assert.equal(product.quantity, 1);
    assert.equal(product.priceCents, null);
  });

  it('names the offending field in a validation error', async () => {
    const form = new FormData();
    form.set('title', 'Bad currency');
    form.set('channels', 'snapchat');
    form.set('currency', 'DOLLARS');
    const photo = await makePhoto();
    form.append('photos', new Blob([new Uint8Array(photo)], { type: 'image/jpeg' }), 'a.jpg');

    const res = await fetch(`${base}/api/products`, { method: 'POST', headers: auth, body: form });
    assert.equal(res.status, 400);
    assert.match(((await res.json()) as { error: string }).error, /currency: /);
  });

  it('refuses an unknown channel', async () => {
    const form = new FormData();
    form.set('title', 'Bad channel');
    form.set('channels', 'craigslist');
    const photo = await makePhoto();
    form.append('photos', new Blob([new Uint8Array(photo)], { type: 'image/jpeg' }), 'a.jpg');
    const res = await fetch(`${base}/api/products`, { method: 'POST', headers: auth, body: form });
    assert.equal(res.status, 400);
    assert.match(((await res.json()) as { error: string }).error, /Unknown channel/i);
  });
});

describe('post once, fan out', () => {
  it('ingests photos, renders a story, and settles the queued post', async () => {
    const form = new FormData();
    form.set('title', 'Vintage Nike Air Max 90 Infrared');
    form.set('price', '$145');
    form.set('brand', 'Nike');
    form.set('size', 'US 10.5');
    form.set('tags', 'airmax, vintage, sneakers');
    form.set('channels', 'snapchat');

    for (const name of ['front.jpg', 'side.jpg']) {
      const photo = await makePhoto();
      form.append('photos', new Blob([new Uint8Array(photo)], { type: 'image/jpeg' }), name);
    }

    const res = await fetch(`${base}/api/products`, { method: 'POST', headers: auth, body: form });
    assert.equal(res.status, 201);

    const created = (await res.json()) as {
      product: { id: number; sku: string; priceCents: number };
      queued: string[];
      caption: string;
    };
    assert.deepEqual(created.queued, ['snapchat']);
    assert.equal(created.product.priceCents, 14500, 'parsed "$145" into cents');
    assert.match(created.caption, /\$145/);
    assert.match(created.caption, /#airmax/);

    /* Media: two originals, two squares, one story render. */
    const detail = (await (
      await fetch(`${base}/api/products/${created.product.id}`, { headers: auth })
    ).json()) as { media: { role: string; width: number; height: number }[] };

    const roles = detail.media.map((m) => m.role);
    assert.equal(roles.filter((r) => r === 'original').length, 2);
    assert.equal(roles.filter((r) => r === 'square').length, 2);

    const story = detail.media.find((m) => m.role === 'story');
    assert.ok(story, 'a story image was rendered');
    assert.equal(story.width, 1080);
    assert.equal(story.height, 1920);

    /* The story image is fetchable over HTTP without a key (the APIs need that). */
    const storyRes = await fetch(`${base}/media/${created.product.id}/story.jpg`);
    assert.equal(storyRes.status, 200);
    assert.equal(storyRes.headers.get('content-type'), 'image/jpeg');

    /* The worker should settle the job; Snapchat is an assist channel, so it
       lands on needs_action with the asset paths attached. */
    let post: { status: string; artifacts: string[]; externalUrl: string | null } | undefined;
    for (let i = 0; i < 40; i++) {
      const body = (await (
        await fetch(`${base}/api/products/${created.product.id}`, { headers: auth })
      ).json()) as { posts: typeof post[] };
      post = body.posts[0];
      if (post && post.status !== 'queued' && post.status !== 'running') break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    assert.ok(post, 'a post record exists');
    assert.equal(post.status, 'needs_action');
    assert.equal(post.artifacts.length, 2, 'story image + caption were written');
    for (const artifact of post.artifacts) {
      assert.ok(fs.existsSync(artifact), `${artifact} exists on disk`);
    }
    assert.match(post.externalUrl ?? '', /\/handoff\//);
  });

  it('serves the handoff page for the created product', async () => {
    const { products } = (await (
      await fetch(`${base}/api/products`, { headers: auth })
    ).json()) as { products: { id: number; title: string }[] };

    const target = products.find((p) => p.title.includes('Air Max'));
    assert.ok(target);

    const res = await fetch(`${base}/handoff/${target.id}`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Air Max/);
    assert.match(html, /Save image/);
    assert.match(html, /Copy caption/);
  });
});
