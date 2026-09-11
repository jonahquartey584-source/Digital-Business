import fs from 'node:fs/promises';
import path from 'node:path';
import { PermanentError } from '../core/types.js';
import type { ChannelAdapter, PublishContext, PublishResult } from '../core/types.js';
import { apiRequest, getAccessToken, missingEnv } from './http.js';
import { chunkMedia, encryptMedia, generateEncryption } from './snapchat-crypto.js';

const API = 'https://businessapi.snapchat.com/v1';
const TOKEN_URL = 'https://accounts.snapchat.com/login/oauth2/access_token';
const SCOPE = 'snapchat-profile-api';

/** Chunk size for the encrypted upload. Must be an AES-block multiple. */
const CHUNK_BYTES = 4 * 1024 * 1024;

/* ---------------------------------------------------------------------------
 * FIELD NAMES TO VERIFY
 *
 * The endpoint paths and the overall flow below are from Snap's Public Profile
 * API docs (media container -> encrypted chunked upload -> story post). The
 * exact JSON *field names* in the responses could not be read directly from
 * developers.snap.com, so every response value is looked up through a list of
 * candidate paths rather than a single hard-coded one, and the raw response is
 * logged the first time a lookup misses.
 *
 * When you get your allowlist approval, run `npm run snapchat:verify`. It
 * prints the real response shapes. If a lookup below is missing the right
 * path, add it to the front of the relevant array -- that is the whole fix.
 * ------------------------------------------------------------------------- */

const MEDIA_ID_PATHS = [
  'media.0.media.id',
  'media.0.id',
  'media.id',
  'id',
  'media_id',
];

const UPLOAD_URL_PATHS = [
  'media.0.media.upload_url',
  'media.0.upload_url',
  'media.upload_url',
  'upload_url',
  'upload_endpoints.0',
  'media.0.media.upload_endpoints.0',
];

const STORY_ID_PATHS = [
  'stories.0.story.id',
  'stories.0.id',
  'story.id',
  'id',
  'story_id',
];

/** Read a dotted path out of an unknown JSON value, tolerating array indices. */
function readPath(source: unknown, dotted: string): unknown {
  let current: unknown = source;
  for (const segment of dotted.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * First candidate path that yields a non-empty string. Throws with the raw
 * response attached, so a wrong guess is a one-line fix rather than a mystery.
 */
function pick(source: unknown, paths: string[], what: string): string {
  for (const candidate of paths) {
    const value = readPath(source, candidate);
    if (typeof value === 'string' && value !== '') return value;
    if (typeof value === 'number') return String(value);
  }
  throw new PermanentError(
    `Snapchat: could not find the ${what} in the response. ` +
      `Tried ${paths.join(', ')}. Add the correct path to snapchat-api.ts. ` +
      `Response was: ${JSON.stringify(source).slice(0, 800)}`,
  );
}

function credentials() {
  return {
    profileId: process.env.SNAPCHAT_PROFILE_ID ?? '',
    clientId: process.env.SNAPCHAT_CLIENT_ID ?? '',
    clientSecret: process.env.SNAPCHAT_CLIENT_SECRET ?? '',
    refreshToken: process.env.SNAPCHAT_REFRESH_TOKEN ?? '',
  };
}

export async function snapchatToken(): Promise<string> {
  const { clientId, clientSecret, refreshToken } = credentials();
  return getAccessToken('snapchat', () =>
    apiRequest<{ access_token: string; expires_in: number }>(TOKEN_URL, {
      channel: 'Snapchat (auth)',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        scope: SCOPE,
      }).toString(),
    }),
  );
}

export function snapchatMissingConfig(): string[] {
  return missingEnv(
    'SNAPCHAT_PROFILE_ID',
    'SNAPCHAT_CLIENT_ID',
    'SNAPCHAT_CLIENT_SECRET',
    'SNAPCHAT_REFRESH_TOKEN',
  );
}

/** Upload the encrypted media, one multipart request per chunk. */
async function uploadChunks(
  uploadUrl: string,
  encrypted: Buffer,
  accessToken: string,
  log: (m: string) => void,
): Promise<void> {
  const chunks = chunkMedia(encrypted, CHUNK_BYTES);

  for (const [index, chunk] of chunks.entries()) {
    const body = new FormData();
    body.set('file', new Blob([new Uint8Array(chunk)], { type: 'application/octet-stream' }), 'story.jpg.enc');
    // Only meaningful for a multi-chunk upload; harmless on a single chunk.
    body.set('chunk_index', String(index));
    body.set('total_chunks', String(chunks.length));

    log(`Uploading encrypted chunk ${index + 1}/${chunks.length} (${chunk.length} bytes)`);
    await apiRequest(uploadUrl, {
      channel: 'Snapchat',
      tokenKey: 'snapchat',
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body,
    });
  }
}

export const snapchatStoryAdapter: ChannelAdapter = {
  id: 'snapchat_story',
  label: 'Snapchat Story',
  kind: 'social',
  mode: 'api',
  note:
    'Official Public Profile API. Posts to your Snapchat Public Profile story (free to create in-app). Your client ID must be allowlisted by Snap first — response field names are unverified until you run `npm run snapchat:verify`.',
  capabilities: {
    titleMaxLength: 80,
    descriptionMaxLength: 250,
    maxPhotos: 1,
    usesPrice: false,
    publishesStory: true,
    needsPublicImageUrls: false,
    prefersSquarePhotos: false,
  },

  missingConfig: snapchatMissingConfig,

  async publish(ctx: PublishContext): Promise<PublishResult> {
    if (!ctx.storyImage) throw new PermanentError('No story image available.');

    const { profileId } = credentials();
    const accessToken = await snapchatToken();
    const auth = { Authorization: `Bearer ${accessToken}` };

    /* 1. Encrypt the story image with a key we generate and then disclose. */
    const plaintext = await fs.readFile(ctx.filePath(ctx.storyImage));
    const encryption = generateEncryption();
    const encrypted = encryptMedia(plaintext, encryption);
    ctx.log(`Encrypted story image (${plaintext.length} → ${encrypted.length} bytes)`);

    /* 2. Create the media container, handing over the key and IV. */
    ctx.log('Creating Snapchat media container');
    const created = await apiRequest<unknown>(`${API}/public_profiles/${profileId}/media`, {
      channel: 'Snapchat',
      tokenKey: 'snapchat',
      method: 'POST',
      headers: auth,
      json: {
        media: [
          {
            name: path.basename(ctx.storyImage.relativePath),
            type: 'IMAGE',
            encryption_key: encryption.keyBase64,
            encryption_iv: encryption.ivBase64,
          },
        ],
      },
    });

    const mediaId = pick(created, MEDIA_ID_PATHS, 'media id');
    const uploadUrl = pick(created, UPLOAD_URL_PATHS, 'upload URL');
    ctx.log(`Media container ${mediaId} created`);

    /* 3. Upload the encrypted bytes. */
    await uploadChunks(uploadUrl, encrypted, accessToken, ctx.log);

    /* 4. Post it as a story. The caption carries the price and hashtags. */
    ctx.log('Posting Snapchat story');
    const story = await apiRequest<unknown>(`${API}/public_profiles/${profileId}/stories`, {
      channel: 'Snapchat',
      tokenKey: 'snapchat',
      method: 'POST',
      headers: auth,
      json: {
        stories: [
          {
            media_id: mediaId,
            caption: ctx.caption ?? ctx.title,
          },
        ],
      },
    });

    const storyId = pick(story, STORY_ID_PATHS, 'story id');
    return {
      status: 'posted',
      externalId: storyId,
      message: 'Posted to your Snapchat Public Profile story',
    };
  },
};
