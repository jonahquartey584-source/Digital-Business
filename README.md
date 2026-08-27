# Qp Digital

A website for Qp Digital, a digital services business — websites, CRM,
SEO, booking systems, branding, reporting dashboards and automation.
Three pages: a one-page marketing site (`index.html`), a client "redeem
your service" page (`activate.html`), and an internal, unlinked "generate
a new client's account + code" tool (`admin.html`) — plus a real backend
that makes payment genuinely trigger activation. It ships as **two
interchangeable backends that speak the exact same request/response
shapes**, so `admin.html`/`activate.html` don't need to know or care which
one is actually live:

- **Netlify Functions + Blobs** (`netlify/functions/`) — this is what's
  actually deployed at [qp-digital.netlify.app](https://qp-digital.netlify.app).
  See [Going live on Netlify](#going-live-on-netlify).
- **PHP + MySQL** (`api/`) — for PHP shared hosting (e.g. InfinityFree)
  instead of Netlify. See
  [Going live: automatic activation on payment](#going-live-automatic-activation-on-payment).

Everything works with neither backend deployed too — it falls back to a
static, manually-maintained list — just without live payment status.

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
  "account record" shown as a plain, human-readable card (deliberately
  not code/JSON-styled — that's reserved for internal tooling, not
  anything a client sees), and a CTA into the activate page
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
- **Pipeline Tester** (`pipeline-tester.html`) — another internal, unlinked
  tool: the exact same setup → redeem → payment flow as `admin.html` and
  `activate.html`, but entirely in your browser's `localStorage`, with a
  "Simulate Payment" button standing in for a real Stripe webhook. Nothing
  you do there touches the real database — use it to try out changes or
  show someone the flow without risking a real client record.

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
   **Save To Live Database**. A few optional fields shape what the client
   sees:
   - **Title** — used for the "Preview of …" heading on `activate.html`
     (e.g. "Sarah's Bakery Website"). Defaults to the service name if left
     blank.
   - **Preview image** — attach a screenshot or mockup of what they're
     getting (for a website, a screenshot of the draft site works well).
     Choosing a file uploads it straight away via `api/upload_preview_image.php`
     (you'll need to be logged in — see [Admin login](#admin-login) below)
     and saves it into `/uploads` on your host — no URL to paste. If set,
     `activate.html` shows it as a "Preview of …" frame. If left blank, that
     section is skipped entirely and the client just sees the order summary
     below.
   - **Preview file** — optional. Where clicking the preview image sends
     the client. Attach anything — most usefully an **HTML prototype** of
     their site (it opens live, right in their browser, exactly like the
     real thing), but also a PDF proposal, a design export, whatever's
     relevant. Uploads via `api/upload_preview_file.php` the same way the
     preview image does. Leave it blank and clicking the image just opens
     the attached image itself full-size.
   - **Deliverable file** — optional. The actual finished thing for a
     non-website service — a logo, a design export, whatever they're
     paying for that isn't a website. Uploads the same way as the two
     fields above, but is handled completely differently: it's stored from
     the moment you save the client, but `api/redeem.php`/`redeem.mts`
     withhold it from every response until that client's status is
     `active` — so there's no way to fetch it before paying, even by
     reading the raw network response. The instant it does flip to active,
     `activate.html` shows a **Download Your Files →** button linking
     straight to it.
   - **Client email** — optional. Not shown to the client or anyone else —
     it only exists so you can click **Email Account & Code to Client →**
     (appears right after saving) instead of sending the message below
     yourself. See [Email](#email).
4. Send the client their account number and code — either the **Email
   Account & Code to Client** button above, or `admin.html` also writes
   you a ready-to-send message to copy-paste yourself.
5. They go to `activate.html`, enter both, and see the preview (if you set
   one) plus an order summary built from the service, preview text and
   price you set — exactly what they agreed to — with a "Pay & Activate"
   button linking to their payment link.
6. The moment Stripe confirms their payment, a webhook flips their account
   to active automatically — no manual step. If they check `activate.html`
   again (or their account was already active when they first checked), they
   see a "Service Active" panel instead: a **Visit Your Live Site** link if
   you gave one, a **Download Your Files** button if you attached a
   deliverable file, both if you gave both, or just a note that you'll be
   in touch if neither applies (e.g. an ongoing service like SEO).

This whole flow needs one of the two backends deployed (see the next two
sections) — on `qp-digital.netlify.app` that's already the case. Without
either one, `admin.html`'s **Save To Live Database** button will fail (with
a message telling you so) and fall back to the same experience as before:
copy the generated snippet into `accounts-data.js` and redeploy — the client
can still redeem their code and see the payment link, just without live
status or automatic activation.

### Viewing and editing existing clients

Below the generator, `admin.html` also lists every client already saved —
account number, service, price, and a status pill — pulled live from
`api/list_clients.php`/`list-clients.mts` the moment you log in (and again
whenever you click **Refresh**). The search box above the list filters it
instantly (client-side, against what's already loaded — no extra request)
by account number or client email. Click **Edit** on any row to open a
form pre-filled with everything about that client, change whatever's
wrong, and click **Save Changes** to write it back via
`api/update_client.php`/`update-client.mts` — or click **Delete** to
permanently remove them via `api/delete_client.php`/`delete-client.mts`
(asks you to confirm first; there's no undo).

Everything is editable except the account number itself (it's the lookup
key — renaming it would mean creating a new client, not editing this one):
title, service, price, preview text, the three attached files (choosing a
new one replaces it; leaving it blank keeps whatever's already there —
there's no separate "remove" action yet), the payment link, the live site
URL, the client's email, and **status**. Status normally only flips
automatically via the Stripe webhook — changing it by hand here is for the
exception (a client who paid you some other way, or a mistake you need to
correct), not the everyday path. Adding or changing the client's email
here also surfaces the same **Email Account & Code to Client →** button
the generator has — useful for a client you didn't have an email for at
first.

## Admin login

`admin.html` is gated behind a login — email + password + the answer to a
personal security question — rather than a single shared password typed
into every action. Log in once and **Save To Live Database** and both
upload buttons just work after that, no further prompts, for as long as the
session lasts:

- Left unchecked, **Remember me** logs you in for 12 hours, and the login
  doesn't survive closing the browser tab (kept in `sessionStorage`).
- Checked, it logs you in for 30 days and survives closing the browser
  entirely (kept in `localStorage` instead) — for your own device, not a
  shared/public one.

Either way, **Log out** ends it immediately, and logging in again always
starts a fresh session on whatever this login screen's checkbox is set to
at the time.

Set all four of these (same names on both backends — Netlify environment
variables, or the matching `define(...)` in `api/config.php` for
PHP/InfinityFree):

- `ADMIN_EMAIL` — anything you like, doesn't need to be a real inbox.
- `ADMIN_PASSWORD`
- `ADMIN_SECURITY_ANSWER` — matched case-insensitively (`Rex`, `rex`, and
  `  REX  ` all count as the same answer).
- `ADMIN_SESSION_SECRET` — not something you type in; just a long random
  string that needs to exist and stay secret (e.g.
  `php -r "echo bin2hex(random_bytes(32));"`). It's what signs the login
  session — nothing else uses it.

The security *question* itself (the label shown on the login form, e.g.
"What was the name of your first pet?") isn't an environment variable — set
it once in `admin.js`, in the `SECURITY_QUESTION` constant near the top.

Mechanically: logging in gets you a signed token — 12 hours or 30 days
depending on **Remember me** — with no server-side session store (the
token carries its own expiry and is verified by recomputing its
signature). `admin.html` holds onto it and sends it as
`Authorization: Bearer <token>` on every create-client/upload call; those
endpoints check the token instead of a password. If it expires (or you
click **Log out**), you're back at the login screen.

## Email

Two things send real email, both via [Resend](https://resend.com)'s HTTP
API (a free-tier account + one API key — no SMTP setup, no SDK). Set
`RESEND_API_KEY` (same names on both backends — a Netlify environment
variable, or `define('RESEND_API_KEY', ...)` in `api/config.php` for
PHP/InfinityFree) to turn both on; leave it unset and both degrade
gracefully rather than error (see each one below).

The sender address for both is Resend's own shared `onboarding@resend.dev`
— it works without owning or verifying a domain, which this site doesn't
have (only a `netlify.app` subdomain, which can't be verified as a
sender). If you get a real domain later, verify it in Resend and swap
`FROM_EMAIL` (`netlify/functions/_shared.mts`) / `EMAIL_FROM_ADDRESS`
(`api/email.php`) for an address on it — deliverability is meaningfully
better than a shared domain.

**Enquiry confirmations.** Submitting the homepage's enquiry form POSTs to
`api/enquiry.php` / `enquiry.mts`, which emails the visitor an automatic
"we've received your enquiry, our team will respond as quickly as
possible" confirmation, and (best-effort — its failure doesn't affect what
the visitor sees) notifies your own inbox (`ADMIN_EMAIL`) with the
enquiry's details, reply-to set to the visitor so you can just hit reply.
If `RESEND_API_KEY` isn't set, or the backend isn't deployed at all, the
form falls back to exactly what it did before either existed: building a
pre-filled email (a `mailto:` link) addressed to `BUSINESS_EMAIL`
(`script.js`) and opening the visitor's own email client — so an enquiry
is never silently lost, just less automatic.

**Emailing a client their account + code.** Add their address in the
optional **Client email** field in `admin.html` (when creating them, or
later via **Existing Clients** → **Edit**) and an **Email Account & Code
to Client →** button appears — click it and `api/send_client_email.php` /
`send-client-email.mts` sends them the exact same content as the
"Message To Send The Client" box (account number, activation code, the
redeem link), by email instead of copy-paste. The client's email address
itself is never shown to the client or anyone else — it only exists to
address this one email.

## Going live on Netlify

This is the backend actually deployed at
[qp-digital.netlify.app](https://qp-digital.netlify.app) — Netlify
Functions in place of PHP, [Netlify Blobs](https://docs.netlify.com/blobs/overview/)
in place of MySQL, otherwise mechanically the same as the InfinityFree path
below: a client record with an account number, code, service, price,
preview, payment link, optional live URL, and a `status`
(`pending_payment`/`active`) that a Stripe webhook flips the moment payment
lands.

Every function in `netlify/functions/` is deliberately routed (via its
`config.path`) at the exact same URL its `api/*.php` counterpart uses —
`create-client.mts` answers at `/api/create_client.php`, `redeem.mts` at
`/api/redeem.php`, and so on. `admin.js`/`activate.js` never had to change
at all; they just call `api/create_client.php` / `api/redeem.php` like
always, and whichever backend is actually deployed answers. Uploaded
preview images/files go into a `uploads` Blobs store instead of an
`uploads/` folder, served back at the same `uploads/<filename>` URL by
`uploads.mts`.

### Deployment steps

1. **Set environment variables.** In the Netlify UI → **Site configuration
   → Environment variables**, add:
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_SECURITY_ANSWER`,
     `ADMIN_SESSION_SECRET` — required to log into `admin.html` at all
     (see [Admin login](#admin-login) above).
   - `STRIPE_WEBHOOK_SECRET` — leave as a placeholder for now; you'll get
     the real value in step 3.
2. **Deploy.** Push this repo to Netlify (connect the Git repo, or deploy
   the folder directly) — `netlify.toml` already points it at
   `netlify/functions/`, and Netlify installs `package.json`'s
   `@netlify/blobs` dependency itself, so there's nothing else to
   configure. Test it: open `admin.html` on your live site, generate a
   test client, confirm **Save To Live Database** succeeds, then confirm
   `activate.html` finds it.
3. **Connect Stripe.** In the Stripe Dashboard → Developers → Webhooks, add
   an endpoint at `https://your-site.netlify.app/api/webhook.php`,
   subscribed to `checkout.session.completed`. Stripe shows you a signing
   secret (`whsec_...`) — put that in the `STRIPE_WEBHOOK_SECRET`
   environment variable from step 1 and redeploy (or just trigger a
   redeploy from the Netlify UI — no code change needed).
4. **Set up each client's payment link so Stripe knows who paid.** Same as
   the InfinityFree path — use a Stripe **Payment Link** for the service
   (one per service tier is enough), and always use the link `admin.html`
   generates (with `?client_reference_id=...` already appended), not the
   bare one from Stripe.
5. **`REDEEM_URL` in `admin.js`** is already set to
   `https://qp-digital.netlify.app/activate.html` — update it if you move
   to a different domain.

Website clients (a single "coming soon → live" switch via `api/gate.php`)
are the one part of the InfinityFree path that assumes PHP rendering the
client's actual site — that doesn't carry over to a Netlify-hosted client
site as-is. If you need that for a client hosted on Netlify, it needs its
own equivalent (e.g. a small Netlify Function checking the same client's
`status` before serving their site, or an Edge Function). Everything else
in this section — account/code redemption, payment status, previews,
uploads — works exactly as described.

### Local testing

`netlify dev` (from the [Netlify CLI](https://docs.netlify.com/cli/get-started/))
runs the whole site, including `netlify/functions/`, with Blobs emulated
locally — no separate database or PHP server needed. Set `ADMIN_EMAIL`,
`ADMIN_PASSWORD`, `ADMIN_SECURITY_ANSWER`, `ADMIN_SESSION_SECRET` (and, if
testing the webhook, `STRIPE_WEBHOOK_SECRET`) in a local `.env` file or via
`netlify env:set`.

## Going live: automatic activation on payment

This is the alternative backend — same "pay → your website goes live
instantly" mechanism as [Going live on Netlify](#going-live-on-netlify)
above, built instead for **InfinityFree** (or any PHP + MySQL shared host)
for if you ever move off Netlify. No Node.js, no Composer/shell access
needed — plain PHP + PDO, and Stripe's webhook signature is verified by
hand (`api/webhook.php`) rather than via their SDK.

**How it works:** each client's row in a `clients` MySQL table holds their
account number, code, service, price, a text preview, an optional uploaded
preview *image*, an optional preview *link*, payment link, optional live
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

**One honest limit:** the single-switch "hidden → live" mechanism itself
(`api/gate.php`) only fits the **website** service — there's no equivalent
for SEO, CRM setup, branding, etc., since those don't have one file whose
visibility can just be toggled. For anything with an actual file to hand
over (a logo, a design export), attaching it as the **deliverable file**
covers that gap — `status` flipping to `active` is what reveals the
download button, so the client can self-serve it the moment they pay,
without you doing anything. What's still on you either way: the client
finding out — nothing emails or texts them to say it's ready, they have to
go back to `activate.html` themselves. And for a service with no website
and no file (ongoing SEO, a CRM setup call), delivering the actual work is
still manual regardless.

### Deployment steps

1. **Create the MySQL database.** In your InfinityFree control panel →
   MySQL Databases, create one and note the hostname, database name,
   username and password it gives you (the hostname is something like
   `sqlXXX.infinityfree.com`, not `localhost`).
2. **Import the schema.** Open phpMyAdmin (linked from the same control
   panel), select your database, and run `api/schema.sql` (Import tab, or
   paste it into the SQL tab).
3. **Configure the backend.** Copy `api/config.example.php` to
   `api/config.php` and fill in the database credentials from step 1, real
   values for `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_SECURITY_ANSWER`/
   `ADMIN_SESSION_SECRET` (see [Admin login](#admin-login) above), and (for
   now) leave `STRIPE_WEBHOOK_SECRET` as a placeholder — you'll get the real
   value in step 6. `api/config.php` is gitignored — never commit it.
4. **Upload everything.** Upload the whole site (all the `.html`/`.css`/`.js`
   files plus the entire `api/` folder, `config.php` included, and the
   `uploads/` folder) via FTP or InfinityFree's file manager, to your
   domain's `htdocs` folder. `uploads/` is where attached preview images
   land — it just needs to exist and be writable by PHP (InfinityFree's
   default permissions are fine); its `.htaccess` stops anything uploaded
   there from ever being run as a script.
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
9. **Update `REDEEM_URL`** at the top of `admin.js` to your real domain
   (it currently points at `qp-digital.netlify.app`), so the message
   `admin.html` writes for you links to the right place.

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
- **Upload size limits.** `api/upload_preview_image.php` caps attached
  preview images at 5MB and `api/upload_preview_file.php` caps the preview
  file at 15MB, but your host's own `upload_max_filesize`/`post_max_size`
  (set in InfinityFree's control panel, not in this repo) can be lower —
  if an upload fails for no obvious reason, check those.
- **The preview file endpoint accepts almost any file type on purpose** —
  including `.html`, so you can attach a real prototype the client opens
  live. It still blocks anything that could run as *server-side* code
  (`.php` and friends — see `api/upload_preview_file.php`'s comment for the
  full list), and both upload endpoints require a valid admin login (see
  [Admin login](#admin-login) above), the same trust boundary as
  FTP/file-manager access to your host already gives you.

If you outgrow these constraints, the same `api/` design (PHP + MySQL +
manual Stripe signature verification) works unchanged on paid PHP hosting
too — nothing here is InfinityFree-specific except the setup steps.

### Not real access control (the `accounts-data.js` fallback only)

This caveat applies only when neither backend is deployed and
`activate.html` is using `accounts-data.js` instead. That file ships as
plain text to every visitor's browser — anyone who opens devtools or views
page source can read every account number, code, and payment link on the
list. Once either `api/redeem.php` (PHP) or `redeem.mts` (Netlify) is live,
this no longer applies: the account list stays server-side and the browser
only ever learns about the one account/code pair it asked about.

## Running it

No build step. The marketing pages (`index.html` etc.) work as plain static
files — open directly, or:

```bash
python3 -m http.server 8000
```

`admin.html`'s "Save To Live Database" and `activate.html`'s live payment
status need one of the two backends running — either `netlify dev` (see
[Going live on Netlify](#going-live-on-netlify)) or PHP (see
[Local testing](#local-testing) under the InfinityFree section). Without
either one, both pages still work using the `accounts-data.js` fallback
described in [Activating clients](#activating-clients).

## Customizing

- **Business email/phone**: update `BUSINESS_EMAIL` in `script.js` (where
  enquiry form submissions are sent, via a `mailto:` link) and the
  email/phone shown in the footer of every page — currently
  `jonahquartey584@gmail.com` / `07544 856633`.
- **Services**: edit the cards inside the `#services` section of
  `index.html`, and keep the `<select>` options in the enquiry form
  (`#service`) in sync.
- **Colors/branding**: the palette lives at the top of `style.css` under
  `:root` (`--gold`, `--bronze`, `--bg`, etc.) — swap these for your brand
  colors.
- **Account numbers / activation codes / payments**: see
  [Activating clients](#activating-clients),
  [Going live on Netlify](#going-live-on-netlify), and
  [Going live: automatic activation on payment](#going-live-automatic-activation-on-payment)
  above.
- **Admin login / Stripe webhook secret**: on Netlify, these are the
  `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_SECURITY_ANSWER` /
  `ADMIN_SESSION_SECRET` / `STRIPE_WEBHOOK_SECRET` environment variables
  (Site configuration → Environment variables) — see
  [Admin login](#admin-login) above. On PHP/InfinityFree, they (plus DB
  credentials) live in `api/config.php` (copy from
  `api/config.example.php` — gitignored, never commit real values).

## SEO

`index.html` and `activate.html` (the two public pages) carry a canonical
URL, Open Graph/Twitter card tags (so links posted in Slack/iMessage/Twitter
show a proper title, description and image), and `index.html` also has
`ProfessionalService` JSON-LD structured data (name, description, email,
phone). `admin.html` and `pipeline-tester.html` stay `noindex, nofollow` —
they're internal tools, not meant to be found or shared.

- `robots.txt` — allows crawling everything except `admin.html`,
  `pipeline-tester.html`, `api/`, and `uploads/`; points crawlers at
  `sitemap.xml`.
- `sitemap.xml` — lists the two public pages.
- `favicon.svg` — the browser-tab icon (a gold-gradient "Q" monogram,
  matching the site's palette), with `favicon-32.png` and
  `apple-touch-icon.png` as raster fallbacks for browsers/devices that
  don't support SVG favicons.
- `og-image.png` — the 1200×630 image shown when a link to the site is
  shared; referenced by the Open Graph/Twitter tags above.

All of the above hardcode `https://qp-digital.netlify.app` — update every
occurrence (`grep -rn qp-digital.netlify.app`) if you move to a different
domain.

## Files

- `index.html` — homepage markup (all marketing sections)
- `activate.html` — client "enter your account number and code" page
- `admin.html` — internal, unlinked tool to generate a new client's account
  number + activation code
- `admin.js` — the random account/code generator, payment-link builder
  (appends `?client_reference_id=...`), and the save/snippet/message logic
  behind `admin.html`
- `pipeline-tester.html` — internal, unlinked tool: the same setup → redeem
  → payment flow, entirely in your browser (no real backend involved)
- `pipeline-tester.js` — self-contained account/code generation, file
  attachment, and redeem-result rendering behind `pipeline-tester.html`;
  deliberately a separate copy of similar logic in `admin.js`/`activate.js`
  rather than reusing them, so this page can never call the real API
  endpoints
- `accounts-data.js` — offline fallback list `activate.js` uses only when
  `api/redeem.php` can't be reached (see
  [Activating clients](#activating-clients))
- `activate.js` — calls `api/redeem.php` (falling back to
  `accounts-data.js`) and renders the match/no-match/active result
- `api/config.example.php` — template for `api/config.php` (DB
  credentials, admin login, Stripe webhook secret) — copy it, fill it
  in, never commit the copy
- `api/schema.sql` — the `clients` table definition; import this into your
  MySQL database once
- `api/db.php` — shared PDO database connection helper
- `api/redeem.php` — looks up an account+code, called by `activate.js`
- `api/create_client.php` — admin-only endpoint that inserts a new client
  row, called by `admin.js`'s "Save To Live Database"
- `api/list_clients.php` — admin-only endpoint that returns every client
  row, called by `admin.html`'s "Existing Clients" list
- `api/update_client.php` — admin-only endpoint that updates an existing
  client row in place, called by the "Existing Clients" edit panel's "Save
  Changes"
- `api/delete_client.php` — admin-only endpoint that permanently deletes a
  client row, called by "Existing Clients"' "Delete"
- `api/admin_auth.php` — shared session-token logic (create/verify) used by
  `api/admin_login.php` and every admin-only action endpoint
- `api/admin_login.php` — checks email + password + security answer,
  returns a session token; called by admin.html's login form
- `api/upload_helpers.php` — shared upload logic (admin session check,
  size cap, save into `uploads/`) used by both upload endpoints below
- `api/upload_preview_image.php` — admin-only endpoint that saves an
  attached preview image into `uploads/` and returns its URL, called the
  moment you choose a file under "Preview image" in `admin.html`
- `api/upload_preview_file.php` — admin-only endpoint that saves an
  attached preview file (HTML prototype, PDF, etc. — almost any type is
  allowed) into `uploads/` and returns its URL, called the moment you
  choose a file under "Preview file" in `admin.html`
- `api/webhook.php` — Stripe webhook endpoint; verifies the signature by
  hand and flips a client's status to `active` on
  `checkout.session.completed`
- `api/gate.php` — include this at the top of a website client's real
  `index.php` to hide it until their status is `active`
- `api/email.php` — shared transactional-email helper (sends via Resend's
  HTTP API using cURL) used by both endpoints below — see [Email](#email)
- `api/enquiry.php` — public endpoint behind the homepage's enquiry form;
  emails the visitor a confirmation and (best-effort) notifies
  `ADMIN_EMAIL`
- `api/send_client_email.php` — admin-only endpoint that emails a client
  their account number, code and the redeem link, called by admin.html's
  "Email Account & Code to Client"
- `api/.htaccess` — blocks direct web access to `api/config.php`
- `netlify.toml` — points Netlify at `netlify/functions/`; no `[build]`
  step needed since the site itself is plain static files
- `package.json` — the one dependency (`@netlify/blobs`) the Functions
  backend needs; Netlify installs it automatically on deploy
- `netlify/functions/_shared.mts` — helpers shared by every function below
  (constant-time comparison, JSON response helper, the client record type,
  admin session-token create/verify) — not a route itself (leading `_`
  excludes it)
- `netlify/functions/admin-login.mts` — Netlify equivalent of
  `api/admin_login.php`, routed at `/api/admin_login.php`
- `netlify/functions/create-client.mts` — Netlify equivalent of
  `api/create_client.php`, routed at the same `/api/create_client.php`
  path so `admin.js` doesn't need to change
- `netlify/functions/redeem.mts` — Netlify equivalent of `api/redeem.php`,
  routed at `/api/redeem.php`
- `netlify/functions/list-clients.mts` — Netlify equivalent of
  `api/list_clients.php`, routed at `/api/list_clients.php`
- `netlify/functions/update-client.mts` — Netlify equivalent of
  `api/update_client.php`, routed at `/api/update_client.php`
- `netlify/functions/delete-client.mts` — Netlify equivalent of
  `api/delete_client.php`, routed at `/api/delete_client.php`
- `netlify/functions/webhook.mts` — Netlify equivalent of `api/webhook.php`,
  routed at `/api/webhook.php`
- `netlify/functions/enquiry.mts` — Netlify equivalent of `api/enquiry.php`,
  routed at `/api/enquiry.php` (public — no admin session needed)
- `netlify/functions/send-client-email.mts` — Netlify equivalent of
  `api/send_client_email.php`, routed at `/api/send_client_email.php`
- `netlify/functions/upload-preview-image.mts` / `upload-preview-file.mts`
  — Netlify equivalents of the two PHP upload endpoints, saving into a
  Blobs store instead of `uploads/`
- `netlify/functions/uploads.mts` — serves files saved by the two upload
  functions back at `uploads/<filename>`, matching the PHP version's URLs
- `uploads/` — where attached preview images are saved; its `.htaccess`
  stops anything in there from being run as a script. The images
  themselves are gitignored — only the folder and its `.htaccess` are
  tracked
- `style.css` — styling for all three pages
- `script.js` — mobile nav toggle, footer year, hero rotator, scroll-reveal,
  and the enquiry form (posts to `api/enquiry.php`, falling back to a
  `mailto:` link if that can't be reached) — shared by all pages; every
  selector it uses is null-guarded, so it's safe to load on a page missing
  some of those elements
