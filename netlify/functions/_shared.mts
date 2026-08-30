// Shared helpers for the Netlify Functions backend. Not a route itself —
// nothing here has a `config.path`, so Netlify never dispatches requests to
// this file directly.

import { createHmac, timingSafeEqual } from "node:crypto";

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
  portalCodeIssuedAt?: string | null;
}
