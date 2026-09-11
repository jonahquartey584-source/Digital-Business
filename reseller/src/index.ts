import { config, hasPublicUrl } from './config.js';
import { createApp } from './app.js';
import { startWorker } from './core/queue.js';
import { describeChannels } from './channels/registry.js';

/**
 * With no password set the app is localhost-only, so bind the socket that way
 * too rather than relying on the request-level check alone.
 */
const host = config.passwordHash ? process.env.HOST || '0.0.0.0' : '127.0.0.1';

const server = createApp().listen(config.port, host, () => {
  const channels = describeChannels();
  const ready = channels.filter((c) => c.ready);

  console.log(`\n  Reseller Autopost → http://localhost:${config.port}\n`);
  console.log(`  Channels ready:  ${ready.length}/${channels.length}`);
  if (ready.length > 0) console.log(`                   ${ready.map((c) => c.label).join(', ')}`);

  const notReady = channels.filter((c) => !c.ready);
  if (notReady.length > 0) {
    console.log('\n  Still to set up:');
    for (const c of notReady) console.log(`    · ${c.label}: ${c.missing.join(', ')}`);
  }

  if (config.passwordHash) {
    console.log(`\n  [locked] Password protected, listening on ${host}:${config.port}`);
  } else {
    console.log('\n  !  No ADMIN_PASSWORD_HASH set — localhost only.');
    console.log('     Requests from other machines get a 403, so this cannot be');
    console.log('     exposed by accident. To make it reachable from your phone:');
    console.log('       npm run set-password');
  }

  if (!hasPublicUrl()) {
    console.log('\n  !  PUBLIC_BASE_URL is not a public https URL.');
    console.log('     eBay, Instagram and Facebook fetch your photos over the internet,');
    console.log('     so they stay disabled until you point it at a tunnel');
    console.log(`     (cloudflared tunnel --url http://localhost:${config.port}) or a host.`);
  }
  if (!config.browser.headful) {
    console.log('\n  !  BROWSER_HEADFUL=0 — hidden Chrome reports itself as HeadlessChrome,');
    console.log('     which marketplaces commonly refuse. Expect more failures on the');
    console.log('     browser channels than with a visible window.');
  }
  if (config.browser.dryRun) {
    console.log('\n  i  BROWSER_DRY_RUN=1 — browser channels fill forms but do not publish.');
  }
  console.log('');

  startWorker();
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`\n[${signal}] shutting down`);
    server.close(() => process.exit(0));
  });
}
