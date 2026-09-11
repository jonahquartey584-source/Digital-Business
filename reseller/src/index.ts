import { config, hasPublicUrl } from './config.js';
import { createApp } from './app.js';
import { startWorker } from './core/queue.js';
import { describeChannels } from './channels/registry.js';

const server = createApp().listen(config.port, () => {
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

  if (!config.apiKey) {
    console.log('\n  ⚠  APP_API_KEY is empty — the API is unauthenticated.');
    console.log('     Fine on localhost; set one before exposing this anywhere.');
  }
  if (!hasPublicUrl()) {
    console.log('\n  ⚠  PUBLIC_BASE_URL is not a public https URL.');
    console.log('     eBay, Instagram and Facebook fetch your photos over the internet,');
    console.log(`     so they stay disabled until you point it at a tunnel`);
    console.log(`     (cloudflared tunnel --url http://localhost:${config.port}) or a host.`);
  }
  if (config.browser.dryRun) {
    console.log('\n  ⓘ  BROWSER_DRY_RUN=1 — browser channels will fill forms but not publish.');
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
