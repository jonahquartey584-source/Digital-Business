import type { CapacitorConfig } from "@capacitor/cli";

// This wraps the LIVE deployed web app (not a static bundle) so the native
// app always shows the same server-rendered pages, auth, and Stripe billing
// as the website — no separate build/deploy step for app updates.
//
// Before running `npm run cap:add`, set server.url below to your deployed
// site (e.g. https://app.qpdigital.com). See README.md → "Mobile app" for
// the full walkthrough.
const config: CapacitorConfig = {
  appId: "com.qpdigital.app",
  appName: "Qp Digital",
  webDir: "public", // unused when server.url is set, but required by the CLI
  server: {
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://app.qpdigital.com",
    cleartext: false,
  },
  ios: {
    contentInset: "automatic",
  },
};

export default config;
