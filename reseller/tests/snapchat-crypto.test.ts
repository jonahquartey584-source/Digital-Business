import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { describe, it } from 'node:test';
import {
  chunkMedia,
  decryptMedia,
  encryptMedia,
  generateEncryption,
} from '../src/channels/snapchat-crypto.js';

describe('generateEncryption', () => {
  it('produces a 32-byte key and 16-byte IV', () => {
    const e = generateEncryption();
    assert.equal(e.key.length, 32);
    assert.equal(e.iv.length, 16);
  });

  it('base64-encodes both for the media-container request', () => {
    const e = generateEncryption();
    assert.equal(Buffer.from(e.keyBase64, 'base64').toString('hex'), e.key.toString('hex'));
    assert.equal(Buffer.from(e.ivBase64, 'base64').toString('hex'), e.iv.toString('hex'));
  });

  it('does not reuse a key across calls', () => {
    assert.notEqual(generateEncryption().keyBase64, generateEncryption().keyBase64);
  });
});

describe('encryptMedia', () => {
  it('round-trips the exact bytes', () => {
    const e = generateEncryption();
    const original = crypto.randomBytes(50_000);
    assert.deepEqual(decryptMedia(encryptMedia(original, e), e), original);
  });

  it('pads to a whole number of AES blocks', () => {
    const e = generateEncryption();
    // 100 bytes is not a block multiple; PKCS#7 must round it up to 112.
    const encrypted = encryptMedia(Buffer.alloc(100, 7), e);
    assert.equal(encrypted.length % 16, 0);
    assert.equal(encrypted.length, 112);
  });

  it('does not produce the plaintext', () => {
    const e = generateEncryption();
    const plaintext = Buffer.from('a'.repeat(1000));
    assert.notEqual(encryptMedia(plaintext, e).toString('hex'), plaintext.toString('hex'));
  });
});

describe('chunkMedia', () => {
  it('splits into chunks that rejoin to the original', () => {
    const data = crypto.randomBytes(5000);
    const chunks = chunkMedia(data, 1024);
    assert.equal(chunks.length, 5);
    assert.deepEqual(Buffer.concat(chunks), data);
  });

  it('returns a single chunk when the media fits', () => {
    const data = crypto.randomBytes(900);
    assert.equal(chunkMedia(data, 1024).length, 1);
  });

  it('keeps every chunk but the last on a block boundary', () => {
    const chunks = chunkMedia(crypto.randomBytes(5000), 1024);
    for (const chunk of chunks.slice(0, -1)) {
      assert.equal(chunk.length % 16, 0);
    }
  });

  it('rejects a chunk size that would break AES blocks', () => {
    assert.throws(() => chunkMedia(Buffer.alloc(64), 1000), /multiple of the 16-byte AES block/);
  });

  it('rejects a nonsense chunk size', () => {
    assert.throws(() => chunkMedia(Buffer.alloc(64), 0), /positive integer/);
  });

  it('returns nothing for empty media', () => {
    assert.deepEqual(chunkMedia(Buffer.alloc(0), 1024), []);
  });
});
