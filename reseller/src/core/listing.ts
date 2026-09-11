import { config } from '../config.js';
import { getMediaForProduct } from '../db/index.js';
import { absolutePath } from './media.js';
import { trimToLength } from './text.js';
import type { ChannelAdapter, MediaAsset, Product, PublishContext } from './types.js';
import { mediaUrl } from '../config.js';
import { PermanentError } from './types.js';

export function formatPrice(priceCents: number | null, currency: string): string {
  if (priceCents === null) return '';
  const amount = priceCents / 100;
  try {
    return (
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
      })
        .format(amount)
        // Intl separates an unknown currency code from the number with a
        // non-breaking space, which reads as a stray character once it's
        // pasted into a marketplace form.
        .replace(/\u00a0/g, ' ')
    );
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Build a listing description from the structured fields when the seller
 * didn't write one. Keeps every listing consistent and saves the retyping
 * that cross-posting by hand turns into.
 */
export function buildDescription(product: Product): string {
  if (product.description && product.description.trim()) return product.description.trim();

  const lines: string[] = [product.title, ''];
  const facts: [string, string | null][] = [
    ['Brand', product.brand],
    ['Size', product.size],
    ['Colour', product.color],
    ['Condition', product.condition],
    ['Category', product.category],
  ];
  for (const [label, value] of facts) {
    if (value && value.trim()) lines.push(`${label}: ${value.trim()}`);
  }
  lines.push('', 'Ships fast and carefully packed. Message me with any questions!');
  return lines.join('\n');
}

/** Normalize a tag into a hashtag token: "Air Max 90" -> "#airmax90". */
function toHashtag(raw: string): string | null {
  const token = raw.replace(/[^a-zA-Z0-9]/g, '');
  return token ? `#${token.toLowerCase()}` : null;
}

/**
 * Caption for the social channels. Marketplaces get `description`; Instagram,
 * Facebook and Snapchat get this -- shorter, with the price up front and
 * hashtags at the end.
 */
export function buildCaption(product: Product): string {
  const price = formatPrice(product.priceCents, product.currency);
  const head = price ? `${product.title} — ${price}` : product.title;

  const details = [
    product.brand,
    product.size ? `Size ${product.size}` : null,
    product.condition,
  ].filter((v): v is string => Boolean(v && v.trim()));

  const seeds = [...product.tags, product.brand, product.category].filter(
    (v): v is string => Boolean(v && v.trim()),
  );
  const hashtags = [...new Set(seeds.map(toHashtag).filter((v): v is string => v !== null))];
  if (config.brand.handle) hashtags.unshift(config.brand.handle);

  return [
    head,
    details.length ? details.join(' · ') : null,
    config.brand.callToAction || null,
    hashtags.length ? hashtags.join(' ') : null,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Photos in the shape a given channel wants, capped at its photo limit.
 * Channels that crop to a square thumbnail (Poshmark, Depop) get the
 * letterboxed 1:1 renders so nothing important is cut off; everyone else gets
 * the full-frame originals.
 */
function selectPhotos(all: MediaAsset[], adapter: ChannelAdapter): MediaAsset[] {
  const role = adapter.capabilities.prefersSquarePhotos ? 'square' : 'original';
  const pool = all.filter((m) => m.role === role).sort((a, b) => a.position - b.position);
  // Fall back to originals if square renders are missing (e.g. older products).
  const chosen = pool.length ? pool : all.filter((m) => m.role === 'original');
  return chosen.slice(0, Math.max(1, adapter.capabilities.maxPhotos));
}

export function buildPublishContext(
  product: Product,
  adapter: ChannelAdapter,
  log: (message: string) => void,
): PublishContext {
  const media = getMediaForProduct(product.id);
  const photos = selectPhotos(media, adapter);
  const storyImage = media.find((m) => m.role === 'story');

  if (photos.length === 0) {
    throw new PermanentError('This product has no photos, so there is nothing to post.');
  }
  if (adapter.capabilities.publishesStory && !storyImage) {
    throw new PermanentError('No story image was rendered for this product.');
  }
  if (adapter.capabilities.usesPrice && product.priceCents === null) {
    throw new PermanentError(`${adapter.label} needs a price before it will accept a listing.`);
  }

  const caps = adapter.capabilities;

  return {
    product,
    photos,
    storyImage,
    title: trimToLength(product.title, caps.titleMaxLength),
    description: trimToLength(buildDescription(product), caps.descriptionMaxLength),
    caption: adapter.kind === 'social' ? buildCaption(product) : undefined,
    priceCents: product.priceCents,
    currency: product.currency,
    filePath: absolutePath,
    publicUrl: (asset) => mediaUrl(asset.relativePath),
    log,
  };
}
