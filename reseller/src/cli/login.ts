import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { config } from '../config.js';
import { adapters, getAdapter } from '../channels/registry.js';
import { launch, saveSession } from '../channels/browser/engine.js';
import {
  depopFlow,
  facebookMarketplaceFlow,
  mercariFlow,
  offerupFlow,
  poshmarkFlow,
  vintedFlow,
} from '../channels/browser/flows.js';
import type { Flow } from '../channels/browser/engine.js';

const flows: Record<string, Flow> = {
  poshmark: poshmarkFlow,
  depop: depopFlow,
  mercari: mercariFlow,
  facebook_marketplace: facebookMarketplaceFlow,
  offerup: offerupFlow,
  vinted: vintedFlow,
};

function usage(): never {
  const browserChannels = adapters.filter((a) => a.mode === 'browser').map((a) => a.id);
  console.error('\nUsage: npm run login -- <channel>\n');
  console.error(`Channels needing a browser login: ${browserChannels.join(', ')}\n`);
  process.exit(1);
}

const channelId = process.argv[2];
if (!channelId) usage();

const adapter = getAdapter(channelId);
const flow = flows[channelId];
if (!adapter || !flow) {
  console.error(`\n"${channelId}" is not a browser-login channel.`);
  usage();
}

/**
 * Opens a real browser window and hands you the keyboard. You log in exactly
 * as you normally would -- including 2FA and any "is this you?" checks -- and
 * the resulting cookies stay in a Chrome profile under data/profiles/ that
 * the poster reuses. Your password is never typed by, or visible to, this
 * tool.
 */
console.log(`\n  Logging in to ${adapter.label}`);
console.log('  A browser window will open. Log in, get all the way to your');
console.log('  logged-in home page, then come back here and press Enter.\n');

if (!config.browser.headful) {
  console.log('  (Forcing a visible window for this login regardless of BROWSER_HEADFUL.)\n');
}

const { context, close } = await launch(channelId, true);
const page = context.pages()[0] ?? (await context.newPage());

try {
  await page.goto(flow.homeUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
} catch (err) {
  console.warn(`  Could not open ${flow.homeUrl}: ${err instanceof Error ? err.message : err}`);
  console.warn('  Navigate there manually in the window that opened.\n');
}

const rl = readline.createInterface({ input: stdin, output: stdout });
await rl.question('  Press Enter once you are logged in… ');
rl.close();

/**
 * Check it actually worked before claiming success.
 *
 * Without this you find out the login failed much later, as a confusing
 * mid-post failure. If the page still shows a logged-out marker, say so now.
 */
let looksLoggedIn: boolean | null = null;
try {
  const loggedOut = await page
    .locator(flow.loggedOutSelector.split('||')[0]!.trim())
    .first()
    .isVisible({ timeout: 2000 })
    .catch(() => false);
  looksLoggedIn = !loggedOut;
} catch {
  // Window already closed, or navigated somewhere unexpected. Can't tell.
  looksLoggedIn = null;
}

/**
 * With a persistent Chrome profile there is nothing to export: Chrome has
 * already written the cookies into data/profiles/<channel> itself. Calling
 * storageState() here is not just redundant, it throws outright if you closed
 * the browser window before pressing Enter.
 */
if (!config.browser.persistProfile) {
  try {
    await saveSession(channelId, context);
  } catch (err) {
    console.error(`\n  Could not save the session: ${err instanceof Error ? err.message : err}`);
    console.error('  Leave the browser window open next time, then press Enter.\n');
    await close().catch(() => {});
    process.exit(1);
  }
}

if (looksLoggedIn === false) {
  console.warn(`\n  ⚠  That page still looks logged OUT.`);
  console.warn(`     The session was saved, but ${adapter.label} may reject it.`);
  console.warn('     Re-run this and make sure you reach your logged-in home page first.\n');
} else {
  console.log(`\n  ✓ Saved session for ${adapter.label}.`);
}

console.log('    Do a dry run before posting for real:');
console.log('      BROWSER_DRY_RUN=1 npm run dev\n');

await close().catch(() => {});
