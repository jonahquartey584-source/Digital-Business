# Qp Digital — SaaS Platform

A subscription SaaS for Qp Digital: users create a free account, then pay for
individual services — starting with a full CRM (contacts, companies, deal
pipeline, activity notes). The same app is wrapped with [Capacitor](https://capacitorjs.com)
so it can be published to the Apple App Store and Google Play.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase
(Postgres + Auth) · Stripe Billing · Capacitor.

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
      page.tsx               deal pipeline (kanban by stage)
      contacts/               contacts list + detail w/ activity log
      companies/              companies list
  api/stripe/
    checkout/route.ts        creates a Stripe Checkout session
    portal/route.ts          opens the Stripe customer billing portal
    webhook/route.ts         syncs subscription status into Supabase
lib/
  supabase/                 browser/server/middleware Supabase clients
  crm/actions.ts             CRM server actions (each one re-checks the subscription)
  stripe.ts                  Stripe client + PRODUCTS catalog (add new services here)
  subscription.ts            hasActiveSubscription() gate used everywhere
supabase/migrations/0001_init.sql   full DB schema + Row Level Security policies
capacitor.config.ts          points the native app shell at your deployed site
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
2. In the SQL Editor, run `supabase/migrations/0001_init.sql`.
3. Copy **Project URL**, **anon public key**, and **service_role key** from
   Project Settings → API.

### 3. Create a Stripe product

1. In the Stripe Dashboard, create a product "CRM" with a recurring monthly
   Price. Copy its Price ID (`price_...`).
2. Create a webhook endpoint pointing at
   `https://YOUR-DOMAIN/api/stripe/webhook`, subscribed to:
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`.
   Copy the signing secret (`whsec_...`).
   - For local development, use the [Stripe CLI](https://stripe.com/docs/stripe-cli):
     `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

### 4. Configure environment variables

```bash
cp .env.example .env.local
# then fill in the Supabase and Stripe values from steps 2–3
```

### 5. Run it

```bash
npm run dev
# http://localhost:3000
```

Sign up, then visit `/pricing` or `/dashboard/billing` to subscribe to CRM
(use Stripe test card `4242 4242 4242 4242`, any future date/CVC).

## Deploying the website

Any Node host works; [Vercel](https://vercel.com) is the path of least
resistance for Next.js:

1. Push this repo to GitHub (already done if you're reading this from the
   repo) and import it in Vercel.
2. Add the same environment variables from `.env.local`, with
   `NEXT_PUBLIC_SITE_URL` set to your real production URL.
3. Point your Stripe webhook endpoint and Supabase's "Site URL" / redirect
   allow-list at that same production URL.

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
