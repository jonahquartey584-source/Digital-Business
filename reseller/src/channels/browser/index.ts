import type {
  ChannelAdapter,
  ChannelCapabilities,
  PublishContext,
  PublishResult,
} from '../../core/types.js';
import { hasSession, runFlow, type Flow } from './engine.js';
import {
  depopFlow,
  facebookMarketplaceFlow,
  mercariFlow,
  offerupFlow,
  poshmarkFlow,
} from './flows.js';

/** Values the flow templates ({{title}}, {{priceAmount}}, ...) interpolate. */
function flowValues(ctx: PublishContext): Record<string, string> {
  return {
    title: ctx.title,
    description: ctx.description,
    caption: ctx.caption ?? ctx.description,
    // Marketplace price boxes want a bare number, not a currency symbol.
    priceAmount: ctx.priceCents === null ? '' : (ctx.priceCents / 100).toFixed(2),
    priceWhole: ctx.priceCents === null ? '' : String(Math.round(ctx.priceCents / 100)),
    brand: ctx.product.brand ?? '',
    size: ctx.product.size ?? '',
    color: ctx.product.color ?? '',
    category: ctx.product.category ?? '',
    condition: ctx.product.condition ?? '',
    sku: ctx.product.sku,
    quantity: String(Math.max(1, ctx.product.quantity)),
  };
}

interface BrowserChannelSpec {
  id: string;
  label: string;
  flow: Flow;
  note: string;
  capabilities?: Partial<ChannelCapabilities>;
}

const defaultCapabilities: ChannelCapabilities = {
  titleMaxLength: 80,
  descriptionMaxLength: 1500,
  maxPhotos: 8,
  usesPrice: true,
  publishesStory: false,
  needsPublicImageUrls: false,
  prefersSquarePhotos: false,
};

export function makeBrowserAdapter(spec: BrowserChannelSpec): ChannelAdapter {
  const capabilities = { ...defaultCapabilities, ...spec.capabilities };

  return {
    id: spec.id,
    label: spec.label,
    kind: 'marketplace',
    mode: 'browser',
    note: spec.flow.verified
      ? spec.note
      : `${spec.note} Selectors are unverified — do a BROWSER_DRY_RUN=1 pass first.`,
    capabilities,

    missingConfig() {
      return hasSession(spec.id) ? [] : [`Browser login (run: npm run login -- ${spec.id})`];
    },

    async publish(ctx: PublishContext): Promise<PublishResult> {
      const photoPaths = ctx.photos.map((p) => ctx.filePath(p));
      const result = await runFlow(
        spec.id,
        spec.label,
        spec.flow,
        flowValues(ctx),
        photoPaths,
        ctx.log,
      );

      if (result.dryRun) {
        return {
          status: 'needs_action',
          message: `Dry run: the ${spec.label} form was filled but not submitted. Check the screenshot, then unset BROWSER_DRY_RUN.`,
          artifacts: result.artifacts,
        };
      }

      return {
        status: 'posted',
        externalUrl: result.url,
        message: result.url
          ? `Listed on ${spec.label}`
          : `Submitted to ${spec.label} (no listing URL was captured — check your account)`,
        artifacts: result.artifacts,
      };
    },
  };
}

export const poshmarkAdapter = makeBrowserAdapter({
  id: 'poshmark',
  label: 'Poshmark',
  flow: poshmarkFlow,
  note: 'No public listing API. Drives your saved Poshmark browser session.',
  capabilities: { titleMaxLength: 80, descriptionMaxLength: 1500, maxPhotos: 16, prefersSquarePhotos: true },
});

export const depopAdapter = makeBrowserAdapter({
  id: 'depop',
  label: 'Depop',
  flow: depopFlow,
  note: 'No public listing API. Drives your saved Depop browser session.',
  capabilities: { titleMaxLength: 80, descriptionMaxLength: 1000, maxPhotos: 8, prefersSquarePhotos: true },
});

export const mercariAdapter = makeBrowserAdapter({
  id: 'mercari',
  label: 'Mercari',
  flow: mercariFlow,
  note: 'No public listing API (the partner API is Japan-only). Drives your saved Mercari session.',
  capabilities: { titleMaxLength: 80, descriptionMaxLength: 1000, maxPhotos: 12 },
});

export const facebookMarketplaceAdapter = makeBrowserAdapter({
  id: 'facebook_marketplace',
  label: 'Facebook Marketplace',
  flow: facebookMarketplaceFlow,
  note:
    'Meta has no Marketplace listing API for individual sellers, so this drives your saved Facebook session.',
  capabilities: { titleMaxLength: 100, descriptionMaxLength: 5000, maxPhotos: 10 },
});

export const offerupAdapter = makeBrowserAdapter({
  id: 'offerup',
  label: 'OfferUp',
  flow: offerupFlow,
  note: 'No public listing API. Drives your saved OfferUp session.',
  capabilities: { titleMaxLength: 80, descriptionMaxLength: 1500, maxPhotos: 12 },
});
