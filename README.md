# Qp Digital

A website for Qp Digital, a digital services business — websites, CRM,
SEO, booking systems, branding, reporting dashboards and automation.
Three pages: a one-page marketing site (`index.html`), a client "redeem
your service" page (`activate.html`), and an internal, unlinked "generate
a new client's account + code" tool (`admin.html`) — plus a small PHP/MySQL
backend under `api/` (see [Going live: automatic activation](#going-live-automatic-activation-on-payment))
that makes payment genuinely trigger activation, built for PHP shared
hosting (e.g. InfinityFree). Everything works without the backend too — it
falls back to a static, manually-maintained list — just without live
payment status.

## Sections

- **Hero** — headline pitch and quick calls to action
- **Services** — all services on offer, laid out as a card grid:
  - Websites
  - CRM
  - Website Management
  - SEO
  - Booking System
  - Logo, branding, flyers &amp; business cards
  - Online menus, price lists &amp; brochures
  - Reporting dashboards (leads, calls, bookings, sales)
  - Automation systems
  - Automated follow-ups (missed calls, quotes, reviews)
  - Chatbots / live chat
  - Plus a "Something Else?" card — the business is open to any digital
    project, not just what's listed
- **How It Works** — the enquiry → quote (negotiable) → account number &amp;
  activation code → pay → service goes live flow, including an example
  "account record" shown as a terminal/JSON block, and a CTA into the
  activate page
- **Enquire** — a form visitors fill in to request a service (name,
  business name, business address, email, phone, service, details);
  submitting it opens a pre-filled email to the business
- **Footer / Contact** — contact details and quick links
- **"Already a client?" banner** — a bar right below the header, above the
  hero, plus a pill link in the nav, both pointing at `activate.html` so
  returning clients don't have to hunt for it
- **Redeem a Service** (`activate.html`) — a client enters the account
  number and activation code you gave them; if it matches, they see an
  order summary (the service, a short preview, and the price you quoted
  them) and a "Pay & Activate" button linking to their payment link — or,
  if they've already paid, a "Service Active" panel with a link straight
  to their live site (see [Activating clients](#activating-clients) below)
- **New Client Setup** (`admin.html`) — an internal tool, not linked from
  anywhere on the public site, where you generate a random account number
  + activation code for a client and either save them straight to the live
  database or get a fallback `accounts-data.js` snippet, plus a message to
  send them (see
  [Generating a client's account + code](#generating-a-clients-account--code))

## Design

Black-and-gold "tech" look: **Playfair Display** for the wordmark (the "Qp
Digital" logotype is text only — no icon/logo mark — set in a serif with a
metallic gold gradient fill), **Sora** for headings, **IBM Plex Sans** for
body copy, and **IBM Plex Mono** for labels/eyebrows/numerals/terminal chrome
(all via Google Fonts). Custom inline SVG line icons per service (no emoji,
no icon-font dependency). Terminal/code-block styling (window chrome,
JSON-style key/value lines, a blinking cursor, `$`/`>` prompt marks)
reinforces the "tech" identity and doubles as the real UI for the
account/code lookup and the New Client Setup tool. Sections reveal on scroll
via a small `IntersectionObserver` enhancement in `script.js` — this
degrades gracefully (a `<noscript>` rule in each page forces everything
visible if JavaScript is off).

## Activating clients

`activate.html` is where a client redeems their account number + activation
code:

1. A client enquires (via the homepage form) and you agree a price.
2. You set up their paid service — e.g. a Stripe Payment Link — and, for a
   website, upload their site to your host but gate it behind `api/gate.php`
   so it isn't publicly visible yet (see the deployment section below).
3. Open `admin.html`, fill in the service/price/preview/payment link (and
   live URL, for a website client), click **Generate Account & Code**, then
   **Save To Live Database**.
4. Send the client their account number and code — `admin.html` writes you
   a ready-to-send message for this.
5. They go to `activate.html`, enter both, and see an order summary built
   from the service, preview and price you set — exactly what they agreed
   to — with a "Pay & Activate" button linking to their payment link.
6. The moment Stripe confirms their payment, a webhook flips their account
   to active automatically — no manual step. If they check `activate.html`
   again (or their account was already active when they first checked), they
   see a "Service Active" panel instead, with a link straight to their live
   site if you gave one.

This whole flow needs the `api/` backend deployed (see next section). Until
then, `admin.html`'s **Save To Live Database** button will fail (with a
message telling you so) and fall back to the same experience as before:
copy the generated snippet into `accounts-data.js` and redeploy — the client
can still redeem their code and see the payment link, just without live
status or automatic activation.

## Going live: automatic activation on payment

This is what makes "pay → your website goes live instantly" actually true,
built for **InfinityFree** (or any PHP + MySQL shared host) since that's
where this site is meant to run. No Node.js, no Composer/shell access
needed — plain PHP + PDO, and Stripe's webhook signature is verified by
hand (`api/webhook.php`) rather than via their SDK.

**How it works:** each client's row in a `clients` MySQL table holds their
account number, code, service, price, preview, payment link, optional live
site URL, and a `status` (`pending_payment` or `active`). `activate.html`
calls `api/redeem.php` to look a client up — the account list itself never
reaches the browser, unlike the `accounts-data.js` fallback. When Stripe
confirms a payment, it calls `api/webhook.php`, which verifies the request
really came from Stripe and flips that client's `status` to `active`. For a
website client, `api/gate.php` (included at the top of their site's real
`index.php`) checks that same status on every visit — the moment it's
`active`, their actual site starts rendering instead of a "coming soon"
placeholder. That's the whole mechanism: no separate "publish" step, no
polling, nothing else to trigger.

**One honest limit:** this genuinely automatic path — a single check that
flips a whole site from hidden to live — really only fits the **website**
service. For SEO, CRM setup, branding, chatbots, etc. there's no equivalent
single switch; `status` still flips to `active` instantly (so you always
know the moment payment lands, without checking Stripe or your inbox), but
actually delivering the work is still on you.

### Deployment steps

1. **Create the MySQL database.** In your InfinityFree control panel →
   MySQL Databases, create one and note the hostname, database name,
   username and password it gives you (the hostname is something like
   `sqlXXX.infinityfree.com`, not `localhost`).
2. **Import the schema.** Open phpMyAdmin (linked from the same control
   panel), select your database, and run `api/schema.sql` (Import tab, or
   paste it into the SQL tab).
3. **Configure the backend.** Copy `api/config.example.php` to
   `api/config.php` and fill in the database credentials from step 1, a
   real `ADMIN_PASSWORD`, and (for now) leave `STRIPE_WEBHOOK_SECRET` as a
   placeholder — you'll get the real value in step 6. `api/config.php` is
   gitignored — never commit it.
4. **Upload everything.** Upload the whole site (all the `.html`/`.css`/`.js`
   files plus the entire `api/` folder, `config.php` included) via FTP or
   InfinityFree's file manager, to your domain's `htdocs` folder.
5. **Test the redeem flow without Stripe yet.** Visit `admin.html` on your
   live domain, generate a test client, and confirm **Save To Live
   Database** succeeds. Then confirm `activate.html` finds it. If
   **Save To Live Database** fails, double check step 3's credentials first.
6. **Connect Stripe.** In the Stripe Dashboard → Developers → Webhooks, add
   an endpoint at `https://yourdomain.com/api/webhook.php`, subscribed to
   `checkout.session.completed`. Stripe shows you a signing secret
   (`whsec_...`) — put that in `api/config.php`'s `STRIPE_WEBHOOK_SECRET`
   and re-upload just that file.
7. **Set up each client's payment link so Stripe knows who paid.** Use a
   Stripe **Payment Link** for the service (one per service tier is enough
   — you don't need a unique link per client). `admin.html` automatically
   appends `?client_reference_id=THEIR_ACCOUNT_NUMBER` to whatever payment
   link you enter, and Stripe passes that straight through to the webhook —
   this is how `api/webhook.php` knows which client just paid. Use the
   payment link `admin.html` generates (with that parameter already on it),
   not the bare one from Stripe.
8. **Gate each website client's actual site.** At the very top of their
   site's real `index.php` (before any HTML), add:
   ```php
   <?php
   define('CLIENT_ACCOUNT_NUMBER', 'QP-2026-0158'); // their account number
   require __DIR__ . '/../api/gate.php'; // adjust the relative path to your api/ folder
   ?>
   ```
   Until their `status` is `active`, visitors see a "coming soon" page
   instead of their real site — the moment the webhook fires, it's live.
9. **Update `REDEEM_URL`** at the top of `admin.js` to your real domain, so
   the message `admin.html` writes for you links to the right place.

### Local testing

`api/` needs PHP — plain `python3 -m http.server` won't run it. Use PHP's
own built-in server instead (from the project root):

```bash
php -S localhost:8000
```

You'll also need a MySQL (or MariaDB) server reachable from wherever you
run this, with `api/config.php` pointed at it — InfinityFree's phpMyAdmin
only exists once you've actually signed up, so for fully local testing
without an InfinityFree account yet, point `DB_HOST`/`DB_NAME`/etc. at any
MySQL instance you have (a local install, Docker, etc.) and run
`api/schema.sql` against it the same way.

### Free shared hosting — things worth knowing

InfinityFree (and free shared hosting generally) is a real trade-off for a
payment-triggered system, not just a cost saving:

- **Uptime/reliability.** If your site is down when Stripe tries to call
  `api/webhook.php`, that payment's activation is delayed. Stripe retries
  failed webhook deliveries automatically, but it's not instant.
- **Outbound connections** from free shared hosts are sometimes restricted.
  This build never needs to make an outbound call to Stripe (webhook
  verification is done locally via HMAC), so it should be unaffected — but
  it's worth knowing this is a general limitation of the platform if you
  add anything else that does.
- **No custom cron/queues.** Activation here is a direct webhook → database
  update, not a queued job, so this doesn't apply — just flagging it as a
  constraint if you build on top of this later.

If you outgrow these constraints, the same `api/` design (PHP + MySQL +
manual Stripe signature verification) works unchanged on paid PHP hosting
too — nothing here is InfinityFree-specific except the setup steps.

### Not real access control (the `accounts-data.js` fallback only)

This caveat applies only when the `api/` backend isn't deployed and
`activate.html` is using `accounts-data.js` instead. That file ships as
plain text to every visitor's browser — anyone who opens devtools or views
page source can read every account number, code, and payment link on the
list. Once `api/redeem.php` is live, this no longer applies: the account
list stays server-side and the browser only ever learns about the one
account/code pair it asked about.

## Running it

No build step. The marketing pages (`index.html` etc.) work as plain static
files — open directly, or:

```bash
python3 -m http.server 8000
```

`admin.html`'s "Save To Live Database" and `activate.html`'s live payment
status need the `api/` backend, which needs PHP — see
[Local testing](#local-testing) above. Without it, both pages still work
using the `accounts-data.js` fallback described in
[Activating clients](#activating-clients).

## Customizing

- **Business email**: update `BUSINESS_EMAIL` in `script.js` and the address
  shown in the footer of `index.html` — this is where enquiry form
  submissions are sent (via a `mailto:` link).
- **Services**: edit the cards inside the `#services` section of
  `index.html`, and keep the `<select>` options in the enquiry form
  (`#service`) in sync.
- **Colors/branding**: the palette lives at the top of `style.css` under
  `:root` (`--gold`, `--bronze`, `--bg`, etc.) — swap these for your brand
  colors.
- **Account numbers / activation codes / payments**: see
  [Activating clients](#activating-clients) and
  [Going live: automatic activation on payment](#going-live-automatic-activation-on-payment)
  above.
- **Admin password / DB credentials / Stripe webhook secret**: all in
  `api/config.php` (copy from `api/config.example.php` — gitignored, never
  commit real values).

## Files

- `index.html` — homepage markup (all marketing sections)
- `activate.html` — client "enter your account number and code" page
- `admin.html` — internal, unlinked tool to generate a new client's account
  number + activation code
- `admin.js` — the random account/code generator, payment-link builder
  (appends `?client_reference_id=...`), and the save/snippet/message logic
  behind `admin.html`
- `accounts-data.js` — offline fallback list `activate.js` uses only when
  `api/redeem.php` can't be reached (see
  [Activating clients](#activating-clients))
- `activate.js` — calls `api/redeem.php` (falling back to
  `accounts-data.js`) and renders the match/no-match/active result
- `api/config.example.php` — template for `api/config.php` (DB
  credentials, admin password, Stripe webhook secret) — copy it, fill it
  in, never commit the copy
- `api/schema.sql` — the `clients` table definition; import this into your
  MySQL database once
- `api/db.php` — shared PDO database connection helper
- `api/redeem.php` — looks up an account+code, called by `activate.js`
- `api/create_client.php` — admin-only endpoint that inserts a new client
  row, called by `admin.js`'s "Save To Live Database"
- `api/webhook.php` — Stripe webhook endpoint; verifies the signature by
  hand and flips a client's status to `active` on
  `checkout.session.completed`
- `api/gate.php` — include this at the top of a website client's real
  `index.php` to hide it until their status is `active`
- `api/.htaccess` — blocks direct web access to `api/config.php`
- `style.css` — styling for all three pages
- `script.js` — mobile nav toggle, footer year, enquiry form → email,
  scroll-reveal (shared by all pages; every selector it uses is
  null-guarded, so it's safe to load on a page missing some of those
  elements)
