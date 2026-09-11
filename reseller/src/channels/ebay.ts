import { hasPublicUrl } from '../config.js';
import { PermanentError } from '../core/types.js';
import type { ChannelAdapter, PublishContext, PublishResult } from '../core/types.js';
import { apiRequest, getAccessToken, missingEnv } from './http.js';

const SCOPE = 'https://api.ebay.com/oauth/api_scope/sell.inventory';

function hosts() {
  const sandbox = (process.env.EBAY_ENV || 'production').toLowerCase() === 'sandbox';
  return {
    api: sandbox ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com',
    web: sandbox ? 'https://sandbox.ebay.com' : 'https://www.ebay.com',
  };
}

/** eBay access tokens last 2h; the refresh token lasts 18 months. */
async function token(): Promise<string> {
  return getAccessToken('ebay', async () => {
    const basic = Buffer.from(
      `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`,
    ).toString('base64');

    return apiRequest<{ access_token: string; expires_in: number }>(
      `${hosts().api}/identity/v1/oauth2/token`,
      {
        channel: 'eBay (auth)',
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: process.env.EBAY_REFRESH_TOKEN ?? '',
          scope: SCOPE,
        }).toString(),
      },
    );
  });
}

function aspects(ctx: PublishContext): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const add = (key: string, value: string | null | undefined) => {
    if (value && value.trim()) out[key] = [value.trim()];
  };
  add('Brand', ctx.product.brand);
  add('Size', ctx.product.size);
  add('Colour', ctx.product.color);
  add('Type', ctx.product.category);
  return out;
}

/**
 * eBay keys an offer by (sku, marketplace), so re-posting a SKU has to update
 * the existing offer instead of creating a second one -- otherwise eBay
 * rejects it with error 25002.
 */
async function findExistingOffer(
  accessToken: string,
  sku: string,
  marketplaceId: string,
): Promise<string | undefined> {
  const res = await apiRequest<{ offers?: { offerId: string; marketplaceId: string }[] }>(
    `${hosts().api}/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}&marketplace_id=${marketplaceId}`,
    { channel: 'eBay', tokenKey: 'ebay', headers: { Authorization: `Bearer ${accessToken}` } },
  ).catch((err: unknown) => {
    // A SKU with no offers yet answers 404; that's the normal first-post path.
    if (err instanceof Error && /returned 404/.test(err.message)) return { offers: [] };
    throw err;
  });
  return res?.offers?.find((o) => o.marketplaceId === marketplaceId)?.offerId;
}

export const ebayAdapter: ChannelAdapter = {
  id: 'ebay',
  label: 'eBay',
  kind: 'marketplace',
  mode: 'api',
  note:
    'Official Sell API. eBay downloads your photos from PUBLIC_BASE_URL, so that URL has to be reachable from the internet.',
  capabilities: {
    titleMaxLength: 80,
    descriptionMaxLength: 500_000,
    maxPhotos: 24,
    usesPrice: true,
    publishesStory: false,
    needsPublicImageUrls: true,
    prefersSquarePhotos: false,
  },

  missingConfig() {
    const missing = missingEnv(
      'EBAY_CLIENT_ID',
      'EBAY_CLIENT_SECRET',
      'EBAY_REFRESH_TOKEN',
      'EBAY_MERCHANT_LOCATION_KEY',
      'EBAY_FULFILLMENT_POLICY_ID',
      'EBAY_PAYMENT_POLICY_ID',
      'EBAY_RETURN_POLICY_ID',
      'EBAY_DEFAULT_CATEGORY_ID',
    );
    if (!hasPublicUrl()) missing.push('PUBLIC_BASE_URL (must be a public https URL)');
    return missing;
  },

  async publish(ctx: PublishContext): Promise<PublishResult> {
    const { api, web } = hosts();
    const accessToken = await token();
    const marketplaceId = process.env.EBAY_MARKETPLACE_ID || 'EBAY_US';
    const sku = ctx.product.sku;
    const authHeaders = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Language': 'en-US',
    };

    if (ctx.priceCents === null) {
      throw new PermanentError('eBay requires a price.');
    }

    /* 1. Inventory item -- the product itself, independent of any listing. */
    ctx.log(`Creating eBay inventory item for SKU ${sku}`);
    await apiRequest(`${api}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
      channel: 'eBay',
      tokenKey: 'ebay',
      method: 'PUT',
      headers: authHeaders,
      json: {
        availability: {
          shipToLocationAvailability: { quantity: Math.max(1, ctx.product.quantity) },
        },
        condition: process.env.EBAY_CONDITION || 'USED_EXCELLENT',
        product: {
          title: ctx.title,
          description: ctx.description,
          imageUrls: ctx.photos.map((p) => ctx.publicUrl(p)),
          aspects: aspects(ctx),
          ...(ctx.product.brand ? { brand: ctx.product.brand } : {}),
        },
      },
    });

    /* 2. Offer -- price, category and the three business policies. */
    const offerPayload = {
      sku,
      marketplaceId,
      format: 'FIXED_PRICE',
      availableQuantity: Math.max(1, ctx.product.quantity),
      categoryId: process.env.EBAY_DEFAULT_CATEGORY_ID,
      listingDescription: ctx.description,
      merchantLocationKey: process.env.EBAY_MERCHANT_LOCATION_KEY,
      listingPolicies: {
        fulfillmentPolicyId: process.env.EBAY_FULFILLMENT_POLICY_ID,
        paymentPolicyId: process.env.EBAY_PAYMENT_POLICY_ID,
        returnPolicyId: process.env.EBAY_RETURN_POLICY_ID,
      },
      pricingSummary: {
        price: { value: (ctx.priceCents / 100).toFixed(2), currency: ctx.currency },
      },
    };

    const existing = await findExistingOffer(accessToken, sku, marketplaceId);
    let offerId: string;

    if (existing) {
      ctx.log(`Updating existing eBay offer ${existing}`);
      await apiRequest(`${api}/sell/inventory/v1/offer/${existing}`, {
        channel: 'eBay',
        tokenKey: 'ebay',
        method: 'PUT',
        headers: authHeaders,
        json: offerPayload,
      });
      offerId = existing;
    } else {
      ctx.log('Creating eBay offer');
      const created = await apiRequest<{ offerId: string }>(`${api}/sell/inventory/v1/offer`, {
        channel: 'eBay',
        tokenKey: 'ebay',
        method: 'POST',
        headers: authHeaders,
        json: offerPayload,
      });
      if (!created?.offerId) throw new Error('eBay did not return an offerId');
      offerId = created.offerId;
    }

    /* 3. Publish -- this is the step that puts it live and returns the item id. */
    ctx.log(`Publishing eBay offer ${offerId}`);
    const published = await apiRequest<{ listingId: string }>(
      `${api}/sell/inventory/v1/offer/${offerId}/publish`,
      { channel: 'eBay', tokenKey: 'ebay', method: 'POST', headers: authHeaders, json: {} },
    );

    const listingId = published?.listingId;
    return {
      status: 'posted',
      externalId: listingId ?? offerId,
      externalUrl: listingId ? `${web}/itm/${listingId}` : undefined,
      message: listingId ? `Live on eBay as item ${listingId}` : 'Offer published',
    };
  },
};
