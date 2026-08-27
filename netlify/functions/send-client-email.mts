// Admin-only endpoint: emails a client their account number, activation
// code, and the redeem link — the same content admin.html's "Message To
// Send The Client" box already generates for copy-pasting, just sent
// automatically instead. Called by the "Email Account & Code to Client"
// button that appears once a client has a clientEmail set (right after
// saving, or later from the Existing Clients edit panel).
//
// Netlify-hosted equivalent of api/send_client_email.php.

import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { json, requireAdminSession, sendEmail, type ClientRecord } from "./_shared.mts";

const BUSINESS_NAME = "Qp Digital";
// Keep in sync with REDEEM_URL at the top of admin.js.
const REDEEM_URL = "https://qp-digital.netlify.app/activate.html";

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return json(405, { status: "error", message: "Method not allowed" });
  }

  if (!requireAdminSession(req)) {
    return json(401, { status: "error", message: "Not logged in — log into admin.html again" });
  }

  const input = await req.json().catch(() => ({}) as Record<string, unknown>);
  const account = String(input.account ?? "").trim().toUpperCase();

  if (!account) {
    return json(400, { status: "error", message: "Account is required" });
  }

  const store = getStore({ name: "clients", consistency: "strong" });
  const client = (await store.get(account, { type: "json" })) as ClientRecord | null;

  if (!client) {
    return json(404, { status: "error", message: "No client with that account number" });
  }
  if (!client.clientEmail) {
    return json(400, { status: "error", message: "No email set for this client" });
  }

  const text = [
    `Hi! Your ${client.service} with ${BUSINESS_NAME} is ready.`,
    "",
    `Go to ${REDEEM_URL} and enter:`,
    `Account Number: ${client.account}`,
    `Activation Code: ${client.code}`,
    "",
    `Price: ${client.price}`,
    "",
    "Once you pay, it activates automatically.",
  ].join("\n");

  const html = `
    <div style="font-family:sans-serif;color:#222;line-height:1.6;">
      <p>Hi! Your <strong>${client.service}</strong> with ${BUSINESS_NAME} is ready.</p>
      <p>Go to <a href="${REDEEM_URL}">${REDEEM_URL}</a> and enter:</p>
      <table style="border-collapse:collapse;">
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Account Number</td><td><strong>${client.account}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Activation Code</td><td><strong>${client.code}</strong></td></tr>
      </table>
      <p style="margin-top:16px;">Price: <strong>${client.price}</strong></p>
      <p>Once you pay, it activates automatically.</p>
    </div>
  `;

  const sent = await sendEmail({
    to: client.clientEmail,
    subject: `Your ${client.service} is ready — ${BUSINESS_NAME}`,
    html,
    text,
  });

  if (!sent) {
    return json(502, { status: "error", message: "Couldn't send the email — is RESEND_API_KEY set?" });
  }

  return json(200, { status: "ok" });
};

export const config: Config = {
  path: "/api/send_client_email.php",
};
