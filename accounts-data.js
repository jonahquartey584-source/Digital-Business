// ---------------------------------------------------------------------
// Client accounts
// ---------------------------------------------------------------------
// One entry per client. Workflow:
//   1. Client enquires and you agree a price.
//   2. You set up their paid service (e.g. a Stripe Payment Link, or a
//      private checkout page) that only they should use.
//   3. Add an entry below linking an account number + activation code
//      to that payment link.
//   4. Send the client their account number and code (email/text).
//   5. They go to activate.html, enter both, and land on their payment
//      link to pay and go live.
//
// IMPORTANT — this is NOT real access control.
// This file ships as plain text to every visitor's browser. Anyone who
// opens devtools or views page source can read every account number,
// code, and payment link listed here — the "only they can access" part
// only holds up because the codes aren't shared publicly, not because
// they're actually protected. That's an acceptable trade-off for a
// small number of short-lived, low-stakes codes, but don't rely on it
// once you're issuing many at once, reusing codes, or handling
// higher-value payments. For real per-client access control, this
// lookup needs to move server-side — a small database plus a
// serverless function (e.g. a Netlify/Vercel function or similar) that
// checks the code and returns the payment link, so the full list is
// never sent to the browser. See the README for more.
// ---------------------------------------------------------------------

const CLIENT_ACCOUNTS = [
  // Example entry — matches the sample "account card" shown on the
  // homepage's "How It Works" section. Replace or remove it once you
  // add real clients.
  {
    account: "QP-2026-0158",
    code: "7F3K-9QXR",
    service: "Website — Standard Plan",
    paymentUrl: "https://buy.stripe.com/replace-with-real-payment-link",
  },

  // Add more clients here, e.g.:
  // {
  //   account: "QP-2026-0159",
  //   code: "A1B2-C3D4",
  //   service: "SEO — Monthly Package",
  //   paymentUrl: "https://buy.stripe.com/...",
  // },
];
