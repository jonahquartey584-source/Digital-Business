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

3. **Browser automation is against several platforms' terms of service.**
   Crosslisting tools (Vendoo, List Perfectly, Crosslist) all work this way and
   sellers use them daily, but it is your account at risk, not theirs. The
   defaults post one channel at a time from your own IP, which is the sane way
   to do it. Read your platforms' terms and decide for yourself.

---

## Quick start

```bash
cd reseller
npm install
npx playwright install chromium     # only needed for the browser channels
cp .env.example .env                # then fill in whatever you want to use
npm run dev                         # or: npm run build && npm start
```

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

Shopify, Poshmark, Depop, Mercari, Marketplace, OfferUp and Snapchat all work
fine without it.

EXIF is stripped from every upload, so the GPS coordinates of wherever you
shot the photo don't ride along to the marketplace.

---

## Per-channel setup

### eBay

1. Create an app at <https://developer.ebay.com> → get your Client ID / Secret.
2. Do the OAuth consent flow once with the `sell.inventory` scope and keep the
   **refresh token** (it lasts 18 months).
3. In Seller Hub, create a fulfillment (shipping), payment and return policy,
   and an inventory location. Put their ids in `.env`.
4. Find the category id for what you sell (eBay's category tree, or copy it
   from a similar live listing) → `EBAY_DEFAULT_CATEGORY_ID`.

Set `EBAY_ENV=sandbox` to practise against eBay's sandbox first.

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

### Browser channels (Poshmark, Depop, Mercari, Marketplace, OfferUp)

Log in once per channel. A real browser window opens and **you** type your
password — this tool never sees or stores it, only the resulting cookies:

```bash
npm run login -- poshmark
```

Sessions land in `data/sessions/<channel>.json`. They last weeks; when one
expires the channel fails with a message telling you to re-run the command.

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
| `npm run set-password` | Generate the `ADMIN_PASSWORD_HASH` for `.env` |
| `npm run login -- <channel>` | One-time browser login for a channel |
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
