import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

// Importing listing.ts opens the database; keep it out of the real data dir.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reseller-listing-'));
process.env.DATA_DIR = dataDir;
process.env.BRAND_HANDLE = '@testcloset';
process.env.STORY_CALL_TO_ACTION = 'DM to buy';

const { buildCaption, buildDescription, formatPrice } = await import('../src/core/listing.js');
import type { Product } from '../src/core/types.js';

after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    sku: 'test-1',
    title: 'Nike Air Max 90 Infrared',
    description: null,
    priceCents: 14500,
    currency: 'USD',
    quantity: 1,
    brand: 'Nike',
    category: 'Sneakers',
    condition: 'Excellent',
    size: 'US 10.5',
    color: 'White / Infrared',
    tags: ['Air Max 90', 'vintage', 'sneakers'],
    createdAt: '2026-01-01 00:00:00',
    ...overrides,
  };
}

describe('formatPrice', () => {
  it('drops the decimals on a whole amount', () => {
    assert.equal(formatPrice(14500, 'USD'), '$145');
  });

  it('keeps cents when there are any', () => {
    assert.equal(formatPrice(14599, 'USD'), '$145.99');
  });

  it('returns an empty string with no price', () => {
    assert.equal(formatPrice(null, 'USD'), '');
  });

  it('formats a well-formed currency code Intl has no symbol for', () => {
    assert.equal(formatPrice(1000, 'XYZ'), 'XYZ 10');
  });

  it('falls back instead of throwing on a malformed currency code', () => {
    // Intl.NumberFormat throws RangeError on anything that isn't 3 letters.
    assert.equal(formatPrice(1000, 'US'), 'US 10.00');
  });
});

describe('buildDescription', () => {
  it('uses the seller text when provided', () => {
    const p = product({ description: '  Hand-written copy.  ' });
    assert.equal(buildDescription(p), 'Hand-written copy.');
  });

  it('builds one from the structured fields otherwise', () => {
    const text = buildDescription(product());
    assert.match(text, /^Nike Air Max 90 Infrared/);
    assert.match(text, /Brand: Nike/);
    assert.match(text, /Size: US 10\.5/);
    assert.match(text, /Condition: Excellent/);
  });

  it('omits the fields that are empty', () => {
    const text = buildDescription(product({ brand: null, size: '  ' }));
    assert.doesNotMatch(text, /Brand:/);
    assert.doesNotMatch(text, /Size:/);
  });
});

describe('buildCaption', () => {
  it('leads with the name and price', () => {
    assert.match(buildCaption(product()), /^Nike Air Max 90 Infrared — \$145/);
  });

  it('turns tags into hashtags and de-duplicates them', () => {
    const caption = buildCaption(product({ tags: ['Air Max 90', 'airmax90', 'vintage'] }));
    assert.match(caption, /#airmax90/);
    assert.match(caption, /#vintage/);
    // "Air Max 90" and "airmax90" normalize to the same tag.
    assert.equal(caption.match(/#airmax90/g)?.length, 1);
  });

  it('includes the brand handle and the call to action', () => {
    const caption = buildCaption(product());
    assert.match(caption, /@testcloset/);
    assert.match(caption, /DM to buy/);
  });

  it('works with no price and no tags', () => {
    const caption = buildCaption(product({ priceCents: null, tags: [], brand: null, category: null }));
    assert.match(caption, /^Nike Air Max 90 Infrared/);
    assert.doesNotMatch(caption, /—/);
  });
});
