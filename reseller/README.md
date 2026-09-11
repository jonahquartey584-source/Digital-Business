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
| Snapchat Story | One-tap handoff | Snapchat has **no API** for posting to My Story. See below. |

### Three limitations worth knowing up front

1. **Snapchat cannot be fully automated by anyone.** Snapchat's Marketing API
   is for paid ads, and Creative Kit only hands media to the Snapchat app from
   inside a native mobile app you've shipped. No server can post to your My
   Story. This app gets as close as is possible: it renders the story, writes
   the caption, and serves a phone page with **Save image** and **Copy
   caption** buttons. Two taps instead of ten minutes.

2. **Facebook and Instagram stories work for business accounts, not personal
   profiles.** Meta's API can post to a *Page* story and to an *Instagram
   Business/Creator* story. There is no API for a personal Facebook profile
   story. If you post from a personal account, use the handoff page for those
   too — same flow as Snapchat.

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
  Channels ready:  1/13
                   Snapchat Story

  Still to set up:
    · eBay: EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, ...
    · Poshmark: Browser login (run: npm run login -- poshmark)
```

Nothing has to be configured to start — Snapchat handoff works out of the box,
and you can add channels one at a time.

### Set an API key before exposing this anywhere

`APP_API_KEY` protects the whole `/api` surface. Leave it empty on localhost;
set it the moment the app is reachable by anyone else:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Paste it into `.env`, then into the key box at the top right of the UI (it's
remembered in your browser).

---

## The public URL requirement

eBay, Instagram and Facebook don't accept photo *uploads*. You give them a URL
and **they** come and download the image. So your `/media` folder has to be
reachable from the internet, and those channels stay disabled until
`PUBLIC_BASE_URL` is a real public https URL.

On a laptop, a tunnel is the easy way:

```bash
cloudflared tunnel --url http://localhost:3000
#   or: ngrok http 3000
# paste the https URL it prints into PUBLIC_BASE_URL, then restart
```

Shopify, Poshmark, Depop, Mercari, Marketplace, OfferUp and Snapchat all work
fine without it.

> `/media` is served without an API key, because the platforms fetching it
> can't send a header. Only product photos live there — and they're photos
> you're about to publish anyway. EXIF is stripped on upload, so the GPS
> coordinates of wherever you shot the photo don't ride along.

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
    types.ts             ChannelAdapter — the one interface that matters
    media.ts             sharp pipeline + story renderer
    text.ts              SVG text measuring / wrapping / trimming
    listing.ts           per-channel title trimming, descriptions, captions
    queue.ts             the worker, retries, backoff
  channels/
    registry.ts          every channel, in UI order
    http.ts              fetch wrapper, error classification, token cache
    graph.ts             shared Meta Graph API helper
    ebay.ts etsy.ts shopify.ts instagram.ts facebook.ts snapchat.ts
    browser/
      engine.ts          runs a flow against a saved session
      flows.ts           the per-site selector recipes ← edit these
      index.ts           browser channels built from those flows
  routes/                REST API + the phone handoff page
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
| `npm run login -- <channel>` | One-time browser login for a channel |

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

## Data

Everything lives in `data/` (override with `DATA_DIR`): `reseller.db`,
`media/` (photos and story renders), `sessions/` (browser cookies — treat
these as credentials), `outbox/` (handoff assets and failure screenshots).
It's gitignored. Back it up if the listing history matters to you.
