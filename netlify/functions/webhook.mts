// Stripe webhook endpoint. Configure this URL
// (https://your-site.netlify.app/api/webhook.php) in Stripe Dashboard →
// Developers → Webhooks, subscribed to the "checkout.session.completed"
// event.
//
// Netlify-hosted equivalent of api/webhook.php — verifies Stripe's
// signature by hand the same way (no Stripe SDK dependency), backed by a
// Netlify Blobs store instead of MySQL. See
// https://stripe.com/docs/webhooks/signatures for the algorithm this
// implements.

import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { createHmac } from "node:crypto";
import { safeEqual, type ClientRecord } from "./_shared.mts";

function verifyStripeSignature(payload: string, sigHeader: string, secret: string): boolean {
  if (!sigHeader || !secret) return false;

  const parts: Record<string, string[]> = {};
  for (const pair of sigHeader.split(",")) {
    const eqIndex = pair.indexOf("=");
    if (eqIndex === -1) continue;
    const key = pair.slice(0, eqIndex);
    const value = pair.slice(eqIndex + 1);
    (parts[key] ??= []).push(value);
  }

  const timestamp = parts.t?.[0];
  const signatures = parts.v1 ?? [];

  if (!timestamp || signatures.length === 0) return false;

  // Reject events older than 5 minutes to guard against replay attacks.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");

  return signatures.some((signature) => safeEqual(expected, signature));
}

export default async (req: Request, context: Context) => {
  const payload = await req.text();
  const sigHeader = req.headers.get("stripe-signature") ?? "";
  const secret = Netlify.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

  if (!verifyStripeSignature(payload, sigHeader, secret)) {
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(payload);

  if (event?.type === "checkout.session.completed") {
    // client_reference_id is set automatically by Stripe when the payment
    // link/checkout URL is visited with ?client_reference_id=THEIR_ACCOUNT
    // appended — see admin.js, which builds that URL for you.
    const accountNumber = String(event?.data?.object?.client_reference_id ?? "").trim().toUpperCase();

    if (accountNumber) {
      const store = getStore({ name: "clients", consistency: "strong" });
      const client = await store.get(accountNumber, { type: "json" }) as ClientRecord | null;
      if (client) {
        client.status = "active";
        client.activatedAt = new Date().toISOString();
        await store.setJSON(accountNumber, client);
      }
    }
  }

  return new Response("ok", { status: 200 });
};

export const config: Config = {
  path: "/api/webhook.php",
};
