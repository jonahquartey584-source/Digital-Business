import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { config } from '../../config.js';
import { PermanentError } from '../../core/types.js';

/* -------------------------------------------------------------------------- */
/* Flow definition                                                            */
/* -------------------------------------------------------------------------- */

/**
 * A flow is a list of steps, kept as data in `flows.ts` rather than code.
 * Marketplaces redesign their listing forms regularly, and when a selector
 * breaks the fix should be a one-line edit to a list of strings -- not a patch
 * to the engine that drives every channel.
 */
export type Step =
  | { do: 'goto'; url: string }
  | { do: 'click'; selector: string; optional?: boolean; isSubmit?: boolean }
  | { do: 'fill'; selector: string; value: string; optional?: boolean }
  | { do: 'select'; selector: string; value: string; optional?: boolean }
  | { do: 'upload'; selector: string }
  | { do: 'waitFor'; selector: string; timeoutMs?: number }
  | { do: 'waitForUrl'; pattern: string; timeoutMs?: number }
  | { do: 'press'; key: string }
  | { do: 'sleep'; ms: number };

export interface Flow {
  /** Page that proves we're logged in (redirects to a login page if not). */
  homeUrl: string;
  /** Selector that only exists when logged out. */
  loggedOutSelector: string;
  steps: Step[];
  /** Read the created listing's URL once the flow finishes. */
  resultUrlPattern?: string;
  /**
   * False means the selectors are a best-effort starting point that nobody
   * has run against a live account yet. The UI surfaces this so you know to
   * do a dry run first. See SELECTORS.md for how to fix one.
   */
  verified: boolean;
}

export type FlowValues = Record<string, string>;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Substitute {{title}}, {{price}}, ... into a selector or input value. */
export function render(template: string, values: FlowValues): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? '');
}

/**
 * Try each `||`-separated selector in turn and return the first one present.
 * Listing forms differ by account age and A/B test, so a step usually needs
 * two or three candidate selectors to be reliable.
 */
async function resolve(
  page: Page,
  selectorSpec: string,
  timeoutMs: number,
): Promise<string | null> {
  const candidates = selectorSpec.split('||').map((s) => s.trim()).filter(Boolean);
  const perCandidate = Math.max(1000, Math.floor(timeoutMs / candidates.length));

  for (const candidate of candidates) {
    try {
      await page.locator(candidate).first().waitFor({ state: 'visible', timeout: perCandidate });
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function sessionFile(channelId: string): string {
  return path.join(config.paths.sessions, `${channelId}.json`);
}

export function hasSession(channelId: string): boolean {
  return fs.existsSync(sessionFile(channelId));
}

export async function saveSession(channelId: string, context: BrowserContext): Promise<void> {
  await fsp.mkdir(config.paths.sessions, { recursive: true });
  await context.storageState({ path: sessionFile(channelId) });
}

export async function launch(channelId: string, forceHeadful = false) {
  const browser: Browser = await chromium.launch({
    headless: !(config.browser.headful || forceHeadful),
    slowMo: config.browser.slowMo || undefined,
    executablePath: config.browser.executablePath,
  });
  const context = await browser.newContext({
    storageState: hasSession(channelId) ? sessionFile(channelId) : undefined,
    viewport: { width: 1400, height: 1000 },
    // A default UA containing "HeadlessChrome" gets bot-blocked outright.
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'en-US',
  });
  return { browser, context };
}

/** Screenshot + HTML dump, so a broken selector is a 10-second diagnosis. */
async function captureFailure(page: Page, channelId: string): Promise<string[]> {
  const dir = path.join(config.paths.outbox, 'failures');
  await fsp.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const shot = path.join(dir, `${channelId}-${stamp}.png`);
  const html = path.join(dir, `${channelId}-${stamp}.html`);

  try {
    await page.screenshot({ path: shot, fullPage: true });
    await fsp.writeFile(html, await page.content(), 'utf8');
    return [shot, html];
  } catch {
    return [];
  }
}

export interface FlowRunResult {
  url?: string;
  artifacts: string[];
  /** True when a dry run stopped short of publishing. */
  dryRun?: boolean;
}

/**
 * Execute a flow against a logged-in browser session.
 *
 * Throws PermanentError when the session is gone (retrying cannot help --
 * the user has to re-run `npm run login`) and a plain Error otherwise, so the
 * queue's backoff still covers a slow page or a transient network blip.
 */
export async function runFlow(
  channelId: string,
  label: string,
  flow: Flow,
  values: FlowValues,
  photoPaths: string[],
  log: (message: string) => void,
): Promise<FlowRunResult> {
  if (!hasSession(channelId)) {
    throw new PermanentError(
      `Not logged in to ${label}. Run: npm run login -- ${channelId}`,
    );
  }

  const { browser, context } = await launch(channelId);
  const page = await context.newPage();
  const artifacts: string[] = [];

  try {
    /* Confirm the saved session is still valid before touching the form. */
    log(`Opening ${label}`);
    await page.goto(flow.homeUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });

    const loggedOut = await resolve(page, flow.loggedOutSelector, 3000);
    if (loggedOut) {
      throw new PermanentError(
        `${label} session has expired. Run: npm run login -- ${channelId}`,
      );
    }

    for (const [index, step] of flow.steps.entries()) {
      const position = `step ${index + 1}/${flow.steps.length}`;

      switch (step.do) {
        case 'goto': {
          const url = render(step.url, values);
          log(`${position}: open ${url}`);
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
          break;
        }

        case 'click': {
          /* Dry run stops at the publish button: the form is filled and
             screenshotted, so you can check every selector landed correctly
             before letting it post to a real marketplace. */
          if (step.isSubmit && config.browser.dryRun) {
            log(`${position}: DRY RUN — form filled, not submitting`);
            artifacts.push(...(await captureFailure(page, `${channelId}-dryrun`)));
            return { url: undefined, artifacts, dryRun: true };
          }
          const found = await resolve(page, render(step.selector, values), 15_000);
          if (!found) {
            if (step.optional) {
              log(`${position}: optional click skipped (not present)`);
              break;
            }
            throw new Error(`${label}: could not find anything to click (${step.selector})`);
          }
          log(`${position}: click ${found}`);
          await page.locator(found).first().click();
          break;
        }

        case 'fill': {
          const found = await resolve(page, render(step.selector, values), 15_000);
          if (!found) {
            if (step.optional) break;
            throw new Error(`${label}: could not find field ${step.selector}`);
          }
          const value = render(step.value, values);
          if (!value) break;
          log(`${position}: fill ${found}`);
          const field = page.locator(found).first();
          await field.click();
          await field.fill(value);
          break;
        }

        case 'select': {
          const found = await resolve(page, render(step.selector, values), 15_000);
          if (!found) {
            if (step.optional) break;
            throw new Error(`${label}: could not find dropdown ${step.selector}`);
          }
          const value = render(step.value, values);
          if (!value) break;
          log(`${position}: select "${value}" in ${found}`);
          await page.locator(found).first().selectOption({ label: value }).catch(async () => {
            await page.locator(found).first().selectOption(value);
          });
          break;
        }

        case 'upload': {
          const found = await resolve(page, render(step.selector, values), 20_000);
          if (!found) throw new Error(`${label}: could not find the photo input ${step.selector}`);
          log(`${position}: upload ${photoPaths.length} photo(s)`);
          await page.locator(found).first().setInputFiles(photoPaths);
          break;
        }

        case 'waitFor': {
          const found = await resolve(page, render(step.selector, values), step.timeoutMs ?? 30_000);
          if (!found) throw new Error(`${label}: timed out waiting for ${step.selector}`);
          log(`${position}: saw ${found}`);
          break;
        }

        case 'waitForUrl': {
          log(`${position}: waiting for URL like ${step.pattern}`);
          await page.waitForURL(new RegExp(step.pattern), { timeout: step.timeoutMs ?? 60_000 });
          break;
        }

        case 'press': {
          await page.keyboard.press(step.key);
          break;
        }

        case 'sleep': {
          await page.waitForTimeout(step.ms);
          break;
        }
      }
    }

    // The session cookies usually get refreshed during a post; keep them.
    await saveSession(channelId, context);

    const finalUrl = page.url();
    const matched = flow.resultUrlPattern
      ? new RegExp(flow.resultUrlPattern).test(finalUrl)
      : false;

    return { url: matched ? finalUrl : undefined, artifacts };
  } catch (err) {
    artifacts.push(...(await captureFailure(page, channelId)));
    if (err instanceof PermanentError) throw err;

    const reason = err instanceof Error ? err.message : String(err);
    const enriched = new Error(
      `${reason}${artifacts.length ? ` (screenshot: ${artifacts[0]})` : ''}`,
    );
    throw enriched;
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
