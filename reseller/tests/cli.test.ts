import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { extractEbayCode } from '../src/cli/ebay-code.js';
import { updateEnv } from '../src/cli/env-file.js';

describe('extractEbayCode', () => {
  it('pulls the code out of a full redirect URL', () => {
    const url = 'https://example.com/cb?code=v%5E1.1%23i%5E1%23abcdef123456789&expires_in=299';
    assert.equal(extractEbayCode(url), 'v^1.1#i^1#abcdef123456789');
  });

  it('accepts a bare code', () => {
    const code = 'v^1.1#i^1#f^0#r^1#I^3#p^3#t^Ul41Xzk6QjE4';
    assert.equal(extractEbayCode(code), code);
  });

  it('decodes a bare code that is still URL-encoded', () => {
    assert.equal(extractEbayCode('v%5E1.1%23i%5E1%23abcdefghijklmnop'), 'v^1.1#i^1#abcdefghijklmnop');
  });

  it('tolerates surrounding whitespace from a sloppy paste', () => {
    assert.equal(extractEbayCode('  https://example.com/cb?code=abcdefghij1234567890  '), 'abcdefghij1234567890');
  });

  it('returns null for an error redirect with no code', () => {
    assert.equal(extractEbayCode('https://example.com/cb?error=access_denied'), null);
  });

  it('returns null for junk', () => {
    for (const bad of ['', '   ', 'nope', 'short', 'i pasted the wrong thing']) {
      assert.equal(extractEbayCode(bad), null, JSON.stringify(bad));
    }
  });
});

describe('updateEnv', () => {
  const cwd = process.cwd();
  let dir: string;

  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reseller-env-'));
    process.chdir(dir);
  });

  after(() => {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('replaces an existing key in place, keeping comments and other keys', () => {
    fs.writeFileSync(
      '.env',
      '# a comment\nPORT=3000\nEBAY_CLIENT_ID=old-value\nBRAND_NAME=My Closet\n',
    );
    updateEnv({ EBAY_CLIENT_ID: 'new-value' });

    const lines = fs.readFileSync('.env', 'utf8').split('\n');
    assert.ok(lines.includes('# a comment'), 'comment survived');
    assert.ok(lines.includes('PORT=3000'));
    assert.ok(lines.includes('BRAND_NAME=My Closet'));
    assert.ok(lines.includes('EBAY_CLIENT_ID=new-value'));
    assert.equal(lines.filter((l) => l.startsWith('EBAY_CLIENT_ID=')).length, 1, 'no duplicate');
  });

  it('appends a key that is not present yet', () => {
    fs.writeFileSync('.env', 'PORT=3000\n');
    updateEnv({ EBAY_REFRESH_TOKEN: 'tok' });
    assert.match(fs.readFileSync('.env', 'utf8'), /^EBAY_REFRESH_TOKEN=tok$/m);
  });

  it('writes several keys at once', () => {
    fs.writeFileSync('.env', 'PORT=3000\n');
    updateEnv({ A_ONE: '1', A_TWO: '2', A_THREE: '3' });
    const text = fs.readFileSync('.env', 'utf8');
    for (const [k, v] of [['A_ONE', '1'], ['A_TWO', '2'], ['A_THREE', '3']]) {
      assert.match(text, new RegExp(`^${k}=${v}$`, 'm'));
    }
  });

  it('matches a key even with odd spacing', () => {
    fs.writeFileSync('.env', '  EBAY_CONDITION = USED_GOOD\n');
    updateEnv({ EBAY_CONDITION: 'NEW' });
    const text = fs.readFileSync('.env', 'utf8');
    assert.match(text, /^EBAY_CONDITION=NEW$/m);
    assert.equal(text.split('\n').filter((l) => l.includes('EBAY_CONDITION')).length, 1);
  });

  it('does not let a key with regex characters match the wrong line', () => {
    fs.writeFileSync('.env', 'EBAY_CLIENT_ID=keep-me\n');
    updateEnv({ 'EBAY.CLIENT.ID': 'other' });
    const text = fs.readFileSync('.env', 'utf8');
    assert.match(text, /^EBAY_CLIENT_ID=keep-me$/m, 'the dotted key must not match the underscored one');
  });

  it('creates .env from .env.example when there is no .env', () => {
    fs.rmSync('.env', { force: true });
    fs.writeFileSync('.env.example', '# template\nPORT=3000\nEBAY_CLIENT_ID=\n');
    updateEnv({ EBAY_CLIENT_ID: 'from-example' });

    const text = fs.readFileSync('.env', 'utf8');
    assert.match(text, /# template/);
    assert.match(text, /^EBAY_CLIENT_ID=from-example$/m);
  });

  it('keeps .env readable only by its owner', () => {
    updateEnv({ SECRET_THING: 'x' });
    // .env holds live API secrets, so 0600 is the point, not a nicety.
    assert.equal(fs.statSync('.env').mode & 0o777, 0o600);
  });
});
