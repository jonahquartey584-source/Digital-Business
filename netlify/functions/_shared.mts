// Shared helpers for the Netlify Functions backend. Not a route itself —
// nothing here has a `config.path`, so Netlify never dispatches requests to
// this file directly.

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

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

function portalCodeKey(): Buffer {
  const secret = Netlify.env.get("ADMIN_SESSION_SECRET") ?? "";
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is required to protect portal codes");
  return createHash("sha256").update(`qp-portal-code:${secret}`).digest();
}

export function encryptPortalCode(code: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", portalCodeKey(), iv);
  const encrypted = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptPortalCode(value?: string | null): string | null {
  if (!value) return null;
  try {
    const [ivValue, tagValue, encryptedValue] = value.split(".");
    if (!ivValue || !tagValue || !encryptedValue) return null;
    const decipher = createDecipheriv("aes-256-gcm", portalCodeKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
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
  liveUrl: string | null;
  // Not required, not shown to the client anywhere — only used as the
  // destination for send-client-email.mts's "email them their account +
  // code" button in admin.html.
  clientEmail: string | null;
  status: "pending_payment" | "active";
  createdAt: string;
  activatedAt: string | null;
  portalCodeHash?: string | null;
  portalCodeEncrypted?: string | null;
  portalCodeIssuedAt?: string | null;
}
