# Digital Specialist

A static, one-page website for a digital services business — websites, CRM,
SEO, booking systems, branding, reporting dashboards and automation, all
offered by a single specialist/agency.

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
- **How It Works** — the enquiry → quote (negotiable) → activation code →
  pay → service goes live flow
- **Enquire** — a form visitors fill in to request a service; submitting it
  opens a pre-filled email to the business
- **Footer / Contact** — contact details and quick links

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
  `:root` (`--accent`, `--accent-2`, etc.) — swap these for your brand
  colors.
- **Activation codes / payments**: the "How It Works" section describes the
  intended flow (enquire → quote → activation code → pay → live), but the
  code/payment/activation backend itself isn't built yet — the form
  currently just emails you the enquiry. Wiring up real payments and
  automatic activation needs a backend (e.g. Stripe for payment + an API
  or serverless function to generate/redeem codes).

## Files

- `index.html` — page markup (all sections)
- `style.css` — styling
- `script.js` — mobile nav toggle, footer year, enquiry form → email
