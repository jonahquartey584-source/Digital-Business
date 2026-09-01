// Powers the in-page Stripe payment on activate.html — Stripe's Embedded
// Checkout, mounted directly into the redeem page instead of navigating
// away to a Stripe-hosted page (checkout.stripe.com) or a manually-created
// Payment Link (buy.stripe.com). The price comes straight from the
// client's own record, so there's no separate Payment Link to create (or
// get wrong) per client any more.
//
// Same Checkout Session mechanics as start-checkout.mts (metadata.account /
// metadata.portal_code, webhook.mts reads both on checkout.session.completed)
// — the only difference is ui_mode: "embedded" + a single return_url instead
// of separate success_url/cancel_url, and this returns the resulting
// client_secret as JSON instead of redirecting, since the frontend needs it
// to mount the embedded form.

import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { randomInt } from "node:crypto";
import { json, type ClientRecord } from "./_shared.mts";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return json(405, { status: "error", message: "Method not allowed" });

  const input = await req.json().catch(() => ({}) as Record<string, unknown>);
  const account = String(input.account ?? "").trim().toUpperCase();
  if (!account) return json(400, { status: "error", message: "Missing account." });

  const store = getStore({ name: "clients", consistency: "strong" });
  const client = (await store.get(account, { type: "json" })) as ClientRecord | null;
  if (!client) return json(404, { status: "error", message: "No account found with that account number." });
  if (client.status === "active") return json(409, { status: "already_active", message: "This account is already active — sign in at the Members Portal." });

  const stripeKey = Netlify.env.get("STRIPE_SECRET_KEY") || "";
  const publishableKey = Netlify.env.get("STRIPE_PUBLISHABLE_KEY") || "";
  if (!stripeKey || !publishableKey) {
    return json(500, { status: "error", message: "Payments aren't configured yet — contact Qp Digital to complete this manually." });
  }

  const amount = Math.round(Number(String(client.price).replace(/[^0-9.]/g, "")) * 100);
  if (!Number.isFinite(amount) || amount < 30) {
    return json(400, { status: "error", message: "This account doesn't have a valid price set — contact Qp Digital." });
  }

  const recurring = /month|monthly|membership|subscription/i.test(`${client.price} ${client.service}`);
  const portalCode = Array.from({ length: 12 }, () => randomInt(0, 10)).join("");
  const origin = "https://qp-digital.co.uk";

  const form = new URLSearchParams({
    ui_mode: "embedded",
    mode: recurring ? "subscription" : "payment",
    client_reference_id: account,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "gbp",
    "line_items[0][price_data][unit_amount]": String(amount),
    "line_items[0][price_data][product_data][name]": client.title || client.service,
    return_url: `${origin}/payment-success.html?session_id={CHECKOUT_SESSION_ID}`,
    "metadata[portal_code]": portalCode,
    "metadata[account]": account,
  });
  if (recurring) form.set("line_items[0][price_data][recurring][interval]", "month");
  if (client.clientEmail) form.set("customer_email", client.clientEmail);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const session = (await response.json().catch(() => ({}))) as { client_secret?: string; error?: { message?: string } };

  if (!session.client_secret) {
    console.error("embedded-checkout: Stripe session create failed", session.error);
    return json(502, { status: "error", message: session.error?.message || "Stripe couldn't start this payment — try again shortly." });
  }

  return json(200, { status: "ok", clientSecret: session.client_secret, publishableKey });
};

export const config: Config = { path: "/api/embedded-checkout" };
