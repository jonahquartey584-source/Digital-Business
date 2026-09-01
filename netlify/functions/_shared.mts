// Shared helpers for the Netlify Functions backend. Not a route itself —
// nothing here has a `config.path`, so Netlify never dispatches requests to
// this file directly.

import { createHmac, timingSafeEqual } from "node:crypto";
import { getStore } from "@netlify/blobs";

// Constant-time string comparison, mirroring PHP's hash_equals() (used by
// the api/*.php equivalents of these functions). A plain `===` leaks how
// many leading characters matched via response timing.
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// --- Admin session tokens -------------------------------------------------
//
// admin-login.mts exchanges email + password + security-question answer for
// one of these; admin.html holds onto it and sends it back as
// `Authorization: Bearer <token>` on every create-client/upload call, which
// verify it with requireAdminSession() below instead of re-checking a
// password on every action. A token is just
// `<base64url({exp})>.<hmac-sha256 of that, hex>` — no server-side session
// store needed, so it works statelessly across separate function
// invocations. Mirrors api/admin_auth.php on the PHP side.

export const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours — default, no "remember me"
export const REMEMBERED_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days — "remember me" checked

export function createSessionToken(secret: string, ttlSeconds: number = SESSION_TTL_SECONDS): string {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString(
    "base64url"
  );
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string, secret: string): boolean {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  if (!safeEqual(createHmac("sha256", secret).update(payload).digest("hex"), signature)) return false;

  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof exp === "number" && exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

// True if the request carries a valid, unexpired admin session token in its
// Authorization header. Used by every admin-only action endpoint
// (create-client, upload-preview-image, upload-preview-file) in place of a
// per-request password check.
export function requireAdminSession(req: Request): boolean {
  const secret = Netlify.env.get("ADMIN_SESSION_SECRET") ?? "";
  if (!secret) return false;

  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!token) return false;

  return verifySessionToken(token, secret);
}

// --- Transactional email ---------------------------------------------------
//
// Sends via Resend's HTTP API (https://resend.com) — chosen because it
// needs nothing beyond an API key (no SMTP setup, no SDK). Requires the
// RESEND_API_KEY environment variable; without it this is a no-op that
// reports failure so callers can decide how to degrade (enquiry.mts still
// tells the visitor their enquiry was submitted either way — email is a
// nice-to-have on top of that, not the only record of it). Netlify
// Functions read their environment at deploy time, not live — set or
// change this and trigger a redeploy (or just push again) before it takes
// effect.
//
// The sender address is Resend's own shared onboarding domain — it works
// without owning/verifying a domain, which this site doesn't have yet
// (only a netlify.app subdomain, which can't be verified as a sender).
// Swap FROM_EMAIL for an address on your own verified domain once you have
// one — deliverability is meaningfully better than a shared domain.
const FROM_EMAIL = "Qp Digital <onboarding@resend.dev>";

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<boolean> {
  const apiKey = Netlify.env.get("RESEND_API_KEY") ?? "";
  if (!apiKey) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        ...(options.replyTo ? { reply_to: options.replyTo } : {}),
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// --- Real CRM/Booking app provisioning ------------------------------------
//
// Clients here (Netlify Blobs) and the real SaaS platform's CRM/Booking
// (Supabase) are two different systems. When a client on THIS site pays for
// "CRM" or "Booking System", their crm.html/booking-system.html links only
// go somewhere useful once they also have an active account + subscription
// row over on the real app — otherwise clicking through just lands on a
// paywall for something they already paid for here. This closes that gap:
// call it right after a client record flips to 'active' (webhook.mts,
// activate-client.mts) for any service whose name matches CRM or Booking.
//
// Uses plain fetch against Supabase's REST/Admin HTTP API — no supabase-js
// dependency on this project, matching this codebase's existing pattern of
// hand-rolled HTTP calls (see verifyStripeSignature above) rather than
// adding SDKs. Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
// (same project as the real app — see .env.example over there). Best-effort:
// logs and swallows failures rather than throwing, same as sendEmail() above
// — a client's Blobs record staying 'active' matters more than this succeeding
// on the first try, and it's safe to retry (upsert) on the next webhook event.
export type RealAppProduct = "crm" | "booking" | "voice";

export function realAppProductForService(service: string): RealAppProduct | null {
  const s = service.toLowerCase();
  if (s.includes("crm")) return "crm";
  if (s.includes("booking")) return "booking";
  // "voice" is the real app's product key for AI Reception (missed-call AI
  // answering) — matches the same alias vocabulary ai-automation.html
  // already gates on, so a client who buys AI & Automation here gets real
  // access there too, not just a locked/unlocked badge.
  if (["ai", "automation", "assistant", "chatbot", "follow-up", "reception", "call"].some((term) => s.includes(term))) {
    return "voice";
  }
  return null;
}

export async function provisionRealAppAccess(email: string, product: RealAppProduct): Promise<void> {
  const supabaseUrl = Netlify.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    console.error("provisionRealAppAccess: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — skipping.");
    return;
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
  const normalizedEmail = email.trim().toLowerCase();

  try {
    // 1. Find an existing account for this email, or invite a new one —
    //    same resolve-or-create shape as lib/auth-provisioning.ts on the
    //    real app, reimplemented here over plain REST since this is a
    //    separate codebase/runtime.
    let userId: string | null = null;

    const lookup = await fetch(
      `${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(normalizedEmail)}&select=id`,
      { headers }
    );
    if (lookup.ok) {
      const rows = (await lookup.json()) as Array<{ id: string }>;
      if (rows[0]) userId = rows[0].id;
    }

    if (!userId) {
      const invite = await fetch(`${supabaseUrl}/auth/v1/invite`, {
        method: "POST",
        headers,
        body: JSON.stringify({ email: normalizedEmail }),
      });
      if (invite.ok) {
        const created = (await invite.json()) as { id?: string };
        userId = created.id ?? null;
      } else {
        // Race: created between the lookup above and this call. Look up
        // again rather than fail the whole provisioning step.
        const retry = await fetch(
          `${supabaseUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(normalizedEmail)}&select=id`,
          { headers }
        );
        if (retry.ok) {
          const rows = (await retry.json()) as Array<{ id: string }>;
          if (rows[0]) userId = rows[0].id;
        }
      }
    }

    if (!userId) {
      console.error(`provisionRealAppAccess: could not resolve or create an account for ${normalizedEmail}`);
      return;
    }

    // 2. Mark that account as having an active subscription to this
    //    product — hasActiveSubscription() on the real app reads exactly
    //    this table, no stripe_subscription_id required.
    await fetch(`${supabaseUrl}/rest/v1/subscriptions?on_conflict=user_id,product`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        user_id: userId,
        product,
        status: "active",
        updated_at: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error("provisionRealAppAccess failed:", error);
  }
}

export interface ClientRecord {
  account: string;
  code: string;
  title: string | null;
  service: string;
  price: string;
  preview: string;
  previewImageUrl: string | null;
  previewFileUrl: string | null;
  // The actual final deliverable (e.g. a finished logo) — only ever sent
  // to the client by redeem.mts once status is "active", never before,
  // even though it's stored from the moment the client is created.
  deliverableFileUrl: string | null;
  paymentUrl: string;
  // Set by you when you already know the domain, OR left null and filled
  // in automatically by deployClientWebsite() below once websiteZipUrl is
  // set and the client pays — either way, this is what "Open Website" on
  // web-development.html actually links to.
  liveUrl: string | null;
  // A .zip of the actual site (index.html + assets) uploaded in New Client
  // Setup — same "uploads" Blobs store/upload endpoint as previewFileUrl,
  // just a different field so the mockup shown pre-payment and the real
  // deployable site aren't the same upload. Deployed for real the moment
  // payment confirms (see deployClientWebsite below) — not before.
  websiteZipUrl?: string | null;
  // Set once deployClientWebsite() has created/deployed a Netlify site for
  // this account, so a retry after that doesn't spin up a second one.
  netlifySiteId?: string | null;
  // Not required, not shown to the client anywhere — only used as the
  // destination for send-client-email.mts's "email them their account +
  // code" button in admin.html.
  clientEmail: string | null;
  status: "pending_payment" | "active";
  createdAt: string;
  activatedAt: string | null;
  portalCodeHash?: string | null;
  portalCodeIssuedAt?: string | null;
}

// --- Auto-deploy a client's own website to Netlify -------------------------
//
// New Client Setup lets you attach a .zip of the client's actual website
// (websiteZipUrl, stored in the "uploads" Blobs store — see
// upload-preview-file.mts). Once their payment is confirmed (webhook.mts /
// activate-client.mts), this creates a brand new site under your own
// Netlify account and deploys that zip to it — no manual "build it, host it
// somewhere, paste the URL in" step. The resulting URL is saved onto
// client.liveUrl, which is what "Open Website →" on web-development.html
// (in the client's Members Portal) actually opens.
//
// Requires NETLIFY_API_TOKEN — a Personal Access Token from
// https://app.netlify.com/user/applications#personal-access-tokens (NOT the
// same as any of this site's own Stripe/Resend/Twilio keys). Best-effort,
// same as provisionRealAppAccess above: logs and returns null on any
// failure rather than throwing, so a deploy hiccup never blocks the
// client's payment/activation itself — it's safe to retry (this function is
// only ever called when client.netlifySiteId isn't already set).
export async function deployClientWebsite(client: ClientRecord): Promise<{ siteId: string; url: string } | null> {
  if (!client.websiteZipUrl) return null;

  const token = Netlify.env.get("NETLIFY_API_TOKEN") ?? "";
  if (!token) {
    console.error("deployClientWebsite: NETLIFY_API_TOKEN not set — skipping.");
    return null;
  }

  try {
    const filename = client.websiteZipUrl.replace(/^uploads\//, "");
    const store = getStore({ name: "uploads", consistency: "strong" });
    const zipBytes = await store.get(filename, { type: "arrayBuffer" });
    if (!zipBytes) {
      console.error(`deployClientWebsite: uploaded zip not found for ${client.account} (${filename})`);
      return null;
    }

    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const baseName = `qp-client-${client.account.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`.replace(/-+$/, "");

    // Netlify site names are a shared global namespace — the first attempt
    // usually wins, but retry once with a random suffix on a collision
    // (422) rather than failing the whole deploy over a taken name.
    let siteResponse = await fetch("https://api.netlify.com/api/v1/sites", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: baseName }),
    });
    if (siteResponse.status === 422) {
      siteResponse = await fetch("https://api.netlify.com/api/v1/sites", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: `${baseName}-${Math.random().toString(36).slice(2, 6)}` }),
      });
    }
    const site = (await siteResponse.json().catch(() => ({}))) as { id?: string; error?: string };
    if (!siteResponse.ok || !site.id) {
      console.error(`deployClientWebsite: site creation failed for ${client.account}`, site);
      return null;
    }

    const deployResponse = await fetch(`https://api.netlify.com/api/v1/sites/${site.id}/deploys`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/zip" },
      body: zipBytes,
    });
    const deploy = (await deployResponse.json().catch(() => ({}))) as { ssl_url?: string; url?: string };
    if (!deployResponse.ok) {
      console.error(`deployClientWebsite: deploy failed for ${client.account}`, deploy);
      return null;
    }

    const liveUrl = deploy.ssl_url || deploy.url || `https://${baseName}.netlify.app`;
    return { siteId: site.id, url: liveUrl };
  } catch (error) {
    console.error("deployClientWebsite failed:", error);
    return null;
  }
}
