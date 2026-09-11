# Reseller Autopost

Post an item **once** — photos, name, price — and it fans out to the marketplaces
you sell on, plus your Instagram / Facebook / Snapchat story.

It also renders the story graphic for you: a 1080×1920 image built from your
first photo with the name, price and a call to action burned in, so you're not
making one by hand for every item.

---

## Read this first: what can actually be automated

This is the part most crosslisting tools are vague about. Not every platform
lets software post on your behalf, so each channel here runs in one of three
modes, and the UI labels every channel with which one it is:

| Mode | What it means | Reliability |
| --- | --- | --- |
| **Official API** | The platform has a public listing/publishing API. Fully unattended. | High — breaks only if a token is revoked |
| **Browser automation** | No public API. The app drives your own logged-in browser session. | Medium — breaks when the site redesigns its form |
| **One-tap handoff** | No API *and* no safe automation path. The app prepares the finished image + caption and gives you a phone page; you tap twice. | Always works, needs you for the last step |

### Channel support

| Channel | Mode | Notes |
| --- | --- | --- |
| eBay | Official API | Sell (Inventory) API. Needs business policies + a category id. |
| Etsy | Official API | Open API v3. Creates a draft, uploads photos, activates it. |
| Shopify | Official API | Admin API. The only API channel needing no public URL. |
| Poshmark | Browser | No public listing API exists. |
| Depop | Browser | No public listing API exists. |
| Vinted | Browser | No public listing API. Set `VINTED_DOMAIN` to your country site. |
| Mercari | Browser | No public US listing API (the partner API is Japan-only). |
| Facebook Marketplace | Browser | Meta has no Marketplace API for individual sellers. |
| OfferUp | Browser | No public listing API exists. |
| Instagram Story | Official API | Graph API `media_type=STORIES`. Needs a **Business/Creator** account. |
| Instagram Feed | Official API | Graph API content publishing. |
| Facebook Story | Official API | Posts to a **Page** story. See the limitation below. |
| Facebook Page Post | Official API | Permanent post to your Page feed. |
| Snapchat Story | Official API | Public Profile API. Needs a free Public Profile + Snap allowlist approval. |
| Story handoff (phone) | One-tap handoff | For personal accounts, which no API can post to. |

### Three limitations worth knowing up front

1. **Every story channel needs a business-side account, not a personal one.**
   This is the single thing that decides whether your stories post themselves:

   | You want to post to | Works via API? | What to do |
   | --- | --- | --- |
   | Snapchat Public Profile story | Yes | Create a Public Profile (free, in-app) + get allowlisted |
   | Snapchat personal My Story | No | Use the handoff channel |
   | Instagram Business/Creator story | Yes | Switch account type in Settings (free, instant) |
   | Instagram personal story | No | Switch the account type, or use handoff |
   | Facebook **Page** story | Yes | Already wired up |
   | Facebook personal profile story | No — no API exists | Use the handoff channel |

   Switching Instagram to a Creator account takes about a minute and is the
   cheapest win here. For Facebook personal profile stories there is genuinely
   no API at any account tier.

2. **Snapchat needs Snap's approval before it will post.** The Public Profile
   API is real and this app implements it, but your client ID has to be added
   to Snap's allowlist first — you submit the app for review. Until that lands,
   use the handoff channel. See the Snapchat setup section below.

3. **Some marketplaces actively block automated browsers, and Depop is one of
   them.** A first login attempt on Depop can come back as a bare
   `403 Forbidden` before the login form even loads — that is their WAF
   refusing the session, not a bug in the flow.

   What this project does about it: drives your real Google Chrome rather than
   a bundled Chromium, in a visible window, with a persistent profile, and
   without Chrome announcing `navigator.webdriver`. That is enough for a site
   that merely dislikes obviously-robotic sessions.

   What it deliberately does **not** do: fingerprint spoofing, residential
   proxies, CAPTCHA solving, or anything else in the evasion arms race. If a
   marketplace still refuses after the above, that is a clear statement of
   intent from the platform, and the right response is to stop automating that
   channel — not to try harder. Continuing to hammer a WAF is also the fastest
   route to getting your seller account restricted.

4. **Browser automation is against several platforms' terms of service.**
   Crosslisting tools (Vendoo, List Perfectly, Crosslist) all work this way and
   sellers use them daily, but it is your account at risk, not theirs. The
   defaults post one channel at a time from your own IP, which is the sane way
   to do it. Read your platforms' terms and decide for yourself.

---

## Getting access to it

There's no hosted copy — this runs on a computer you control, which is the
point: your marketplace logins never leave your machine. You need **Node.js
20 or newer** (<https://nodejs.org>, take the LTS build).

### Option A — one command (macOS / Linux)

Paste this whole block into Terminal. It downloads, unpacks and sets up
everything in `~/reseller-app`, then asks you to choose a page password. No
Finder, no Gatekeeper prompts, no paths to type.

```bash
rm -rf ~/reseller-app && mkdir -p ~/reseller-app && cd ~/reseller-app && curl -sL -o app.zip "https://github.com/jonahquartey584-source/Digital-Business/archive/refs/heads/claude/jolly-einstein-f9xxyk.zip" && unzip -oq app.zip && cp -R Digital-Business-*/reseller/. . && rm -rf Digital-Business-* app.zip && bash setup.sh
```

(Kept on one line on purpose. It's long, but a backslash-continued block is
one stray newline away from running half a command.)

Note the leading `rm -rf ~/reseller-app`: it wipes any earlier attempt so you
get a clean slate, including any password you'd already set. Then:

```bash
npm run dev
```

and open <http://localhost:3000>. To start it again on any later day:

```bash
cd ~/reseller-app && npm run dev
```

### Option B — double-click, no terminal (macOS)

Download the ZIP, unzip it, and open the `reseller` folder. Then you have to
clear macOS's quarantine on `Start Reseller.command` once — it refuses to run
scripts downloaded from the internet until you approve them.

**On macOS 15 (Sequoia) and newer**, right-click → Open no longer works. Apple
removed that shortcut; you get *"Apple could not verify… is free of malware"*
with only **Done** and **Move to Bin**. Click **Done**, then:

> **System Settings → Privacy & Security**, scroll to the bottom, find
> *"Start Reseller.command was blocked…"* and click **Open Anyway**.

**On macOS 14 and older**, right-click `Start Reseller.command` → **Open** →
**Open**.

Either way it's a one-time approval; after that, double-clicking works.

Prefer one command to all that clicking? This clears the quarantine flag
directly, and works on every version:

```bash
xattr -d com.apple.quarantine "Start Reseller.command" setup.sh
```

Once approved, the launcher installs what's missing, asks you to choose a page
password on first run, then starts the app and opens your browser at
<http://localhost:3000>. Leave the Terminal window it opens alone — that
window is the app's engine. Close it to stop the app.

> Quarantine only blocks *launching* a script as a program. Running
> `bash setup.sh` yourself is never blocked, because you're the one starting
> bash — so Options A and C sidestep all of this.

### Option C — the setup script (macOS / Linux / Git Bash on Windows)

No Gatekeeper prompts on this route. If you already unzipped the download,
open Terminal, type `cd ` (with a trailing space), then **drag the `reseller`
folder from Finder into the Terminal window** — that pastes the exact path, so
there's nothing to type or misspell. Press Enter, then:

```bash
bash setup.sh
npm run dev
```

Starting from scratch instead:

```bash
git clone -b claude/jolly-einstein-f9xxyk \
  https://github.com/jonahquartey584-source/Digital-Business.git
cd Digital-Business/reseller
bash setup.sh
npm run dev
```

`setup.sh` checks your Node version, installs dependencies, offers to download
Chromium for the browser channels, creates `.env`, and asks you to choose the
page password. It's safe to re-run — it only fills in what's missing.

### Option D — no git, or Windows without Git Bash

1. Open <https://github.com/jonahquartey584-source/Digital-Business/tree/claude/jolly-einstein-f9xxyk>
2. **Code → Download ZIP**, and unzip it.
3. Open a terminal (PowerShell on Windows) in the `reseller` folder inside it.
4. Run:

```bash
npm install
npx playwright install chromium     # only for Poshmark/Depop/Mercari/etc.
copy .env.example .env              # macOS/Linux: cp .env.example .env
npm run set-password -- --write
npm run dev
```

Then open <http://localhost:3000> and sign in with the password you chose.

At that point it's reachable from that computer only. To use it from your
phone, see [Making it a private page](#making-it-a-private-page-you-can-reach-from-anywhere).

---

## Quick start (if you've already set it up)

```bash
npm run dev                         # or: npm run build && npm start
```

## Updating

```bash
npm run update
```

Replaces the code and leaves your data alone — your password, API keys,
marketplace logins (`data/profiles/`), photos and post history all survive.
It also lists any new settings this version added, without touching the ones
you've already set.

Do **not** re-run the install command from *Getting access* to update: it
deletes the whole folder, including the browser logins you set up.

Open <http://localhost:3000>. The startup log prints exactly which channels are
ready and what each of the others is still missing:

```
  Channels ready:  1/14
                   Story handoff (phone)

  Still to set up:
    · eBay: EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, ...
    · Poshmark: Browser login (run: npm run login -- poshmark)
```

Nothing has to be configured to start — the phone handoff channel works out of
the box, and you can add the rest one at a time.

---

## Making it a private page you can reach from anywhere

The app is password-protected and, until you set a password, **refuses every
request that isn't from localhost**. That's deliberate: forgetting to set one
before putting the app behind a tunnel would otherwise publish your listing
tool — and your logged-in marketplace sessions — to the internet.

### 1. Set a password

```bash
npm run set-password
```

Type it twice (nothing is echoed), and it prints the line to paste into `.env`:

```
ADMIN_PASSWORD_HASH=scrypt$1a2b…
```

The password is hashed with scrypt and never stored anywhere — not in `.env`,
not in the database, not in your shell history. Restart, and the app asks for
it at `/login`. A session lasts 30 days (`SESSION_TTL_DAYS`) in an HttpOnly
cookie, so you sign in once per device.

### 2. Give it a private URL

The app needs a real server — SQLite, the queue worker, Chromium for the
browser channels — so it can't be a static site or a serverless function.
Two sensible shapes:

**Run it on your own machine, reachable through a tunnel.** This is the one to
pick. The browser sessions stay on your computer, posting to Poshmark keeps
coming from your home IP rather than a datacenter, and you get https for free:

```bash
cloudflared tunnel --url http://localhost:3000
```

Paste the https URL it prints into `PUBLIC_BASE_URL`, set `TRUST_PROXY=1`, and
restart. That one change also unlocks eBay, Instagram and Facebook, which need
a public URL to fetch your photos from.

For a stable address instead of a random one each run, use a named tunnel and
put **Cloudflare Access** in front of it (free tier). Access adds a second
gate — a one-time code to your email — before a request ever reaches the app.
Password *and* Access is the setup I'd run.

**Or deploy to a small VPS** (Fly.io, Railway, Hetzner, a $5 droplet) with a
persistent disk for `data/`. Everything works, but be aware the browser
channels would then log into Poshmark and Depop from a datacenter IP, which is
more likely to trip their fraud checks. If you use those channels, prefer the
tunnel.

### What stays public, and why

`/media` is served without authentication, because eBay, Instagram and
Facebook publish by *fetching* those URLs themselves and can't send a header.
So the files are made unguessable instead: each product's photos live under a
random 32-character token (`/media/9f3c…a1/story.jpg`), never under a
predictable product id, and the directory can't be listed. Photos you're
about to publish to a marketplace anyway are the only thing exposed.

Everything else — the UI, the whole `/api`, the phone handoff page — is behind
the session. `/healthz` returns `{ok:true}` and nothing more, for process
supervisors.

`APP_API_KEY` is optional and separate: a header-based way in for scripts and
cron jobs, when you don't want a browser session.

---

## The public URL requirement

eBay, Instagram and Facebook don't accept photo *uploads*. You give them a URL
and **they** come and download the image. So those four channels stay disabled
until `PUBLIC_BASE_URL` is a real public https URL — which the tunnel in the
section above gives you, so setting that up covers this too.

Shopify, Poshmark, Depop, Vinted, Mercari, Marketplace, OfferUp and Snapchat
all work fine without it.

EXIF is stripped from every upload, so the GPS coordinates of wherever you
shot the photo don't ride along to the marketplace.

---

## Per-channel setup

### eBay

eBay needs eleven settings, so there's a guided setup rather than a checklist:

```bash
npm run ebay:setup
```

Get two things from eBay first, then the script does the rest:

1. **A developer app** — <https://developer.ebay.com> → sign in → *Application
   Keys* → create a **production** keyset. You want the *App ID (Client ID)*
   and *Cert ID (Client Secret)*.
2. **A RuName** — on that same page, *User tokens* → *Get a Token from eBay via
   Your Application* → add a redirect URL. eBay shows an RuName like
   `Your-Name-PRD-abc123-xyz789`. Copy the **RuName**, not the URL.

Also switch on Business Policies for your seller account (Seller Hub → Account
→ Business policies) with one each of shipping, payment and returns. The script
reads them; it can't create them.

It then prints a consent URL, takes the code eBay redirects you back with,
exchanges it for a refresh token, lists your policies for you to pick from,
finds or creates a ship-from location, and writes all eleven values to `.env`.

The only thing it can't discover is `EBAY_DEFAULT_CATEGORY_ID` — the category
you mostly sell in. It suggests `11450` (Clothing, Shoes & Accessories) as a
workable default and explains how to find a narrower one.

Answer yes to the sandbox question to practise against eBay's test
environment first, which sets `EBAY_ENV=sandbox`.

### Etsy

1. Register an app at <https://developers.etsy.com> → keystring = `ETSY_API_KEY`.
2. Run the OAuth 2.0 PKCE flow once with `listings_w listings_r shops_r` and
   keep the refresh token.
3. From your shop: `ETSY_SHOP_ID`, `ETSY_SHIPPING_PROFILE_ID`, and a
   `ETSY_TAXONOMY_ID` for your product type.

### Shopify

Store admin → Settings → Apps → **Develop apps** → create an app, grant
`write_products`, install it, copy the Admin API access token.

### Instagram + Facebook

Both use the same Meta app:

1. Your Instagram must be a **Business or Creator** account linked to a
   Facebook Page.
2. Create a Meta app → add *Instagram Graph API* and *Facebook Login*.
3. Grant `instagram_basic`, `instagram_content_publish`, `pages_show_list`,
   `pages_manage_posts`, `pages_read_engagement`.
4. Get a long-lived Page access token and your IG user id
   (`GET /me/accounts` → `instagram_business_account`).

### Snapchat

Posts to a Snapchat **Public Profile** story. Public Profiles are free — create
one in the Snapchat app under your profile settings.

1. Create the Public Profile in-app, and note its profile id.
2. Register an app at <https://developers.snap.com> and request access to the
   **Public Profile API**. Your client ID must be added to Snap's allowlist;
   this is a review, not an instant toggle.
3. Run the OAuth flow once with the `snapchat-profile-api` scope and keep the
   refresh token.
4. Fill in `SNAPCHAT_PROFILE_ID`, `SNAPCHAT_CLIENT_ID`,
   `SNAPCHAT_CLIENT_SECRET`, `SNAPCHAT_REFRESH_TOKEN`.

Then **verify before you rely on it**:

```bash
npm run snapchat:verify -- --media
```

This gets a token, reads your profile, creates a throwaway media container,
and prints the **raw API responses**. Nothing is posted.

Why that matters: Snap's docs weren't reachable from the environment this was
built in, so while the endpoints and the flow are right, the exact response
*field names* are unverified. The adapter therefore looks each value up
through a list of candidate paths (`MEDIA_ID_PATHS`, `UPLOAD_URL_PATHS`,
`STORY_ID_PATHS` in `src/channels/snapchat-api.ts`) and, if none match, fails
with the raw response and the paths it tried. Compare the verify output against
those lists; if a path is missing, add it to the front of the array. That's the
whole fix.

The upload itself is not a plain file POST — Snapchat has you generate an AES
key and IV, hand them over when creating the media container, then upload the
*encrypted* bytes in chunks. That part is in `snapchat-crypto.ts` and is
covered by tests, so it's the piece least likely to need touching.

### Browser channels (Poshmark, Depop, Vinted, Mercari, Marketplace, OfferUp)

Log in once per channel. A real browser window opens and **you** type your
password — this tool never sees or stores it, only the resulting cookies:

```bash
npm run login -- poshmark
```

Sessions land in `data/profiles/<channel>/` — a real Chrome profile, so the
cookies age the way a normal browser's do. They last weeks; when one expires
the channel fails with a message telling you to re-run the command.

Close Google Chrome before running a login: Chrome locks a profile directory
while it's open, and Playwright can't attach to a locked one.

---

## Dry runs, and fixing selectors when a site changes

The browser flows in `src/channels/browser/flows.ts` are marked
`verified: false`. They follow each site's current form structure and list two
or three fallback selectors per field, but **they have not been run against a
live seller account** — doing that needs your login. So check them once before
letting them post for real:

```bash
BROWSER_DRY_RUN=1 npm start
```

The flow fills the entire listing form and stops at the publish button, saving
a full-page screenshot to `data/outbox/failures/`. Look at it: did every field
land where it should? Then fix any selector in `flows.ts`, flip that flow's
`verified` to `true`, and drop the env var.

**`SELECTORS.md` walks through exactly how to do that**, including how to find
a replacement selector in about 30 seconds. Any failure — dry run or not —
saves a screenshot plus an HTML dump, so a broken selector is a quick
diagnosis rather than a mystery.

To watch it work in real time:

```bash
BROWSER_HEADFUL=1 BROWSER_SLOWMO_MS=250 npm start
```

---

## How it works

```
photos + name
      │
      ▼
 POST /api/products ──► sharp: strip EXIF, cap at 1600px, make 1:1 renders,
      │                        render the 1080×1920 story graphic
      ▼
  SQLite queue  (one row per channel, per item)
      │
      ▼
   worker  ──► channel adapter ──► posted / needs_action / failed
                                        │
                                   retry with backoff (30s, 3m, 15m)
```

The worker runs **one job at a time on purpose**. Firing the same item at five
marketplaces in parallel from one IP is exactly the pattern that gets a
reseller's account flagged, and a browser job is a whole Chromium instance.

Failures are classified rather than blindly retried: a bad token or a missing
category fails immediately with the reason, while a 429, a 5xx or a network
blip backs off and tries again.

### Layout

```
src/
  config.ts              env + paths
  core/
    auth.ts              scrypt passwords, session tokens, login throttling
    types.ts             ChannelAdapter — the one interface that matters
    media.ts             sharp pipeline + story renderer
    text.ts              SVG text measuring / wrapping / trimming
    listing.ts           per-channel title trimming, descriptions, captions
    queue.ts             the worker, retries, backoff
  channels/
    registry.ts          every channel, in UI order
    http.ts              fetch wrapper, error classification, token cache
    graph.ts             shared Meta Graph API helper
    ebay.ts etsy.ts shopify.ts instagram.ts facebook.ts
    snapchat-api.ts      Public Profile API adapter
    snapchat-crypto.ts   AES media encryption + chunking (tested)
    snapchat.ts          the phone handoff fallback
    browser/
      engine.ts          runs a flow against a saved session
      flows.ts           the per-site selector recipes ← edit these
      index.ts           browser channels built from those flows
  routes/                REST API, login/logout, the phone handoff page
  web/                   the UI (plain HTML/CSS/JS, no build step)
```

### Adding a channel

Implement `ChannelAdapter` (`src/core/types.ts`) and add it to the array in
`src/channels/registry.ts`. The UI, the queue, retries, the setup checklist and
the status dashboard all pick it up automatically — `missingConfig()` is what
drives the "still to set up" list.

For a site with no API you usually don't need a new adapter at all: add a
`Flow` to `flows.ts` and one `makeBrowserAdapter({...})` call.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with reload |
| `npm run build && npm start` | Production build and run |
| `npm test` | Test suite |
| `npm run typecheck` | Types only |
| `Start Reseller.command` | Double-click (macOS) — sets up if needed, then runs |
| `./setup.sh` | First-run setup: deps, Chromium, `.env`, password |
| `npm run update` | Update the code, keeping `.env` and `data/` |
| `npm run set-password -- --write` | Set the page password, saved into `.env` |
| `npm run login -- <channel>` | One-time browser login for a channel |
| `npm run ebay:setup` | Guided eBay setup — writes all 11 settings to `.env` |
| `npm run snapchat:verify -- --media` | Check Snapchat access, print raw API responses |

## API

All under `/api`, with `X-API-Key` when `APP_API_KEY` is set.

| Route | Purpose |
| --- | --- |
| `GET /channels` | Channels, modes, and what each is missing |
| `POST /products` | multipart: `photos[]`, `title`, `price`, `channels[]`, … |
| `GET /products` | Recent items with per-channel status |
| `GET /products/:id` | One item: media, posts, generated caption |
| `POST /posts/:id/retry` | Re-queue one channel without re-uploading |
| `GET /posts/:id/logs` | Step-by-step log for one post |
| `GET /handoff/:id` | Phone page for Snapchat / personal stories |

Plus `GET /login`, `POST /login` and `POST /logout` for the browser session.

## Data

Everything lives in `data/` (override with `DATA_DIR`): `reseller.db`
(products, queue, sessions),
`media/` (photos and story renders), `sessions/` (browser cookies — treat
these as credentials), `outbox/` (handoff assets and failure screenshots).
It's gitignored. Back it up if the listing history matters to you.
