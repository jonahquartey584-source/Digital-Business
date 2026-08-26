// Shared helpers for the Netlify Functions backend. Not a route itself —
// nothing here has a `config.path`, so Netlify never dispatches requests to
// this file directly.

import { timingSafeEqual } from "node:crypto";

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

export interface ClientRecord {
  account: string;
  code: string;
  title: string | null;
  service: string;
  price: string;
  preview: string;
  previewImageUrl: string | null;
  previewFileUrl: string | null;
  paymentUrl: string;
  liveUrl: string | null;
  status: "pending_payment" | "active";
  createdAt: string;
  activatedAt: string | null;
}
