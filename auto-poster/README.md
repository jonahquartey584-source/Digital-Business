# Auto-Poster

Publishes one piece of content to YouTube, Instagram, TikTok, and (with a
caveat — see below) Snapchat, from a single CLI command or a scheduled
queue. Each platform is a separate "publisher" module that wraps that
platform's *official* API — there's no scraping or unofficial automation
here, because those get accounts banned.

**You still need to register a developer app with each platform and get
your own credentials.** No system can post on your behalf without you
authorizing it — that's true of every legitimate tool, this one included.
The steps below are the actual, current requirements for each platform.

## Install

```bash
cd auto-poster
npm install
cp .env.example .env
```

## Platform setup

### YouTube
1. Create a project at [console.cloud.google.com](https://console.cloud.google.com), enable **YouTube Data API v3**.
2. Create an **OAuth 2.0 Client ID** (type: Desktop app).
3. Put the client ID/secret in `.env`, then run:
   ```bash
   node src/publishers/youtube.js --auth
   ```
   Approve access in the browser, paste the code back, and copy the
   printed refresh token into `YOUTUBE_REFRESH_TOKEN`.
4. Uploads count against a daily quota (a video upload costs 1600 of the
   default 10,000 units/day — so about 6 uploads/day on the free tier).

### Instagram
1. Requires a **Business or Creator** Instagram account linked to a
   Facebook Page.
2. Create an app at [developers.facebook.com](https://developers.facebook.com),
   add the **Instagram Graph API** product, and request the
   `instagram_content_publish` permission (App Review required for
   anything beyond your own test account).
3. Get your IG user's numeric ID and a long-lived access token; put them
   in `IG_USER_ID` / `IG_ACCESS_TOKEN`.
4. **Media must be at a public HTTPS URL** — Instagram fetches it itself,
   it doesn't accept file uploads. Use `npm run serve-media` (+ a tunnel
   like `ngrok http 4000`) for testing, or host on S3/Cloudinary for real
   use, then pass that URL as `--media-url`.
5. Rate limit: 25 posts per rolling 24 hours per IG account.

### TikTok
1. Register an app at [developers.tiktok.com](https://developers.tiktok.com)
   and request the **Content Posting API** (`video.publish` scope).
2. Complete the OAuth flow for the account you want to post from and put
   the resulting user access token in `TIKTOK_ACCESS_TOKEN`.
3. Until TikTok approves your app for public posting, posts land as
   **private/draft** on the account (`privacy_level: SELF_ONLY`) — that's
   TikTok's sandboxing, not a bug here.
4. Works with either a public `--media-url` (TikTok pulls it) or a local
   `--file` (uploaded directly). Large files may need real chunked upload;
   this implementation sends the whole file as one chunk, which TikTok
   accepts but caps by size — split bigger files yourself if you hit the
   cap.

### Snapchat — the honest limitation
Snapchat has **no public API for unattended posting** to a personal Story
or Spotlight. The only public building block, **Creative Kit**, opens the
Snapchat app with your media pre-loaded and still requires a human to tap
"Send" — that's by Snapchat's design, not a gap in this code. The
`snapchat` publisher reflects that: it builds a Creative Kit share link
and returns it with `status: "manual-step-required"` instead of pretending
to fully automate something the platform doesn't allow. If Snapchat later
ships a real publishing API, swap the implementation in
`src/publishers/snapchat.js`.

## Usage

Post immediately to multiple platforms at once:

```bash
node src/index.js post \
  --platforms youtube,tiktok \
  --file posts/media/clip.mp4 \
  --title "My video" \
  --caption "Check this out! #fyp" \
  --privacy public
```

Instagram/Snapchat need a public URL instead of `--file`:

```bash
npm run serve-media &          # serves posts/media/ on :4000
ngrok http 4000                # get a public https URL, e.g. https://abcd.ngrok.app

node src/index.js post \
  --platforms instagram \
  --media-url https://abcd.ngrok.app/media/clip.mp4 \
  --media-type reel \
  --caption "New drop 🔥"
```

Schedule a post for later instead of posting now:

```bash
node src/index.js queue:add \
  --platforms youtube,instagram,tiktok \
  --file posts/media/clip.mp4 \
  --media-url https://abcd.ngrok.app/media/clip.mp4 \
  --caption "Scheduled post" \
  --run-at 2026-08-21T09:00:00Z

node src/index.js queue:list
node src/index.js schedule   # long-running: checks every minute, posts due jobs
```

Run `schedule` under a process manager (pm2, systemd, a `screen`/`tmux`
session, or a small always-on server) if you want it to survive your
laptop closing.

## Job shape

Every command builds a "job" object with these fields (all optional except
`platforms`, and per-platform requirements noted above):

| field       | type     | used by                                  |
|-------------|----------|-------------------------------------------|
| `platforms` | string[] | all — which publishers to run             |
| `file`      | path     | YouTube (required), TikTok (alternative to `mediaUrl`) |
| `mediaUrl`  | url      | Instagram (required), Snapchat (required), TikTok (alternative to `file`) |
| `caption`   | string   | Instagram, TikTok; used as YouTube description |
| `title`     | string   | YouTube |
| `mediaType` | string   | Instagram: `image` \| `video` \| `reel` |
| `privacy`   | string   | YouTube: `public`\|`unlisted`\|`private`; TikTok: `PUBLIC_TO_EVERYONE`\|`SELF_ONLY`\|... |
| `tags`      | string[] | YouTube |

## Why partial failure is fine

`publishAll` runs every platform independently and returns a per-platform
result — one platform failing (expired token, file too large, app not yet
approved) doesn't stop the others from posting. Check `results[i].ok`
before assuming everything went out.

## Security notes

- `.env` is gitignored — never commit real tokens.
- Use the minimum scopes each platform offers (e.g. don't request full
  account management if content-publish scopes exist).
- Access tokens expire; long-lived Instagram tokens last ~60 days and
  TikTok/YouTube tokens should be refreshed via their respective refresh
  flows — this isn't handled automatically here, so watch for auth errors
  in scheduled runs.
