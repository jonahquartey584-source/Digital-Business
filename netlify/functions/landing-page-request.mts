// A client's "Request Landing Page" action (currently on
// booking-system.html — see booking-app.js) posts here — stored for the
// record and emailed straight to you, same pattern as
// website-change-request.mts. This is a request, not a self-serve
// builder: Qp Digital designs and ships the page by hand.

import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
import { json, sendEmail, type ClientRecord } from "./_shared.mts";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return json(405, { status: "error", message: "Method not allowed" });

  const input = await req.json().catch(() => ({}) as Record<string, unknown>);
  const account = String(input.account ?? "").trim().toUpperCase();
  const service = String(input.service ?? "").trim();
  const businessName = String(input.businessName ?? "").trim();
  const details = String(input.details ?? "").trim();
  const contactEmail = String(input.contactEmail ?? "").trim();

  if (!account || !businessName || !details) {
    return json(400, { status: "error", message: "Add a business name and describe what the page should include." });
  }

  const clientsStore = getStore({ name: "clients", consistency: "strong" });
  const client = (await clientsStore.get(account, { type: "json" })) as ClientRecord | null;
  if (!client) return json(404, { status: "error", message: "Account not found." });

  const requestsStore = getStore({ name: "landing-page-requests", consistency: "strong" });
  const key = `${account}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  await requestsStore.setJSON(key, {
    key,
    account,
    service: service || "Booking System",
    businessName,
    details,
    contactEmail: contactEmail || client.clientEmail || null,
    clientEmail: client.clientEmail || null,
    createdAt: new Date().toISOString(),
    status: "new",
  });

  const ownerEmail = Netlify.env.get("PAYMENT_NOTIFICATION_EMAIL") || "jonahquartey584@gmail.com";
  await sendEmail({
    to: ownerEmail,
    subject: `Landing page request — ${account}`,
    text: [
      `Account: ${account}`,
      `Service: ${service || "Booking System"}`,
      `Business name: ${businessName}`,
      `Contact email: ${contactEmail || client.clientEmail || "Not set"}`,
      "",
      details,
    ].join("\n"),
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h1>Landing page request</h1><p><strong>Account:</strong> ${account}</p><p><strong>Service:</strong> ${service || "Booking System"}</p><p><strong>Business name:</strong> ${businessName}</p><p><strong>Contact email:</strong> ${contactEmail || client.clientEmail || "Not set"}</p><p>${details.replace(/\n/g, "<br>")}</p></div>`,
    ...(client.clientEmail ? { replyTo: client.clientEmail } : {}),
  });

  return json(200, { status: "ok" });
};

export const config: Config = { path: "/api/landing-page-request" };
