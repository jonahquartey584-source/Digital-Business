# Qp Digital

A static website for Qp Digital, a digital services business — websites,
CRM, SEO, booking systems, branding, reporting dashboards and automation.
It's two pages: a one-page marketing site (`index.html`) and a client
"activate your service" page (`activate.html`).

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
- **Enquire** — a form visitors fill in to request a service; submitting it
  opens a pre-filled email to the business
- **Footer / Contact** — contact details and quick links
- **Activate a Service** (`activate.html`) — a client enters the account
  number and activation code you gave them; if it matches an entry in
  `accounts-data.js`, they see an order summary (the service, a short
  preview of what's included, and the price you quoted them) and a
  "Pay & Activate" button linking straight to the payment link you set up
  for them (see [Activating clients](#activating-clients) below)

## Design

Black-and-gold "tech" look: **Sora** for headings, **IBM Plex Sans** for body
copy, and **IBM Plex Mono** for labels/eyebrows/numerals/terminal chrome (all
via Google Fonts). Custom inline SVG line icons per service (no emoji, no
icon-font dependency). Terminal/code-block styling (window chrome, JSON-style
key/value lines, a blinking cursor, `$`/`>` prompt marks) reinforces the
"tech" identity and doubles as the real UI for the account/code lookup.
Sections reveal on scroll via a small `IntersectionObserver` enhancement in
`script.js` — this degrades gracefully (a `<noscript>` rule in `index.html`
and `activate.html` forces everything visible if JavaScript is off).

## Activating clients

`activate.html` is where a client redeems their account number + activation
code:

1. A client enquires (via the homepage form) and you agree a price.
2. You set up their paid service — e.g. a Stripe Payment Link, or any
   private checkout URL that only they should use.
3. Open `accounts-data.js` and add an entry:
   ```js
   {
     account: "QP-2026-0159",
     code: "A1B2-C3D4",
     service: "SEO — Monthly Package",
     price: "£150/month",
     preview: "Ongoing keyword tracking, on-page fixes, and a monthly report.",
     paymentUrl: "https://buy.stripe.com/...",
   }
   ```
4. Send the client their account number and code (email/text).
5. They go to `activate.html`, enter both, and — if it matches — see an
   order summary built from `service`, `preview` and `price` (exactly what
   they agreed to and what it costs), and a "Pay & Activate" button linking
   to `paymentUrl`. A non-matching account/code shows a "no match" message
   instead.
6. Payment itself happens on `paymentUrl` (e.g. Stripe), outside this site.
   "Activate" here means handing them the payment link for the exact thing
   you quoted — actually switching the service on (publishing their site,
   turning on the subscription, etc.) once payment lands is still on you to
   do and confirm, unless/until `paymentUrl` points at something that
   activates itself (e.g. a Stripe Payment Link tied to automatic
   provisioning).

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
  [Activating clients](#activating-clients) above — adding/removing client
  entries is done in `accounts-data.js`.

## Files

- `index.html` — homepage markup (all marketing sections)
- `activate.html` — client "enter your account number and code" page
- `accounts-data.js` — the editable list of client accounts/codes/payment
  links `activate.html` checks against (see
  [Activating clients](#activating-clients))
- `activate.js` — looks up what a client enters against `accounts-data.js`
  and renders the match/no-match result
- `style.css` — styling for both pages
- `script.js` — mobile nav toggle, footer year, enquiry form → email,
  scroll-reveal (shared by both pages; every selector it uses is
  null-guarded, so it's safe to load on a page missing some of those
  elements)
