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
 * we save the resulting cookies to data/sessions/<channel>.json so the poster
 * can reuse them. Your password is never typed by, or visible to, this tool.
 */
console.log(`\n  Logging in to ${adapter.label}`);
console.log('  A browser window will open. Log in, get all the way to your');
console.log('  logged-in home page, then come back here and press Enter.\n');

if (!config.browser.headful) {
  console.log('  (Forcing a visible window for this login regardless of BROWSER_HEADFUL.)\n');
}

const { browser, context } = await launch(channelId, true);
const page = await context.newPage();

try {
  await page.goto(flow.homeUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
} catch (err) {
  console.warn(`  Could not open ${flow.homeUrl}: ${err instanceof Error ? err.message : err}`);
  console.warn('  Navigate there manually in the window that opened.\n');
}

const rl = readline.createInterface({ input: stdin, output: stdout });
await rl.question('  Press Enter once you are logged in… ');
rl.close();

await saveSession(channelId, context);
console.log(`\n  ✓ Saved session for ${adapter.label}.`);
console.log('    Do a dry run before posting for real:');
console.log(`      BROWSER_DRY_RUN=1 npm start\n`);

await context.close();
await browser.close();
