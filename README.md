# Qp Digital — SaaS Platform

A subscription SaaS for Qp Digital: users create a free account, then pay for
individual services — a full CRM (contacts, companies, deal pipeline,
activity notes), and AI Reception (an AI that answers missed calls on the
client's own Twilio number, has a real conversation, and logs it to their
CRM). It's installable straight from the browser as a PWA on iPhone and
Android (no app store needed), and is also wrapped with
[Capacitor](https://capacitorjs.com) so it can be published to the Apple App
Store and Google Play later if you want that too.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS · Supabase
(Postgres + Auth) · Stripe Billing · Twilio · Claude (Anthropic API) ·
Capacitor.

## How it's organized

```
app/
  page.tsx                 marketing homepage
  pricing/                 public pricing page (Stripe Checkout button)
  (auth)/login, signup/    email+password auth
  auth/callback, signout/  auth route handlers
  dashboard/                protected app shell (requires login)
    page.tsx                overview / service tiles
    billing/                subscribe / manage subscription (Stripe)
    crm/                     CRM module — gated behind an active "crm" subscription
      page.tsx               dashboard: stat tiles, pipeline breakdown, recent activity
      pipeline/               deal pipeline (kanban by stage)
      contacts/               contacts list + detail w/ activity log
      companies/              companies list
    voice/                   AI Reception — gated behind an active "voice" subscription
      page.tsx                settings: Twilio credentials, business info, webhook URLs
      calls/                   call log with transcripts + AI summaries
  api/stripe/
    checkout/route.ts        creates a Stripe Checkout session
    portal/route.ts          opens the Stripe customer billing portal
    webhook/route.ts         syncs subscription status into Supabase
  api/twilio/voice/[token]/  inbound call webhooks — see "AI Reception" below
lib/
  supabase/                 browser/server/middleware Supabase clients + isSupabaseConfigured guard
  crm/actions.ts             CRM server actions (each one re-checks the subscription)
  voice/                     AI Reception: settings actions, Twilio webhook handlers, Claude calls
  crypto.ts                  AES-256-GCM encrypt/decrypt for Twilio Auth Tokens at rest
  stripe.ts                  Stripe client + PRODUCTS catalog (add new services here)
  subscription.ts            hasActiveSubscription() gate used everywhere
supabase/migrations/*.sql    full DB schema + Row Level Security policies
capacitor.config.ts          points the native app shell at your deployed site
public/manifest.json, sw.js  PWA install manifest + service worker
public/icons/                 generated app icons (see scripts/generate-icons.js)
```

### How the paywall works

1. `lib/stripe.ts` defines a `PRODUCTS` catalog (currently just `crm`). Add a
   new entry there (plus a Stripe Price) whenever you launch another service.
2. `subscriptions` is a Postgres table, one row per `(user, product)`,
   written **only** by the Stripe webhook using the service-role key.
3. `hasActiveSubscription("crm")` (`lib/subscription.ts`) checks that table.
   It's called in three places for defense in depth: the CRM layout (page
   redirect), every CRM server action (data mutations), and the dashboard
   overview (UI state). Row Level Security also scopes every CRM row to
   `owner_id = auth.uid()`, so even a signed-in, unsubscribed user's queries
   return nothing.
4. Adding a second paid service is: add it to `PRODUCTS`, create its tables
   with an `owner_id` RLS policy (copy the CRM ones), gate its routes with
   `hasActiveSubscription("your-service")`.

### Data model note

Every CRM row is owned by a single user (`owner_id`). This is the simplest
correct model for launch. If you later want teams (multiple people sharing
one company's CRM data), add an `organizations` + `memberships` table and
swap `owner_id = auth.uid()` policies for a membership check — the CRM
pages/actions don't need to change shape, just the RLS policies and the
`owner_id` you write on insert.

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run `supabase/migrations/0001_init.sql`, then
   `0002_voice.sql`.
3. Copy **Project URL**, **anon public key**, and **service_role key** from
   Project Settings → API.

### 3. Create Stripe products

1. In the Stripe Dashboard, create two products, each with a recurring
   monthly Price: "CRM" and "AI Reception". Copy each Price ID (`price_...`).
2. Create a webhook endpoint pointing at
   `https://YOUR-DOMAIN/api/stripe/webhook`, subscribed to:
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`.
   Copy the signing secret (`whsec_...`).
   - For local development, use the [Stripe CLI](https://stripe.com/docs/stripe-cli):
     `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

### 4. Get an Anthropic API key (powers AI Reception)

Create a key at [console.anthropic.com](https://console.anthropic.com) →
API Keys. This is **your** key, used for every client's AI phone
conversations and call summaries — it's a platform cost, not something each
client provides.

### 5. Generate an encryption key

Each client's Twilio Auth Token is encrypted before it's stored. Generate a
key once and keep it secret:

```bash
openssl rand -base64 32
```

### 6. Configure environment variables

```bash
cp .env.example .env.local
# then fill in the values from steps 2–5
```

### 7. Run it

```bash
npm run dev
# http://localhost:3000
```

Sign up, then visit `/pricing` or `/dashboard/billing` to subscribe to CRM
(use Stripe test card `4242 4242 4242 4242`, any future date/CVC).

## Deploying the website

Any Node host works. [Vercel](https://vercel.com) is the path of least
resistance for Next.js; this repo also ships a `netlify.toml` (pins
`@netlify/plugin-nextjs`) if you'd rather deploy to
[Netlify](https://netlify.com) — either way:

1. Push this repo to GitHub (already done if you're reading this from the
   repo) and import it in Vercel or link it in Netlify.
2. Add the same environment variables from `.env.local`, with
   `NEXT_PUBLIC_SITE_URL` set to your real production URL.
3. Point your Stripe webhook endpoint and Supabase's "Site URL" / redirect
   allow-list at that same production URL.

The app is written to **degrade gracefully without Supabase configured**
(`lib/supabase/config.ts`'s `isSupabaseConfigured`): every page still
renders, sign-in just shows a clear "not set up yet" message instead of
crashing. Safe to deploy before every credential above is wired up.

## AI Reception — how numbers get provisioned

**The platform (you) holds one Twilio account and pays for every client's
usage.** Clients never see or enter Twilio credentials — subscribing to AI
Reception auto-provisions a number for them with zero setup on their end.
This is a deliberate business-model choice (see `lib/voice/provisioning.ts`
and `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` in `.env.example`), not the
only valid one — the tradeoff is real and worth restating:

- **You carry the cost** of every client's calls/SMS on your own Twilio
  bill. Nothing here caps it — set up
  [Twilio usage alerts](https://console.twilio.com/us1/billing/manage-billing/usage-triggers)
  and/or price it into the $49/mo before you have many clients on it.
- **You carry the reputational/abuse liability** on those numbers, since
  they're Subaccounts under your own Twilio account.
- **Numbers are released automatically on cancellation**
  (`app/api/stripe/webhook`'s `customer.subscription.deleted` handler calls
  `releaseNumberForUser`) specifically because Twilio bills monthly number
  rental regardless of usage — an orphaned number left behind after a
  churned client is a real, silent cost leak if this weren't wired up.

**What a client does, once, in `/dashboard/voice`:** subscribe to AI
Reception, pick a country (+ optional area code), click a number from the
search results, and it's live — `lib/voice/provisioning.ts` creates a
Twilio Subaccount for them behind the scenes, buys the number under it, and
points its voice webhooks at this app automatically. They separately fill
in what the AI should know about their business (services, hours, pricing)
and, optionally, a real phone number to ring first before the AI picks up.

That's it — calls to that number now go through the flow below.

**How a call flows** (`app/api/twilio/voice/[token]/*`, `lib/voice/*`):

1. **Inbound call** → if a forwarding number is set, Twilio rings it first
   (`<Dial>`, 18s timeout); otherwise the AI answers immediately.
2. **Unanswered/no forwarding number** → the AI greets the caller and the
   conversation begins.
3. **Each turn** → Twilio transcribes the caller's speech (`<Gather
   input="speech">`) and POSTs the text to `.../gather`; that handler calls
   Claude with the business context + conversation so far, gets a short
   spoken reply, and returns TwiML that speaks it and listens for the next
   turn. **This is one HTTP request per turn, not a persistent audio
   stream** — deliberately, so it runs on ordinary serverless functions
   (Netlify/Vercel) with no dedicated server to host. The tradeoff is
   turn-based latency (roughly 1–2s per exchange) rather than true
   full-duplex conversation; upgrading to Twilio's `<ConversationRelay>` /
   Media Streams for lower-latency streaming audio is possible but needs a
   long-lived WebSocket server, which is a real infra addition beyond what
   this app hosts today.
4. **Call ends** → Twilio's "Call status changes" webhook (`.../status`)
   fires once, generating a short AI summary and — if the client also has
   an active CRM subscription — finding or creating a CRM contact by phone
   number and logging the call as an activity.

**Known limitations to be aware of:**

- CRM contact matching is an **exact string match** on phone number (no
  normalization of formatting/country codes yet).
- A caller who stays completely silent gets one reprompt, then the AI ends
  the call; a very long call is capped (`MAX_CALLER_TURNS` in
  `app/api/twilio/voice/[token]/gather/route.ts`) so a stuck conversation
  can't run indefinitely.
- Each client's Subaccount Auth Token is encrypted at rest (`lib/crypto.ts`,
  AES-256-GCM) but decrypted server-side on every webhook call — normal
  for a webhook that must reconstruct Twilio's signature, but worth
  knowing if you're doing a security review.
- One number per client, no self-serve number change beyond "release, then
  provision a new one" (`releaseVoiceNumber` / the number picker in
  `lib/voice/actions.ts`).
- No built-in per-client usage/cost dashboard yet — Twilio's Subaccount
  Usage Records API (queryable per `twilio_account_sid`) is the natural
  place to build one if/when you need per-client cost visibility.

## Install as an app — no app store needed

The site is a fully installable PWA (Progressive Web App): once it's
deployed, anyone can add it to their home screen and get a real app icon
that opens full-screen, with no App Store or Play Store involved.

- **iPhone/iPad (Safari):** open the site → tap the **Share** icon → **Add
  to Home Screen**. This is the only realistic no-app-store path on iOS —
  Apple doesn't allow general sideloading for end users (Ad Hoc distribution
  caps out at 100 registered devices, and the Enterprise Program is
  contractually for internal company use only, not customer distribution).
- **Android/Samsung (Chrome):** open the site → tap **Install app** in the
  banner this app shows itself (`components/pwa-install.tsx`), or use
  Chrome's own install icon in the address bar.

This works today, on the same code, without touching Capacitor or app
stores — see `public/manifest.json` (icons, name, start URL),
`public/sw.js` (the service worker that makes Chrome consider the site
installable), and `components/pwa-install.tsx` (the install banner/button,
plus iOS "Add to Home Screen" instructions since iOS has no install-prompt
API).

**Branding:** the app icon is currently a generated placeholder ("Qp" on a
blue square). To use your real logo, replace `scripts/logo-source.svg` and
`scripts/logo-maskable-source.svg`, then run `npm run icons` to regenerate
everything in `public/icons/`.

**Android APK, if you also want a directly-downloadable file:** the same
Capacitor project below (`npm run cap:add` → open in Android Studio →
Build → Generate Signed APK) produces an `.apk` you can host on your own
site for direct download — still no Play Store required, just a file the
user downloads and installs (Android will prompt them to allow "install
from unknown sources" once).

## Mobile app (iOS / Android via Capacitor)

The native app is a thin Capacitor shell that loads your **deployed** site
(`capacitor.config.ts` → `server.url`), so the app always shows the same
CRM, auth, and billing as the website — no separate mobile deploy pipeline.

This part needs to run on your machine (or a Mac, for iOS), since it needs
Xcode/Android Studio, which aren't available in this environment.

1. Set `server.url` in `capacitor.config.ts` to your production URL (or
   export `NEXT_PUBLIC_SITE_URL` before running the commands below).
2. Add the native projects (generates `ios/` and `android/` — gitignored by
   default since they're regenerated from config, but commit them if you
   want to hand-edit native code):
   ```bash
   npm run cap:add
   ```
3. Open and run/build each platform:
   ```bash
   npm run cap:open:ios      # opens Xcode — requires a Mac + Apple Developer account ($99/yr)
   npm run cap:open:android  # opens Android Studio — requires a Google Play account ($25 one-time)
   ```
4. In Xcode: set your Team/signing, app icons, and splash screen, then
   Product → Archive → Distribute App to submit to App Store Connect.
5. In Android Studio: Build → Generate Signed App Bundle, then upload it in
   the Google Play Console.

You'll need to supply your own app icon/splash assets (Capacitor's
[`@capacitor/assets`](https://github.com/ionic-team/capacitor-assets) tool
generates all required sizes from one source image) and fill out each
store's listing (screenshots, description, privacy policy URL — this app's
privacy policy should cover the Supabase/Stripe data it collects).

Stripe in-app purchases: Apple/Google require in-app digital purchases to
go through their own IAP systems in many cases. Since this app's
subscription is a **business/productivity tool** (not digital content
consumed in-app), Stripe billing on a WebView is generally acceptable under
both stores' "reader app"/external-services rules — but review Apple's
current App Store Review Guidelines §3.1 before submitting, since policy
changes over time.

## Extending: adding a new paid service

1. `lib/stripe.ts`: add an entry to `PRODUCTS` (slug, name, description,
   `STRIPE_<SLUG>_PRICE_ID` env var, price label).
2. Add its Price in Stripe and set the env var.
3. `supabase/migrations/000X_<service>.sql`: create its tables with an
   `owner_id uuid references auth.users` column and an RLS policy copied
   from the CRM tables in `0001_init.sql`.
4. `app/dashboard/<service>/layout.tsx`: copy `app/dashboard/crm/layout.tsx`,
   swap the `hasActiveSubscription("crm")` call for your new slug.
5. `lib/<service>/actions.ts`: copy `lib/crm/actions.ts`'s pattern —
   every mutation starts by re-checking the subscription.
6. Add a tile for it on the marketing homepage, pricing page, and dashboard
   overview (currently shown as "Coming soon" placeholders).
