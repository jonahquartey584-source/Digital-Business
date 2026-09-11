import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reseller-registry-'));
process.env.DATA_DIR = dataDir;
process.env.VINTED_DOMAIN = 'www.vinted.co.uk';

const { adapters, describeChannels, getAdapter } = await import('../src/channels/registry.js');

after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

describe('channel registry', () => {
  it('has no duplicate ids', () => {
    const ids = adapters.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length, `duplicates in ${ids.join(', ')}`);
  });

  it('includes every channel the README promises', () => {
    for (const id of [
      'ebay', 'etsy', 'shopify',
      'poshmark', 'depop', 'vinted', 'mercari', 'facebook_marketplace', 'offerup',
      'instagram_story', 'instagram_feed',
      'facebook_story', 'facebook_page',
      'snapchat_story', 'story_handoff',
    ]) {
      assert.ok(getAdapter(id), `${id} is not registered`);
    }
  });

  it('gives every adapter a sane shape', () => {
    for (const a of adapters) {
      assert.match(a.id, /^[a-z0-9_]+$/, `${a.id} should be a slug`);
      assert.ok(a.label.length > 0, `${a.id} needs a label`);
      assert.ok(['marketplace', 'social'].includes(a.kind), `${a.id} kind`);
      assert.ok(['api', 'browser', 'assist'].includes(a.mode), `${a.id} mode`);
      assert.ok(a.capabilities.maxPhotos >= 1, `${a.id} maxPhotos`);
      assert.ok(a.capabilities.titleMaxLength > 0, `${a.id} titleMaxLength`);
      assert.equal(typeof a.publish, 'function', `${a.id} publish`);
    }
  });

  it('reports browser channels as needing a login, not an API key', () => {
    for (const id of ['poshmark', 'depop', 'vinted', 'mercari', 'facebook_marketplace', 'offerup']) {
      const missing = getAdapter(id)!.missingConfig();
      assert.equal(missing.length, 1, `${id} should need exactly one thing`);
      assert.match(missing[0]!, new RegExp(`npm run login -- ${id}`), `${id} hint`);
    }
  });

  it('describes channels for the UI without throwing', () => {
    const described = describeChannels();
    assert.equal(described.length, adapters.length);

    const vinted = described.find((c) => c.id === 'vinted');
    assert.ok(vinted);
    assert.equal(vinted.mode, 'browser');
    assert.equal(vinted.kind, 'marketplace');
    assert.equal(vinted.ready, false, 'not connected until you log in');
  });

  it('points Vinted at the configured country domain', async () => {
    const { vintedFlow } = await import('../src/channels/browser/flows.js');
    assert.match(vintedFlow.homeUrl, /vinted\.co\.uk/);
    const goto = vintedFlow.steps.find((s) => s.do === 'goto');
    assert.ok(goto && 'url' in goto && goto.url.includes('www.vinted.co.uk/items/new'));
  });

  it('lets the login CLI handle every browser channel', async () => {
    const source = fs.readFileSync(new URL('../src/cli/login.ts', import.meta.url), 'utf8');
    for (const a of adapters.filter((x) => x.mode === 'browser')) {
      assert.match(source, new RegExp(`\\b${a.id}:`), `login.ts has no flow for ${a.id}`);
    }
  });
});
