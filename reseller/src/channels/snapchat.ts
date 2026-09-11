import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { PermanentError } from '../core/types.js';
import type { ChannelAdapter, PublishContext, PublishResult } from '../core/types.js';

/**
 * The manual fallback for any story a server genuinely cannot post to:
 *
 *  - a *personal* Snapchat My Story (the Public Profile API in
 *    snapchat-api.ts covers public profiles, but not personal accounts)
 *  - a *personal* Facebook profile story (Meta has no API for these at all)
 *  - any of the above while an API allowlist or token is still pending
 *
 * It drops the finished 1080x1920 story and its caption into an outbox and
 * serves a one-tap handoff page. Everything up to the tap is automated.
 */
export const storyHandoffAdapter: ChannelAdapter = {
  id: 'story_handoff',
  label: 'Story handoff (phone)',
  kind: 'social',
  mode: 'assist',
  note:
    'For personal accounts, which no API can post to. Prepares the story image + caption and gives you a phone page — open it, save, post. Works for personal Snapchat, Instagram and Facebook stories.',
  capabilities: {
    titleMaxLength: 80,
    descriptionMaxLength: 250,
    maxPhotos: 1,
    usesPrice: false,
    publishesStory: true,
    needsPublicImageUrls: false,
    prefersSquarePhotos: false,
  },

  // Nothing to configure -- it works out of the box.
  missingConfig() {
    return [];
  },

  async publish(ctx: PublishContext): Promise<PublishResult> {
    if (!ctx.storyImage) throw new PermanentError('No story image available.');

    const dir = path.join(config.paths.outbox, 'handoff', String(ctx.product.id));
    await fs.mkdir(dir, { recursive: true });

    const imagePath = path.join(dir, 'story.jpg');
    const captionPath = path.join(dir, 'caption.txt');

    await fs.copyFile(ctx.filePath(ctx.storyImage), imagePath);
    await fs.writeFile(captionPath, ctx.caption ?? ctx.title, 'utf8');

    ctx.log(`Story asset ready in ${dir}`);

    const handoff = `${config.publicBaseUrl}/handoff/${ctx.product.id}`;
    return {
      status: 'needs_action',
      externalUrl: handoff,
      message: 'Story image and caption are ready — open the handoff page on your phone to post.',
      artifacts: [imagePath, captionPath],
    };
  },
};
