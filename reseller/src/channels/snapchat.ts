import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { PermanentError } from '../core/types.js';
import type { ChannelAdapter, PublishContext, PublishResult } from '../core/types.js';

/**
 * Snapchat deliberately has no public API for posting to My Story. The
 * Marketing API covers paid ads only, and Creative Kit can only hand media to
 * the Snapchat app from inside a native mobile app you've shipped -- neither
 * lets a server post on your behalf.
 *
 * So rather than pretend, this channel does the most it honestly can: it drops
 * the finished 1080x1920 story and its caption into an outbox and gives you a
 * one-tap handoff page. Everything up to the tap is automated.
 */
export const snapchatAdapter: ChannelAdapter = {
  id: 'snapchat',
  label: 'Snapchat Story',
  kind: 'social',
  mode: 'assist',
  note:
    'Snapchat has no API for posting to My Story. This prepares the story image + caption and gives you a phone handoff page — open it, save, and post. One tap, no retyping.',
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

    const dir = path.join(config.paths.outbox, 'snapchat', String(ctx.product.id));
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
