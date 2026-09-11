import fs from 'node:fs/promises';
import { PermanentError } from '../core/types.js';
import type { ChannelAdapter, PublishContext, PublishResult } from '../core/types.js';
import { apiRequest, missingEnv } from './http.js';

interface ShopifyProduct {
  product?: { id: number; handle: string };
}

export const shopifyAdapter: ChannelAdapter = {
  id: 'shopify',
  label: 'Shopify',
  kind: 'marketplace',
  mode: 'api',
  note:
    'Official Admin API. Photos are sent inline as base64, so this one works without a public URL.',
  capabilities: {
    titleMaxLength: 255,
    descriptionMaxLength: 60_000,
    maxPhotos: 20,
    usesPrice: true,
    publishesStory: false,
    needsPublicImageUrls: false,
    prefersSquarePhotos: false,
  },

  missingConfig() {
    return missingEnv('SHOPIFY_STORE_DOMAIN', 'SHOPIFY_ADMIN_TOKEN');
  },

  async publish(ctx: PublishContext): Promise<PublishResult> {
    if (ctx.priceCents === null) throw new PermanentError('Shopify requires a price.');

    const domain = (process.env.SHOPIFY_STORE_DOMAIN ?? '').replace(/^https?:\/\//, '');
    const version = process.env.SHOPIFY_API_VERSION || '2025-01';

    // Shopify accepts the bytes directly, which keeps this channel working on
    // a laptop with no tunnel -- unlike eBay/Instagram, which must fetch a URL.
    const images = await Promise.all(
      ctx.photos.map(async (photo, index) => ({
        attachment: (await fs.readFile(ctx.filePath(photo))).toString('base64'),
        filename: `photo-${index + 1}.jpg`,
        position: index + 1,
      })),
    );

    ctx.log(`Creating Shopify product with ${images.length} photo(s)`);
    const created = await apiRequest<ShopifyProduct>(
      `https://${domain}/admin/api/${version}/products.json`,
      {
        channel: 'Shopify',
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN ?? '',
          'Content-Type': 'application/json',
        },
        json: {
          product: {
            title: ctx.title,
            body_html: ctx.description.replace(/\n/g, '<br>'),
            vendor: ctx.product.brand || undefined,
            product_type: ctx.product.category || undefined,
            tags: ctx.product.tags.join(', '),
            status: 'active',
            variants: [
              {
                price: (ctx.priceCents / 100).toFixed(2),
                sku: ctx.product.sku,
                inventory_quantity: Math.max(1, ctx.product.quantity),
                inventory_management: 'shopify',
                option1: ctx.product.size || 'Default Title',
              },
            ],
            options: ctx.product.size ? [{ name: 'Size', values: [ctx.product.size] }] : undefined,
            images,
          },
        },
      },
    );

    const id = created?.product?.id;
    if (!id) throw new Error('Shopify did not return a product id');

    return {
      status: 'posted',
      externalId: String(id),
      externalUrl: created.product?.handle
        ? `https://${domain}/products/${created.product.handle}`
        : `https://${domain}/admin/products/${id}`,
      message: `Created Shopify product ${id}`,
    };
  },
};
