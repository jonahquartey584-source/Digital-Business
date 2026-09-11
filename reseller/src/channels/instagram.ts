import { hasPublicUrl } from '../config.js';
import { PermanentError } from '../core/types.js';
import type {
  ChannelAdapter,
  ChannelCapabilities,
  PublishContext,
  PublishResult,
} from '../core/types.js';
import { graphGet, graphPost, waitForContainer } from './graph.js';
import { missingEnv } from './http.js';

const baseCapabilities: ChannelCapabilities = {
  titleMaxLength: 125,
  descriptionMaxLength: 2200,
  maxPhotos: 10,
  usesPrice: false,
  publishesStory: false,
  needsPublicImageUrls: true,
  prefersSquarePhotos: false,
};

function credentials() {
  return {
    userId: process.env.INSTAGRAM_USER_ID ?? '',
    token: process.env.INSTAGRAM_ACCESS_TOKEN ?? '',
  };
}

function checkConfig(): string[] {
  const missing = missingEnv('INSTAGRAM_USER_ID', 'INSTAGRAM_ACCESS_TOKEN');
  if (!hasPublicUrl()) missing.push('PUBLIC_BASE_URL (must be a public https URL)');
  return missing;
}

/**
 * Two-step publish, the same for stories and feed posts: create a container
 * pointing at a public image URL, then publish the container.
 */
async function publishMedia(
  ctx: PublishContext,
  params: Record<string, string | undefined>,
  label: string,
): Promise<PublishResult> {
  const { userId, token } = credentials();

  ctx.log(`Creating Instagram ${label} container`);
  const container = await graphPost<{ id: string }>('Instagram', `${userId}/media`, token, params);
  if (!container?.id) throw new Error('Instagram did not return a media container id');

  await waitForContainer('Instagram', container.id, token, ctx.log);

  ctx.log(`Publishing Instagram ${label}`);
  const published = await graphPost<{ id: string }>(
    'Instagram',
    `${userId}/media_publish`,
    token,
    { creation_id: container.id },
  );
  if (!published?.id) throw new Error('Instagram did not return a published media id');

  // Stories have no permalink; feed posts do.
  let permalink: string | undefined;
  try {
    const meta = await graphGet<{ permalink?: string }>(
      'Instagram',
      published.id,
      token,
      { fields: 'permalink' },
    );
    permalink = meta.permalink;
  } catch {
    permalink = undefined;
  }

  return {
    status: 'posted',
    externalId: published.id,
    externalUrl: permalink,
    message: `Posted to Instagram ${label}`,
  };
}

export const instagramStoryAdapter: ChannelAdapter = {
  id: 'instagram_story',
  label: 'Instagram Story',
  kind: 'social',
  mode: 'api',
  note:
    'Official Graph API. Needs an Instagram Business or Creator account linked to a Facebook Page. Posts the generated 1080x1920 story image.',
  capabilities: { ...baseCapabilities, maxPhotos: 1, publishesStory: true },

  missingConfig: checkConfig,

  async publish(ctx: PublishContext): Promise<PublishResult> {
    if (!ctx.storyImage) throw new PermanentError('No story image available.');
    // The Stories endpoint ignores `caption`, so the text is baked into the image.
    return publishMedia(
      ctx,
      { media_type: 'STORIES', image_url: ctx.publicUrl(ctx.storyImage) },
      'story',
    );
  },
};

export const instagramFeedAdapter: ChannelAdapter = {
  id: 'instagram_feed',
  label: 'Instagram Feed',
  kind: 'social',
  mode: 'api',
  note: 'Official Graph API. Posts the first photo to your grid with the generated caption.',
  capabilities: { ...baseCapabilities, maxPhotos: 1 },

  missingConfig: checkConfig,

  async publish(ctx: PublishContext): Promise<PublishResult> {
    const photo = ctx.photos[0];
    if (!photo) throw new PermanentError('No photo available.');
    return publishMedia(
      ctx,
      { image_url: ctx.publicUrl(photo), caption: ctx.caption },
      'feed',
    );
  },
};
