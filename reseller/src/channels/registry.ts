import type { ChannelAdapter } from '../core/types.js';
import { ebayAdapter } from './ebay.js';
import { etsyAdapter } from './etsy.js';
import { shopifyAdapter } from './shopify.js';
import { instagramFeedAdapter, instagramStoryAdapter } from './instagram.js';
import { facebookPageAdapter, facebookStoryAdapter } from './facebook.js';
import { snapchatAdapter } from './snapchat.js';
import {
  depopAdapter,
  facebookMarketplaceAdapter,
  mercariAdapter,
  offerupAdapter,
  poshmarkAdapter,
} from './browser/index.js';

/** Every channel the system can post to, in the order the UI lists them. */
export const adapters: ChannelAdapter[] = [
  // Marketplaces with an official API — fully automatic and reliable.
  ebayAdapter,
  etsyAdapter,
  shopifyAdapter,
  // Marketplaces with no API — driven through your logged-in browser.
  poshmarkAdapter,
  depopAdapter,
  mercariAdapter,
  facebookMarketplaceAdapter,
  offerupAdapter,
  // Social.
  instagramStoryAdapter,
  instagramFeedAdapter,
  facebookStoryAdapter,
  facebookPageAdapter,
  snapchatAdapter,
];

const byId = new Map(adapters.map((a) => [a.id, a]));

export function getAdapter(id: string): ChannelAdapter | undefined {
  return byId.get(id);
}

export function channelIds(): string[] {
  return adapters.map((a) => a.id);
}

/** Shape the UI needs to render the channel picker and setup checklist. */
export function describeChannels() {
  return adapters.map((a) => {
    const missing = a.missingConfig();
    return {
      id: a.id,
      label: a.label,
      kind: a.kind,
      mode: a.mode,
      note: a.note ?? null,
      ready: missing.length === 0,
      missing,
      capabilities: a.capabilities,
    };
  });
}
