# Qp Digital

A static, one-page website for Qp Digital, a digital services business —
websites, CRM, SEO, booking systems, branding, reporting dashboards and
automation.

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
  "account card" that shows what a client's account number/code look like
- **Enquire** — a form visitors fill in to request a service; submitting it
  opens a pre-filled email to the business
- **Footer / Contact** — contact details and quick links

## Design

Black-and-gold "tech" look: **Sora** for headings, **IBM Plex Sans** for body
copy, and **IBM Plex Mono** for labels/eyebrows/numerals (all via Google
Fonts). Custom inline SVG line icons per service (no emoji, no icon-font
dependency). Sections reveal on scroll via a small `IntersectionObserver`
enhancement in `script.js` — this degrades gracefully (a `<noscript>` rule
in `index.html` forces everything visible if JavaScript is off).

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
- **Account numbers / activation codes / payments**: the "How It Works"
  section (and its example account card) describes the intended flow
  (enquire → quote → account number &amp; activation code → pay → live),
  but the account/code/payment backend itself isn't built yet — the form
  currently just emails you the enquiry, and the account card on the page
  shows fixed example data. Wiring up real accounts, codes and payments
  needs a backend (e.g. Stripe for payment + an API or serverless function
  to generate/store/redeem codes).

## Files

- `index.html` — page markup (all sections)
- `style.css` — styling
- `script.js` — mobile nav toggle, footer year, enquiry form → email
