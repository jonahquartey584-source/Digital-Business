import sharp from 'sharp';
import { apiRequest } from '../channels/http.js';
import { snapchatMissingConfig, snapchatToken } from '../channels/snapchat-api.js';
import { encryptMedia, generateEncryption } from '../channels/snapchat-crypto.js';

/**
 * Checks a Snapchat Public Profile API setup and prints the RAW responses.
 *
 * The adapter looks up response values through a list of candidate field
 * paths, because Snap's docs were not reachable when it was written. This
 * command is how you close that gap: it shows exactly what the API returns, so
 * you can confirm the paths in snapchat-api.ts or correct them in one line.
 *
 * Nothing is posted. With --media it creates a media container (which expires
 * on its own after 24h) but never publishes a story.
 */

const API = 'https://businessapi.snapchat.com/v1';
const wantsMedia = process.argv.includes('--media');

function show(label: string, value: unknown): void {
  console.log(`\n── ${label} ${'─'.repeat(Math.max(0, 60 - label.length))}`);
  console.log(JSON.stringify(value, null, 2));
}

const missing = snapchatMissingConfig();
if (missing.length > 0) {
  console.error('\n  Snapchat is not configured yet. Missing:');
  for (const name of missing) console.error(`    · ${name}`);
  console.error('\n  See the Snapchat section of README.md.\n');
  process.exit(1);
}

const profileId = process.env.SNAPCHAT_PROFILE_ID ?? '';

console.log('\n  Checking Snapchat Public Profile API access…');

/* 1. Token. A failure here is credentials, not the allowlist. */
let accessToken: string;
try {
  accessToken = await snapchatToken();
  console.log('  ✓ Got an access token');
} catch (err) {
  console.error(`\n  ✗ Could not get an access token: ${err instanceof Error ? err.message : err}`);
  console.error('    Check SNAPCHAT_CLIENT_ID / SECRET / REFRESH_TOKEN.\n');
  process.exit(1);
}

const auth = { Authorization: `Bearer ${accessToken}` };

/* 2. Read the profile. A 403 here usually means the allowlist is still pending. */
try {
  const profile = await apiRequest<unknown>(`${API}/public_profiles/${profileId}`, {
    channel: 'Snapchat',
    headers: auth,
  });
  console.log('  ✓ Read your public profile');
  show('GET /public_profiles/{id}', profile);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n  ✗ Could not read the profile: ${message}`);
  if (/403|not authorized|permission/i.test(message)) {
    console.error('    A 403 here almost always means your client ID is not on');
    console.error('    Snap\'s Public Profile API allowlist yet, or SNAPCHAT_PROFILE_ID is wrong.');
  }
  console.error('');
  process.exit(1);
}

/* 3. Optionally create a media container, to see the real response shape. */
if (wantsMedia) {
  console.log('\n  Creating a throwaway media container (nothing is posted)…');

  const image = await sharp({
    create: { width: 1080, height: 1920, channels: 3, background: '#101418' },
  })
    .jpeg()
    .toBuffer();

  const encryption = generateEncryption();
  const encrypted = encryptMedia(image, encryption);

  try {
    const created = await apiRequest<unknown>(`${API}/public_profiles/${profileId}/media`, {
      channel: 'Snapchat',
      method: 'POST',
      headers: auth,
      json: {
        media: [
          {
            name: 'verify-test.jpg',
            type: 'IMAGE',
            encryption_key: encryption.keyBase64,
            encryption_iv: encryption.ivBase64,
          },
        ],
      },
    });
    console.log(`  ✓ Media container created (${encrypted.length} encrypted bytes ready)`);
    show('POST /public_profiles/{id}/media', created);
    console.log('\n  Compare the media id and upload URL above against');
    console.log('  MEDIA_ID_PATHS and UPLOAD_URL_PATHS in src/channels/snapchat-api.ts.');
    console.log('  If neither list contains the right path, add it to the front.');
  } catch (err) {
    console.error(`\n  ✗ Media container failed: ${err instanceof Error ? err.message : err}`);
    console.error('    The request body field names may differ — see README.\n');
    process.exit(1);
  }
} else {
  console.log('\n  Re-run with --media to also print the media-container response,');
  console.log('  which is what the adapter parses:  npm run snapchat:verify -- --media');
}

console.log('\n  Done. Nothing was posted.\n');
