import fs from 'node:fs/promises';
import { PermanentError } from '../core/types.js';
import type { ChannelAdapter, PublishContext, PublishResult } from '../core/types.js';
import { apiRequest, getAccessToken, missingEnv } from './http.js';

const BASE = 'https://api.etsy.com/v3/application';

async function token(): Promise<string> {
  return getAccessToken('etsy', () =>
    apiRequest<{ access_token: string; expires_in: number }>(
      'https://api.etsy.com/v3/public/oauth/token',
      {
        channel: 'Etsy (auth)',
        method: 'POST',
        json: {
          grant_type: 'refresh_token',
          client_id: process.env.ETSY_API_KEY,
          refresh_token: process.env.ETSY_REFRESH_TOKEN,
        },
      },
    ),
  );
}

/** Etsy allows 13 tags of at most 20 characters, letters and spaces only. */
function etsyTags(tags: string[]): string {
  return tags
    .map((t) => t.replace(/[^a-zA-Z0-9 ]/g, '').trim().slice(0, 20))
    .filter(Boolean)
    .slice(0, 13)
    .join(',');
}

export const etsyAdapter: ChannelAdapter = {
  id: 'etsy',
  label: 'Etsy',
  kind: 'marketplace',
  mode: 'api',
  note:
    'Official Open API v3. Creates the listing as a draft, uploads your photos, then flips it to active.',
  capabilities: {
    titleMaxLength: 140,
    descriptionMaxLength: 13_000,
    maxPhotos: 10,
    usesPrice: true,
    publishesStory: false,
    needsPublicImageUrls: false,
    prefersSquarePhotos: false,
  },

  missingConfig() {
    return missingEnv(
      'ETSY_API_KEY',
      'ETSY_REFRESH_TOKEN',
      'ETSY_SHOP_ID',
      'ETSY_SHIPPING_PROFILE_ID',
      'ETSY_TAXONOMY_ID',
    );
  },

  async publish(ctx: PublishContext): Promise<PublishResult> {
    if (ctx.priceCents === null) throw new PermanentError('Etsy requires a price.');

    const accessToken = await token();
    const apiKey = process.env.ETSY_API_KEY ?? '';
    const shopId = process.env.ETSY_SHOP_ID ?? '';
    const headers = { Authorization: `Bearer ${accessToken}`, 'x-api-key': apiKey };

    /* 1. Draft listing. Etsy's create endpoint takes form encoding, not JSON. */
    const form = new URLSearchParams({
      quantity: String(Math.max(1, ctx.product.quantity)),
      title: ctx.title,
      description: ctx.description,
      price: (ctx.priceCents / 100).toFixed(2),
      who_made: process.env.ETSY_WHO_MADE || 'someone_else',
      when_made: process.env.ETSY_WHEN_MADE || 'before_2004',
      taxonomy_id: process.env.ETSY_TAXONOMY_ID ?? '',
      shipping_profile_id: process.env.ETSY_SHIPPING_PROFILE_ID ?? '',
      is_supply: 'false',
      state: 'draft',
    });
    const tags = etsyTags(ctx.product.tags);
    if (tags) form.set('tags', tags);
    if (process.env.ETSY_RETURN_POLICY_ID) {
      form.set('return_policy_id', process.env.ETSY_RETURN_POLICY_ID);
    }

    ctx.log('Creating Etsy draft listing');
    const listing = await apiRequest<{ listing_id: number; url?: string }>(
      `${BASE}/shops/${shopId}/listings`,
      {
        channel: 'Etsy',
        tokenKey: 'etsy',
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      },
    );
    if (!listing?.listing_id) throw new Error('Etsy did not return a listing_id');
    const listingId = listing.listing_id;

    /* 2. Photos, one multipart upload each, in display order. */
    for (const [index, photo] of ctx.photos.entries()) {
      const buffer = await fs.readFile(ctx.filePath(photo));
      const body = new FormData();
      body.set('image', new Blob([new Uint8Array(buffer)], { type: 'image/jpeg' }), `photo-${index + 1}.jpg`);
      body.set('rank', String(index + 1));

      ctx.log(`Uploading photo ${index + 1}/${ctx.photos.length} to Etsy`);
      await apiRequest(`${BASE}/shops/${shopId}/listings/${listingId}/images`, {
        channel: 'Etsy',
        tokenKey: 'etsy',
        method: 'POST',
        headers,
        body,
      });
    }

    /* 3. Activate. A draft with no images is rejected, hence this ordering. */
    ctx.log('Activating Etsy listing');
    await apiRequest(`${BASE}/shops/${shopId}/listings/${listingId}`, {
      channel: 'Etsy',
      tokenKey: 'etsy',
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ state: 'active' }).toString(),
    });

    return {
      status: 'posted',
      externalId: String(listingId),
      externalUrl: listing.url ?? `https://www.etsy.com/listing/${listingId}`,
      message: `Live on Etsy as listing ${listingId}`,
    };
  },
};
