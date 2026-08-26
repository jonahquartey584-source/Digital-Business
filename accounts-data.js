// ---------------------------------------------------------------------
// Client accounts — OFFLINE FALLBACK ONLY
// ---------------------------------------------------------------------
// activate.js checks api/redeem.php first (a real PHP/MySQL backend —
// see the api/ folder and the README's deployment section). This file
// is only used as a fallback if that backend can't be reached, e.g.
// while previewing the site on plain static hosting with no PHP.
//
// Because of that, entries here can never reflect real payment status —
// activate.js always treats a match here as "pending_payment". Use
// admin.html's "Save to Database" button to create real, live client
// accounts instead of adding them here by hand.
//
// IMPORTANT — this is NOT real access control.
// This file ships as plain text to every visitor's browser. Anyone who
// opens devtools or views page source can read every account number,
// code, and payment link listed here.
// ---------------------------------------------------------------------

const CLIENT_ACCOUNTS = [
  // Example entry — matches the sample "account record" shown on the
  // homepage's "How It Works" section. Replace or remove it once you're
  // running on the real backend.
  {
    account: "QP-2026-0158",
    code: "7F3K-9QXR",
    service: "Website — Standard Plan",
    price: "£450",
    preview:
      "A 5-page mobile-friendly business website with an enquiry form, hosted and ready to customize once payment is confirmed.",
    previewImageUrl: null,
    paymentUrl: "https://buy.stripe.com/replace-with-real-payment-link",
    liveUrl: null,
  },

  // Add more here, e.g.:
  // {
  //   account: "QP-2026-0159",
  //   code: "A1B2-C3D4",
  //   service: "SEO — Monthly Package",
  //   price: "£150/month",
  //   preview: "Ongoing keyword tracking, on-page fixes, and a monthly report.",
  //   previewImageUrl: null, // e.g. a screenshot/mockup URL — shown instead of the JSON block
  //   paymentUrl: "https://buy.stripe.com/...",
  //   liveUrl: null,
  // },
];
