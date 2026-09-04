// Admin-only: refunds a client's payment through Stripe and revokes their
// access. Matches terms.html §9 (refunds and cancellations) — this is a
// manual, admin-discretion action, not a customer self-service flow;
// there's no client-facing "request a refund" button, they email/call and
// an admin decides, same as the terms say.
//
// Calls Stripe's Refunds API directly (same hand-rolled fetch pattern as
// embedded-checkout.mts — no Stripe SDK dependency anywhere in this
// codebase) against the payment_intent webhook.mts captured when the
// client paid. A client who paid before that was tracked, or who was
// activated by hand rather than through Stripe, has nothing to refund
// against here — this refuses rather than guessing, and says so.

import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { json, requireAdminSession, sendEmail, type ClientRecord } from "./_shared.mts";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return json(405, { status: "error", message: "Method not allowed" });
  if (!requireAdminSession(req)) return json(401, { status: "error", message: "Not logged in — log into admin.html again" });

  const input = await req.json().catch(() => ({}) as Record<string, unknown>);
  const account = String(input.account ?? "").trim().toUpperCase();
  const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 500) : "";
  // Optional partial refund, in pounds (e.g. 25.50). Omit/blank for a full refund.
  const partialAmount = input.amount !== undefined && input.amount !== null && String(input.amount).trim() !== ""
    ? Number(String(input.amount).replace(/[^0-9.]/g, ""))
    : null;

  if (!account) return json(400, { status: "error", message: "Missing account." });
  if (partialAmount !== null && (!Number.isFinite(partialAmount) || partialAmount <= 0)) {
    return json(400, { status: "error", message: "Refund amount must be a positive number, or left blank for a full refund." });
  }

  const store = getStore({ name: "clients", consistency: "strong" });
  const client = (await store.get(account, { type: "json" })) as ClientRecord | null;
  if (!client) return json(404, { status: "error", message: "No client found with that account number." });
  if (client.status === "refunded") return json(409, { status: "error", message: "This client has already been refunded." });
  if (!client.stripePaymentIntentId) {
    return json(400, {
      status: "error",
      message: "No Stripe payment is on record for this account (it was likely activated by hand, or paid before payment tracking was added) — refund them directly in the Stripe dashboard, then set their status to Refunded here.",
    });
  }

  const stripeKey = Netlify.env.get("STRIPE_SECRET_KEY") || "";
  if (!stripeKey) return json(500, { status: "error", message: "STRIPE_SECRET_KEY is not set — can't process refunds." });

  const form = new URLSearchParams({
    payment_intent: client.stripePaymentIntentId,
    reason: "requested_by_customer",
  });
  if (partialAmount !== null) form.set("amount", String(Math.round(partialAmount * 100)));

  const response = await fetch("https://api.stripe.com/v1/refunds", {
    method: "POST",
    headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const refund = (await response.json().catch(() => ({}))) as { id?: string; amount?: number; error?: { message?: string } };

  if (!refund.id) {
    console.error("refund-client: Stripe refund failed", refund.error);
    return json(502, { status: "error", message: refund.error?.message || "Stripe couldn't process this refund — try again shortly, or process it directly in the Stripe dashboard." });
  }

  const refundedPounds = typeof refund.amount === "number" ? (refund.amount / 100).toFixed(2) : (partialAmount?.toFixed(2) ?? null);

  client.status = "refunded";
  client.refundedAt = new Date().toISOString();
  client.refundAmount = refundedPounds ? `£${refundedPounds}` : null;
  client.refundReason = reason || null;
  await store.setJSON(account, client);

  if (client.clientEmail) {
    await sendEmail({
      to: client.clientEmail,
      subject: `Your refund for ${client.title || client.service} — Qp Digital`,
      text: `Hi,\n\nWe've refunded ${client.refundAmount || "your payment"} for ${client.title || client.service} (account ${account}). It should appear back on your original payment method within 5–10 business days, depending on your bank.\n\nYour Qp Digital account access for this service has now been switched off.\n\nIf you have any questions, just reply to this email or call 020 3750 8659.\n\n— Qp Digital`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><p>Hi,</p><p>We've refunded <strong>${client.refundAmount || "your payment"}</strong> for <strong>${client.title || client.service}</strong> (account ${account}). It should appear back on your original payment method within 5–10 business days, depending on your bank.</p><p>Your Qp Digital account access for this service has now been switched off.</p><p>If you have any questions, just reply to this email or call 020 3750 8659.</p><p>— Qp Digital</p></div>`,
    });
  }

  return json(200, { status: "ok", account, refundAmount: client.refundAmount, refundedAt: client.refundedAt });
};

export const config: Config = {
  path: "/api/refund-client",
};
