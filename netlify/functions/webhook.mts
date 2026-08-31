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
import { createHash, createHmac, randomInt } from "node:crypto";
import { safeEqual, sendEmail, type ClientRecord } from "./_shared.mts";

function createPortalCode(): string {
  return Array.from({ length: 12 }, () => randomInt(0, 10)).join("");
}

function hashPortalCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

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
        const customerEmail = String(event?.data?.object?.customer_details?.email ?? "").trim().toLowerCase();
        const recipient = (client.clientEmail || customerEmail).trim().toLowerCase();
        const checkoutPortalCode = String(event?.data?.object?.metadata?.portal_code ?? "").replace(/\D/g, "").slice(0, 12);
        const portalCode = client.portalCodeHash ? null : (checkoutPortalCode.length === 12 ? checkoutPortalCode : createPortalCode());

        client.status = "active";
        client.activatedAt = new Date().toISOString();
        if (!client.clientEmail && customerEmail) client.clientEmail = customerEmail;
        if (portalCode) {
          client.portalCodeHash = hashPortalCode(portalCode);
          client.portalCodeIssuedAt = new Date().toISOString();
        }
        await store.setJSON(accountNumber, client);

        if (portalCode && recipient) {
          const formattedCode = portalCode.replace(/(\d{4})(?=\d)/g, "$1 ");
          await sendEmail({
            to: recipient,
            subject: "Your Qp Digital members portal access code",
            text: `Payment received. Your 12-digit Qp Digital members portal code is ${formattedCode}. Sign in at https://qp-digital.co.uk/members.html using this email address.`,
            html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:32px;background:#0c0b09;color:#f7f0df;border:1px solid #9b6a23"><p style="color:#d3a34f;letter-spacing:.12em;text-transform:uppercase">Qp Digital Members Portal</p><h1 style="font-size:28px">Payment received.</h1><p>Your service is now available in your members portal.</p><p style="font-size:30px;font-weight:700;letter-spacing:.16em;color:#e0b35b">${formattedCode}</p><p>Use this email address and the 12-digit code to sign in.</p><p><a href="https://qp-digital.co.uk/members.html" style="display:inline-block;padding:14px 20px;background:#c7923c;color:#0c0b09;text-decoration:none;font-weight:700">Open Members Portal</a></p></div>`,
          });
        }

        const ownerEmail = Netlify.env.get("PAYMENT_NOTIFICATION_EMAIL") ?? "jonahquartey584@gmail.com";
        await sendEmail({
          to: ownerEmail,
          subject: `Payment received: ${client.service} — ${accountNumber}`,
          text: `A Qp Digital client payment has been completed.\n\nAccount: ${accountNumber}\nService: ${client.service}\nPrice: ${client.price}\nClient email: ${recipient || "Not supplied"}\nActivated: ${client.activatedAt}`,
          html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h1>Client payment received</h1><p><strong>Account:</strong> ${accountNumber}</p><p><strong>Service:</strong> ${client.service}</p><p><strong>Price:</strong> ${client.price}</p><p><strong>Client email:</strong> ${recipient || "Not supplied"}</p><p><strong>Activated:</strong> ${client.activatedAt}</p></div>`,
          ...(recipient ? { replyTo: recipient } : {}),
        });
      }
    }
  }

  return new Response("ok", { status: 200 });
};

export const config: Config = {
  path: "/api/webhook.php",
};
