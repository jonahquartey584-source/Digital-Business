import { hasPublicUrl } from '../config.js';
import { PermanentError } from '../core/types.js';
import type {
  ChannelAdapter,
  ChannelCapabilities,
  PublishContext,
  PublishResult,
} from '../core/types.js';
import { graphPost } from './graph.js';
import { missingEnv } from './http.js';

const baseCapabilities: ChannelCapabilities = {
  titleMaxLength: 200,
  descriptionMaxLength: 5000,
  maxPhotos: 1,
  usesPrice: false,
  publishesStory: false,
  needsPublicImageUrls: true,
  prefersSquarePhotos: false,
};

function credentials() {
  return {
    pageId: process.env.FACEBOOK_PAGE_ID ?? '',
    token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? '',
  };
}

function checkConfig(): string[] {
  const missing = missingEnv('FACEBOOK_PAGE_ID', 'FACEBOOK_PAGE_ACCESS_TOKEN');
  if (!hasPublicUrl()) missing.push('PUBLIC_BASE_URL (must be a public https URL)');
  return missing;
}

export const facebookStoryAdapter: ChannelAdapter = {
  id: 'facebook_story',
  label: 'Facebook Story (Page)',
  kind: 'social',
  mode: 'api',
  note:
    'Official Graph API. Posts to your Facebook PAGE story — Meta has no API for a personal profile story, so if you post from your personal account use the Snapchat-style handoff instead.',
  capabilities: { ...baseCapabilities, publishesStory: true },

  missingConfig: checkConfig,

  async publish(ctx: PublishContext): Promise<PublishResult> {
    if (!ctx.storyImage) throw new PermanentError('No story image available.');
    const { pageId, token } = credentials();

    /* Stories are a two-step flow: upload the photo *unpublished* to get a
       photo id, then hand that id to the photo_stories endpoint. */
    ctx.log('Uploading story image to Facebook (unpublished)');
    const photo = await graphPost<{ id: string }>('Facebook', `${pageId}/photos`, token, {
      url: ctx.publicUrl(ctx.storyImage),
      published: 'false',
    });
    if (!photo?.id) throw new Error('Facebook did not return a photo id');

    ctx.log('Publishing Facebook Page story');
    const story = await graphPost<{ post_id?: string; success?: boolean }>(
      'Facebook',
      `${pageId}/photo_stories`,
      token,
      { photo_id: photo.id },
    );

    return {
      status: 'posted',
      externalId: story?.post_id ?? photo.id,
      message: 'Posted to your Facebook Page story',
    };
  },
};

export const facebookPageAdapter: ChannelAdapter = {
  id: 'facebook_page',
  label: 'Facebook Page Post',
  kind: 'social',
  mode: 'api',
  note: 'Official Graph API. Posts the photo and caption to your Page feed (permanent, unlike the story).',
  capabilities: baseCapabilities,

  missingConfig: checkConfig,

  async publish(ctx: PublishContext): Promise<PublishResult> {
    const photo = ctx.photos[0];
    if (!photo) throw new PermanentError('No photo available.');
    const { pageId, token } = credentials();

    ctx.log('Posting photo to Facebook Page feed');
    const res = await graphPost<{ id: string; post_id?: string }>(
      'Facebook',
      `${pageId}/photos`,
      token,
      { url: ctx.publicUrl(photo), caption: ctx.caption, published: 'true' },
    );

    const postId = res?.post_id ?? res?.id;
    return {
      status: 'posted',
      externalId: postId,
      externalUrl: postId ? `https://www.facebook.com/${postId}` : undefined,
      message: 'Posted to your Facebook Page',
    };
  },
};
