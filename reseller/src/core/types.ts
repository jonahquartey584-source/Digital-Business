/** Where a channel sits in the funnel. */
export type ChannelKind = 'marketplace' | 'social';

/**
 * How much of the posting a channel can actually do unattended.
 *  - api     : official public API. Fully automatic, reliable.
 *  - browser : no public API; we drive your logged-in browser session.
 *              Automatic, but breaks when the site redesigns.
 *  - assist  : no API and no safe automation path (Snapchat). We prepare the
 *              exact asset + caption and hand it to you to tap once.
 */
export type IntegrationMode = 'api' | 'browser' | 'assist';

export type PostStatus =
  | 'queued'
  | 'running'
  | 'posted'
  | 'needs_action'
  | 'failed'
  | 'skipped';

export interface ChannelCapabilities {
  /** Longest title the channel accepts; titles are trimmed on word boundaries. */
  titleMaxLength: number;
  descriptionMaxLength: number;
  maxPhotos: number;
  /** Channel expects a price (marketplaces) vs. a caption (socials). */
  usesPrice: boolean;
  /** Channel publishes to an ephemeral story rather than a permanent post. */
  publishesStory: boolean;
  /** Channel fetches images from a URL instead of accepting an upload. */
  needsPublicImageUrls: boolean;
  /** Channel displays photos as squares, so send the letterboxed 1:1 renders. */
  prefersSquarePhotos: boolean;
}

export interface Product {
  id: number;
  title: string;
  description: string | null;
  priceCents: number | null;
  currency: string;
  quantity: number;
  brand: string | null;
  category: string | null;
  condition: string | null;
  size: string | null;
  color: string | null;
  tags: string[];
  sku: string;
  /** Random directory name for this product's media (see auth.newMediaToken). */
  mediaToken: string;
  createdAt: string;
}

export interface MediaAsset {
  id: number;
  productId: number;
  /** Path relative to config.paths.media, e.g. "12/original-1.jpg". */
  relativePath: string;
  role: 'original' | 'square' | 'story';
  position: number;
  width: number;
  height: number;
  bytes: number;
}

export interface PostRecord {
  id: number;
  productId: number;
  channelId: string;
  status: PostStatus;
  attempts: number;
  externalId: string | null;
  externalUrl: string | null;
  message: string | null;
  /** Absolute paths to files the user needs (assist mode). */
  artifacts: string[];
  runAfter: string;
  createdAt: string;
  updatedAt: string;
}

/** Everything an adapter needs to publish one product to one channel. */
export interface PublishContext {
  product: Product;
  /** Photos in display order, already normalized and trimmed to maxPhotos. */
  photos: MediaAsset[];
  /** The 1080x1920 branded story render (present for story-capable channels). */
  storyImage?: MediaAsset;
  /** Title already trimmed to the channel's limit. */
  title: string;
  description: string;
  /** Social caption with hashtags; undefined for marketplaces. */
  caption?: string;
  priceCents: number | null;
  currency: string;
  /** Resolve a media asset to an absolute filesystem path. */
  filePath(asset: MediaAsset): string;
  /** Resolve a media asset to a public https URL (throws if not configured). */
  publicUrl(asset: MediaAsset): string;
  log(message: string): void;
}

export interface PublishResult {
  status: 'posted' | 'needs_action';
  externalId?: string;
  externalUrl?: string;
  message?: string;
  artifacts?: string[];
}

export interface ChannelAdapter {
  id: string;
  label: string;
  kind: ChannelKind;
  mode: IntegrationMode;
  capabilities: ChannelCapabilities;
  /** Human-readable note shown in the UI (e.g. API limitations). */
  note?: string;
  /**
   * Missing configuration, as a list of what the user still has to set.
   * Empty array means ready to post.
   */
  missingConfig(): string[];
  publish(ctx: PublishContext): Promise<PublishResult>;
}

/** Thrown by adapters for an error that retrying will not fix. */
export class PermanentError extends Error {
  readonly permanent = true;
  constructor(message: string) {
    super(message);
    this.name = 'PermanentError';
  }
}

export function isPermanent(err: unknown): boolean {
  return err instanceof PermanentError;
}
