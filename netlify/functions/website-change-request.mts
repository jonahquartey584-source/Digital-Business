// A client's "New Change Request" on web-development.html (Members
// Portal) posts here — stored for the record and emailed straight to you,
// instead of the generic service-actions.js demo behaviour (which only
// ever saved to that visitor's own browser localStorage and never reached
// you at all).

import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
import { json, sendEmail, type ClientRecord } from "./_shared.mts";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return json(405, { status: "error", message: "Method not allowed" });

  const input = await req.json().catch(() => ({}) as Record<string, unknown>);
  const account = String(input.account ?? "").trim().toUpperCase();
  const page = String(input.page ?? "").trim();
  const requestText = String(input.request ?? "").trim();
  const priority = String(input.priority ?? "Standard").trim();

  if (!account || !requestText) {
    return json(400, { status: "error", message: "Describe the change you need." });
  }

  const clientsStore = getStore({ name: "clients", consistency: "strong" });
  const client = (await clientsStore.get(account, { type: "json" })) as ClientRecord | null;
  if (!client) return json(404, { status: "error", message: "Account not found." });

  const requestsStore = getStore({ name: "website-change-requests", consistency: "strong" });
  const key = `${account}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  await requestsStore.setJSON(key, {
    key,
    account,
    page,
    request: requestText,
    priority,
    clientEmail: client.clientEmail,
    createdAt: new Date().toISOString(),
    status: "new",
  });

  const ownerEmail = Netlify.env.get("PAYMENT_NOTIFICATION_EMAIL") || "jonahquartey584@gmail.com";
  await sendEmail({
    to: ownerEmail,
    subject: `Website change request — ${account}`,
    text: [
      `Account: ${account}`,
      `Page/section: ${page || "Not specified"}`,
      `Priority: ${priority}`,
      `Client email: ${client.clientEmail || "Not set"}`,
      "",
      requestText,
    ].join("\n"),
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h1>Website change request</h1><p><strong>Account:</strong> ${account}</p><p><strong>Page/section:</strong> ${page || "Not specified"}</p><p><strong>Priority:</strong> ${priority}</p><p><strong>Client email:</strong> ${client.clientEmail || "Not set"}</p><p>${requestText.replace(/\n/g, "<br>")}</p></div>`,
    ...(client.clientEmail ? { replyTo: client.clientEmail } : {}),
  });

  return json(200, { status: "ok" });
};

export const config: Config = { path: "/api/website-change-request" };
