# Qp Digital

A static website for Qp Digital, a digital services business — websites,
CRM, SEO, booking systems, branding, reporting dashboards and automation.
It's three pages: a one-page marketing site (`index.html`), a client
"redeem your service" page (`activate.html`), and an internal, unlinked
"generate a new client's account + code" tool (`admin.html`).

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
  business name, business location, email, phone, service, details);
  submitting it opens a pre-filled email to the business
- **Footer / Contact** — contact details and quick links
- **"Already a client?" banner** — a bar right below the header, above the
  hero, plus a pill link in the nav, both pointing at `activate.html` so
  returning clients don't have to hunt for it
- **Redeem a Service** (`activate.html`) — a client enters the account
  number and activation code you gave them; if it matches an entry in
  `accounts-data.js`, they see an order summary (the service, a short
  preview of what's included, and the price you quoted them) and a
  "Pay & Activate" button linking straight to the payment link you set up
  for them (see [Activating clients](#activating-clients) below)
- **New Client Setup** (`admin.html`) — an internal tool, not linked from
  anywhere on the public site, where you generate a random account number
  + activation code for a client and get a ready-to-paste
  `accounts-data.js` snippet plus a message to send them (see
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
2. You set up their paid service — e.g. a Stripe Payment Link, or any
   private checkout URL that only they should use.
3. Generate their account number + code (see next section) and add the
   resulting entry to `accounts-data.js`.
4. Send the client their account number and code — `admin.html` writes you
   a ready-to-send message for this.
5. They go to `activate.html`, enter both, and — if it matches — see an
   order summary built from `service`, `preview` and `price` (exactly what
   they agreed to and what it costs), and a "Pay & Activate" button linking
   to `paymentUrl`. A non-matching account/code shows a "no match" message
   instead.
6. Payment itself happens on `paymentUrl` (e.g. Stripe), outside this site.

### Generating a client's account + code

Open `admin.html` in a browser (it isn't linked from anywhere on the public
site — bookmark it, or just remember the URL). Fill in the service, price,
preview text and payment link, then click **Generate Account & Code**:

- The account number and code are generated in your browser with
  `crypto.getRandomValues` (real randomness, not `Math.random()`), using a
  character set that skips easily-confused characters (`0`/`O`, `1`/`I`/`L`)
  so they're easy to read back over phone or text.
- You get a ready-to-paste `accounts-data.js` snippet (with a **Copy**
  button) — paste it into the `CLIENT_ACCOUNTS` array in `accounts-data.js`.
- You get a ready-to-send message (with its own **Copy** button) containing
  the account number, code, and price, worded for you to send straight to
  the client.
- Nothing is saved or sent anywhere by this tool — it only runs in your
  browser. Once you've pasted the snippet into `accounts-data.js`, commit
  and push (or redeploy) for it to actually go live on `activate.html`.
- Update `REDEEM_URL` at the top of `admin.js` to your real domain once
  you've deployed somewhere, so the generated client message links to the
  right place.

### Does paying automatically activate the code?

**Not with the current setup — and it's worth understanding why.** This is
a static site: no server code runs when someone visits it, so nothing on
`activate.html` can find out that a Stripe payment happened elsewhere. Right
now, "Pay & Activate" means: show the client exactly what they agreed to and
send them to pay — what happens after they pay is still on you to notice
(check Stripe/your inbox) and act on (actually publish their site, turn on
their subscription, etc.). There are two ways to make it more automatic:

- **Stay static, semi-automatic:** once you see a payment land, update that
  client's entry in `accounts-data.js` (e.g. add a `status: "active"` field)
  and have `activate.js` show that instead of the payment button. Still a
  manual step on your end, but the client sees a clear "you're live" state
  instead of just a payment link with no confirmation.
- **Real automation:** deploy the site somewhere that runs server code (e.g.
  Netlify) and add a small serverless function that listens for Stripe's
  webhook (`checkout.session.completed`). The moment Stripe confirms
  payment, that function flips the client's status in a real data store
  (not `accounts-data.js`, which the browser can read) — no manual checking
  needed. This is a real build (Stripe account + webhook + hosting + a
  small database/KV store), not a config change, and it's also the fix for
  the "not real access control" issue below, since the account list would
  no longer ship to every visitor's browser. Worth doing once you're past
  handling a handful of clients by hand.

**This is not real access control.** `accounts-data.js` ships as plain text
to every visitor's browser — anyone who opens devtools or views page source
can read every account number, code, and payment link on the list. That's a
reasonable trade-off while you're issuing a small number of short-lived,
low-stakes codes by hand, but it does *not* stop one client from finding
another client's payment link if they go looking, and codes aren't rate- or
attempt-limited. Don't rely on it once you're issuing many codes at once,
reusing codes, or handling higher-value payments. Real per-client access
control needs the lookup to happen server-side — a small database plus a
serverless function (Netlify/Vercel function or similar) that checks the
code and returns the payment link, so the full list is never sent to the
browser.

## Running it

Static site, no build step or dependencies. Open `index.html` directly, or
serve the folder locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

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
  [Activating clients](#activating-clients) above — generate entries with
  `admin.html`, adding/removing them is done in `accounts-data.js`.

## Files

- `index.html` — homepage markup (all marketing sections)
- `activate.html` — client "enter your account number and code" page
- `admin.html` — internal, unlinked tool to generate a new client's account
  number + activation code
- `admin.js` — the random account/code generator and snippet/message
  builder behind `admin.html`
- `accounts-data.js` — the editable list of client accounts/codes/payment
  links `activate.html` checks against (see
  [Activating clients](#activating-clients))
- `activate.js` — looks up what a client enters against `accounts-data.js`
  and renders the match/no-match result
- `style.css` — styling for all three pages
- `script.js` — mobile nav toggle, footer year, enquiry form → email,
  scroll-reveal (shared by all pages; every selector it uses is
  null-guarded, so it's safe to load on a page missing some of those
  elements)
