import crypto from 'node:crypto';

/**
 * Snapchat's Public Profile API does not take a plain image upload. You
 * generate an AES key and IV yourself, hand Snapchat the base64 of both when
 * you create the media container, then upload the *encrypted* bytes in chunks.
 * Snapchat decrypts on their side.
 *
 * This module is the part of that flow that can be tested without an account,
 * so it is kept separate from the adapter and covered directly.
 */

/** AES-256-CBC: a 32-byte key and a 16-byte IV. */
const KEY_BYTES = 32;
const IV_BYTES = 16;

export interface MediaEncryption {
  key: Buffer;
  iv: Buffer;
  /** What goes in the media-container request. */
  keyBase64: string;
  ivBase64: string;
}

export function generateEncryption(): MediaEncryption {
  const key = crypto.randomBytes(KEY_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  return {
    key,
    iv,
    keyBase64: key.toString('base64'),
    ivBase64: iv.toString('base64'),
  };
}

/** Encrypt the media with PKCS#7 padding, which is Node's CBC default. */
export function encryptMedia(plaintext: Buffer, encryption: MediaEncryption): Buffer {
  const cipher = crypto.createCipheriv('aes-256-cbc', encryption.key, encryption.iv);
  return Buffer.concat([cipher.update(plaintext), cipher.final()]);
}

/** Inverse of encryptMedia. Only used by the tests, to prove the round trip. */
export function decryptMedia(ciphertext: Buffer, encryption: MediaEncryption): Buffer {
  const decipher = crypto.createDecipheriv('aes-256-cbc', encryption.key, encryption.iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Split the encrypted media for chunked upload.
 *
 * Chunk boundaries must land on AES block boundaries, or a chunk that is
 * reassembled server-side decrypts to garbage. A story JPEG is well under one
 * chunk in practice, but video is not, so the constraint is enforced here
 * rather than assumed away.
 */
export function chunkMedia(data: Buffer, chunkSize: number): Buffer[] {
  if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
    throw new Error(`chunkSize must be a positive integer, got ${chunkSize}`);
  }
  if (chunkSize % IV_BYTES !== 0) {
    throw new Error(`chunkSize must be a multiple of the ${IV_BYTES}-byte AES block size`);
  }
  if (data.length === 0) return [];

  const chunks: Buffer[] = [];
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    chunks.push(data.subarray(offset, Math.min(offset + chunkSize, data.length)));
  }
  return chunks;
}
