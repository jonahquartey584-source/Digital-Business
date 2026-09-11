import type { Flow } from './engine.js';

/**
 * Listing recipes for the marketplaces with no public listing API.
 *
 * IMPORTANT, please read before trusting these:
 * Every flow below is marked `verified: false`. The selectors are realistic --
 * they follow each site's current form structure and each step lists two or
 * three candidates separated by `||` so a single redesign doesn't break it --
 * but they have not been run against a live seller account, because doing that
 * needs your own logged-in session. Treat them as a starting point:
 *
 *   1. `npm run login -- poshmark`          (once, to save the session)
 *   2. `BROWSER_DRY_RUN=1 npm start`        (fills the form, never publishes)
 *   3. Look at data/outbox/failures/*.png   (did every field land?)
 *   4. Fix any selector here, flip `verified: true`, drop the dry run.
 *
 * SELECTORS.md walks through step 3 and 4 in detail.
 */

/** Poshmark — clothing and accessories. Form at /create-listing. */
export const poshmarkFlow: Flow = {
  verified: false,
  homeUrl: 'https://poshmark.com/feed',
  loggedOutSelector: 'a[href="/login"] || button:has-text("Sign In")',
  steps: [
    { do: 'goto', url: 'https://poshmark.com/create-listing' },
    { do: 'waitFor', selector: 'input[type="file"]', timeoutMs: 30_000 },
    { do: 'upload', selector: 'input[type="file"]' },
    { do: 'sleep', ms: 4000 },
    {
      do: 'fill',
      selector: 'input[data-vv-name="title"] || input[name="title"] || input[placeholder*="Listing Title" i]',
      value: '{{title}}',
    },
    {
      do: 'fill',
      selector: 'textarea[data-vv-name="description"] || textarea[name="description"] || textarea[placeholder*="Describe" i]',
      value: '{{description}}',
    },
    {
      do: 'fill',
      selector: 'input[data-vv-name="listing_price"] || input[name="listing_price"] || input[placeholder="0"]',
      value: '{{priceAmount}}',
    },
    {
      do: 'fill',
      selector: 'input[data-vv-name="original_price"] || input[name="original_price"]',
      value: '{{priceAmount}}',
      optional: true,
    },
    {
      do: 'fill',
      selector: 'input[placeholder*="Brand" i] || input[data-vv-name="brand"]',
      value: '{{brand}}',
      optional: true,
    },
    {
      do: 'click',
      selector: 'button:has-text("Next") || button:has-text("List this item")',
      isSubmit: true,
    },
    { do: 'waitForUrl', pattern: 'poshmark\\.com/listing/', timeoutMs: 90_000 },
  ],
  resultUrlPattern: 'poshmark\\.com/listing/',
};

/** Depop — streetwear and vintage. Form at /products/create. */
export const depopFlow: Flow = {
  verified: false,
  homeUrl: 'https://www.depop.com/',
  loggedOutSelector: 'a[href*="/login"] || button:has-text("Log in")',
  steps: [
    { do: 'goto', url: 'https://www.depop.com/products/create/' },
    { do: 'waitFor', selector: 'input[type="file"]', timeoutMs: 30_000 },
    { do: 'upload', selector: 'input[type="file"]' },
    { do: 'sleep', ms: 5000 },
    {
      do: 'fill',
      selector: 'textarea[name="description"] || textarea[id*="description"] || textarea[placeholder*="Describe" i]',
      value: '{{caption}}',
    },
    {
      do: 'fill',
      selector: 'input[name="price"] || input[id*="price"] || input[placeholder*="0.00"]',
      value: '{{priceAmount}}',
    },
    {
      do: 'fill',
      selector: 'input[name="brand"] || input[placeholder*="Brand" i]',
      value: '{{brand}}',
      optional: true,
    },
    {
      do: 'click',
      selector: 'button[type="submit"]:has-text("Upload") || button:has-text("Post listing") || button:has-text("Upload")',
      isSubmit: true,
    },
    { do: 'waitForUrl', pattern: 'depop\\.com/products/', timeoutMs: 90_000 },
  ],
  resultUrlPattern: 'depop\\.com/products/',
};

/** Mercari — general resale. Form at /sell. */
export const mercariFlow: Flow = {
  verified: false,
  homeUrl: 'https://www.mercari.com/',
  loggedOutSelector: 'a[href*="/login"] || button:has-text("Log in") || button:has-text("Sign up")',
  steps: [
    { do: 'goto', url: 'https://www.mercari.com/sell/' },
    { do: 'waitFor', selector: 'input[type="file"]', timeoutMs: 30_000 },
    { do: 'upload', selector: 'input[type="file"]' },
    { do: 'sleep', ms: 4000 },
    {
      do: 'fill',
      selector: 'input[name="name"] || input[data-testid="Name"] || input[placeholder*="What are you selling" i]',
      value: '{{title}}',
    },
    {
      do: 'fill',
      selector: 'textarea[name="description"] || textarea[data-testid="Description"]',
      value: '{{description}}',
    },
    {
      do: 'fill',
      selector: 'input[name="price"] || input[data-testid="Price"]',
      value: '{{priceAmount}}',
    },
    {
      do: 'click',
      selector: 'button[data-testid="ListButton"] || button:has-text("List") || button[type="submit"]',
      isSubmit: true,
    },
    { do: 'waitForUrl', pattern: 'mercari\\.com/(us/)?item/', timeoutMs: 90_000 },
  ],
  resultUrlPattern: 'mercari\\.com/(us/)?item/',
};

/**
 * Facebook Marketplace. There is no Marketplace listing API for individual
 * sellers (Meta's catalog APIs are for vehicle/rental/retail partners), so
 * this drives the /marketplace/create/item form.
 */
export const facebookMarketplaceFlow: Flow = {
  verified: false,
  homeUrl: 'https://www.facebook.com/marketplace/you/selling',
  loggedOutSelector: 'input[name="email"] || button[name="login"]',
  steps: [
    { do: 'goto', url: 'https://www.facebook.com/marketplace/create/item' },
    { do: 'waitFor', selector: 'input[type="file"]', timeoutMs: 30_000 },
    { do: 'upload', selector: 'input[type="file"][accept*="image"]' },
    { do: 'sleep', ms: 4000 },
    {
      do: 'fill',
      selector: 'label:has-text("Title") input || input[aria-label="Title"]',
      value: '{{title}}',
    },
    {
      do: 'fill',
      selector: 'label:has-text("Price") input || input[aria-label="Price"]',
      value: '{{priceAmount}}',
    },
    {
      do: 'fill',
      selector: 'label:has-text("Description") textarea || textarea[aria-label="Description"]',
      value: '{{description}}',
    },
    { do: 'click', selector: 'div[aria-label="Next"] || span:has-text("Next")', optional: true },
    { do: 'sleep', ms: 2000 },
    {
      do: 'click',
      selector: 'div[aria-label="Publish"] || span:has-text("Publish")',
      isSubmit: true,
    },
    { do: 'sleep', ms: 6000 },
  ],
};

/** OfferUp — local pickup. Form at /post. */
export const offerupFlow: Flow = {
  verified: false,
  homeUrl: 'https://offerup.com/',
  loggedOutSelector: 'a[href*="/login"] || button:has-text("Log in")',
  steps: [
    { do: 'goto', url: 'https://offerup.com/post/' },
    { do: 'waitFor', selector: 'input[type="file"]', timeoutMs: 30_000 },
    { do: 'upload', selector: 'input[type="file"]' },
    { do: 'sleep', ms: 4000 },
    {
      do: 'fill',
      selector: 'input[name="title"] || input[aria-label*="Title" i]',
      value: '{{title}}',
    },
    {
      do: 'fill',
      selector: 'input[name="price"] || input[aria-label*="Price" i]',
      value: '{{priceAmount}}',
    },
    {
      do: 'fill',
      selector: 'textarea[name="description"] || textarea[aria-label*="Description" i]',
      value: '{{description}}',
    },
    {
      do: 'click',
      selector: 'button:has-text("Post") || button[type="submit"]',
      isSubmit: true,
    },
    { do: 'sleep', ms: 6000 },
  ],
};
