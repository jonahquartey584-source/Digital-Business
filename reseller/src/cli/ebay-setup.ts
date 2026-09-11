import { apiRequest } from '../channels/http.js';
import { ask, askSecret, choose, closePrompts, confirm } from './prompt.js';
import { updateEnv } from './env-file.js';
import { extractEbayCode } from './ebay-code.js';

/**
 * Walks through eBay's Sell API setup and writes the result to .env.
 *
 * eBay needs eight separate values and normally has you hunt for them across
 * the developer portal, Seller Hub and the Inventory API. This does the parts
 * a program can: exchanges your consent for a refresh token, reads back your
 * business policies and inventory locations, and creates a location if you
 * have none. You only paste what genuinely can't be discovered.
 */

const MARKETPLACES = [
  { id: 'EBAY_GB', label: 'United Kingdom (ebay.co.uk)', country: 'GB', currency: 'GBP' },
  { id: 'EBAY_US', label: 'United States (ebay.com)', country: 'US', currency: 'USD' },
  { id: 'EBAY_DE', label: 'Germany (ebay.de)', country: 'DE', currency: 'EUR' },
  { id: 'EBAY_AU', label: 'Australia (ebay.com.au)', country: 'AU', currency: 'AUD' },
  { id: 'EBAY_CA', label: 'Canada (ebay.ca)', country: 'CA', currency: 'CAD' },
  { id: 'EBAY_IE', label: 'Ireland (ebay.ie)', country: 'IE', currency: 'EUR' },
];

const SCOPES = [
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account.readonly',
].join(' ');

interface Policy {
  name: string;
  fulfillmentPolicyId?: string;
  paymentPolicyId?: string;
  returnPolicyId?: string;
}

interface Location {
  merchantLocationKey: string;
  name?: string;
}

function fail(message: string): never {
  console.error(`\n  ${message}\n`);
  closePrompts();
  process.exit(1);
}

console.log(`
  eBay setup
  ==========

  Before starting, you need two things from eBay:

  1. A developer app.  https://developer.ebay.com  ->  sign in  ->
     "Application Keys".  Create a PRODUCTION keyset if you have none.
     You want the "App ID (Client ID)" and "Cert ID (Client Secret)".

  2. A redirect name ("RuName"). On that same Application Keys page click
     "User tokens" -> "Get a Token from eBay via Your Application" and add a
     redirect URL. eBay shows an "RuName" like Your-Name-PRD-abc123-xyz789.
     Copy the RuName, not the URL.

  Also make sure Business Policies are switched on for your seller account:
  Seller Hub -> Account -> Business policies. You need one each of shipping,
  payment and returns. This script reads them; it can't create them.
`);

const sandbox = await confirm('  Use eBay SANDBOX instead of your real account?', false);
const apiHost = sandbox ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
const authHost = sandbox ? 'https://auth.sandbox.ebay.com' : 'https://auth.ebay.com';

const clientId = await ask('\n  App ID (Client ID): ');
if (!clientId) fail('An App ID is required.');

const clientSecret = await askSecret('  Cert ID (Client Secret): ');
if (!clientSecret) fail('A Cert ID is required.');

const ruName = await ask('  RuName (redirect name): ');
if (!ruName) fail('A RuName is required.');

const marketplace = await choose('  Which eBay site do you sell on', MARKETPLACES, (m) => m.label);

/* ------------------------------------------------------------------ consent */

const consentUrl =
  `${authHost}/oauth2/authorize?client_id=${encodeURIComponent(clientId)}` +
  `&response_type=code&redirect_uri=${encodeURIComponent(ruName)}` +
  `&scope=${encodeURIComponent(SCOPES)}`;

console.log(`
  ------------------------------------------------------------------
  Open this URL in your browser and approve access:

${consentUrl}

  eBay then redirects you to your own URL with "?code=..." on the end.
  Copy the WHOLE address from the browser bar and paste it below --
  the code expires after a couple of minutes, so do it promptly.
  ------------------------------------------------------------------
`);

const pasted = await ask('  Paste the redirect URL (or just the code): ');
if (!pasted) fail('Nothing pasted.');

const code = extractEbayCode(pasted);
if (!code) fail('Could not find a "code" in that. Paste the full redirect URL.');

const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

console.log('\n  Exchanging that for a refresh token…');
const tokens = await apiRequest<{ refresh_token?: string; access_token?: string }>(
  `${apiHost}/identity/v1/oauth2/token`,
  {
    channel: 'eBay (auth)',
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: ruName,
    }).toString(),
  },
).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  if (/invalid_grant/.test(message)) {
    fail(
      'eBay rejected the code (invalid_grant). It expires in minutes and is single-use —\n' +
        '  re-run this and paste a fresh one. Also check the RuName matches exactly.',
    );
  }
  fail(`Token exchange failed: ${message}`);
});

if (!tokens?.refresh_token) fail('eBay did not return a refresh token.');
const refreshToken = tokens.refresh_token;
const accessToken = tokens.access_token ?? '';
console.log('  Got it.');

const authHeaders = { Authorization: `Bearer ${accessToken}` };

/* ----------------------------------------------------------------- policies */

async function fetchPolicies<K extends keyof Policy>(
  kind: 'fulfillment_policy' | 'payment_policy' | 'return_policy',
  idField: K,
  human: string,
): Promise<string> {
  const res = await apiRequest<Record<string, Policy[]>>(
    `${apiHost}/sell/account/v1/${kind}?marketplace_id=${marketplace.id}`,
    { channel: 'eBay', headers: authHeaders },
  ).catch((err: unknown) => {
    fail(`Could not read your ${human} policies: ${err instanceof Error ? err.message : err}`);
  });

  // The array key varies by endpoint (fulfillmentPolicies, paymentPolicies…).
  const policies = Object.values(res ?? {}).find(Array.isArray) as Policy[] | undefined;
  if (!policies || policies.length === 0) {
    fail(
      `You have no ${human} policy on ${marketplace.label}.\n` +
        '  Create one in Seller Hub -> Account -> Business policies, then re-run this.',
    );
  }

  const chosen = await choose(`  ${human} policy`, policies, (p) => p.name);
  const id = chosen[idField];
  if (!id) fail(`That ${human} policy has no id.`);
  return String(id);
}

console.log('\n  Reading your business policies…');
const fulfillmentId = await fetchPolicies('fulfillment_policy', 'fulfillmentPolicyId', 'Shipping');
const paymentId = await fetchPolicies('payment_policy', 'paymentPolicyId', 'Payment');
const returnId = await fetchPolicies('return_policy', 'returnPolicyId', 'Returns');

/* ---------------------------------------------------------------- location */

console.log('\n  Checking your inventory locations…');
const locationRes = await apiRequest<{ locations?: Location[] }>(
  `${apiHost}/sell/inventory/v1/location?limit=50`,
  { channel: 'eBay', headers: authHeaders },
).catch(() => ({ locations: [] }));

let locationKey: string;
const locations = locationRes?.locations ?? [];

if (locations.length > 0) {
  const chosen = await choose('  Ship-from location', locations, (l) =>
    `${l.name ?? '(unnamed)'} — ${l.merchantLocationKey}`,
  );
  locationKey = chosen.merchantLocationKey;
} else {
  console.log('  You have none, so eBay has nowhere to ship from. Creating one.');
  const postcode = await ask('  Your postcode / ZIP: ');
  if (!postcode) fail('A postcode is required to create a location.');

  locationKey = 'default-location';
  await apiRequest(`${apiHost}/sell/inventory/v1/location/${locationKey}`, {
    channel: 'eBay',
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    json: {
      location: { address: { country: marketplace.country, postalCode: postcode } },
      name: 'Default ship-from',
      merchantLocationStatus: 'ENABLED',
      locationTypes: ['STORE'],
    },
  }).catch((err: unknown) => {
    fail(`Could not create the location: ${err instanceof Error ? err.message : err}`);
  });
  console.log(`  Created "${locationKey}".`);
}

/* ---------------------------------------------------------------- category */

console.log(`
  Last thing, and it's the one bit that can't be looked up for you: the
  category id for what you mostly sell. Easiest way to find it — open a live
  listing similar to yours on eBay, scroll to "Item specifics", and the
  category is shown there; or search eBay's category tree.

  Examples: 15709 Athletic Shoes · 57990 Men's Coats & Jackets
            11450 Clothing/Shoes/Accessories (broad fallback)
`);
const categoryId = await ask('  Default category id [11450]: ', '11450');

const condition = await choose(
  '  Default item condition',
  ['USED_EXCELLENT', 'USED_VERY_GOOD', 'USED_GOOD', 'USED_ACCEPTABLE', 'NEW', 'LIKE_NEW'],
  (c) => c,
);

/* -------------------------------------------------------------------- write */

const envPath = updateEnv({
  EBAY_ENV: sandbox ? 'sandbox' : 'production',
  EBAY_CLIENT_ID: clientId,
  EBAY_CLIENT_SECRET: clientSecret,
  EBAY_REFRESH_TOKEN: refreshToken,
  EBAY_MARKETPLACE_ID: marketplace.id,
  EBAY_MERCHANT_LOCATION_KEY: locationKey,
  EBAY_FULFILLMENT_POLICY_ID: fulfillmentId,
  EBAY_PAYMENT_POLICY_ID: paymentId,
  EBAY_RETURN_POLICY_ID: returnId,
  EBAY_DEFAULT_CATEGORY_ID: categoryId,
  EBAY_CONDITION: condition,
});

console.log(`
  Done. Saved 11 settings to ${envPath}

  Restart the app and eBay will show as Connected:

      npm run dev

  Your listings will price in ${marketplace.currency} on ${marketplace.label}.
`);

closePrompts();
