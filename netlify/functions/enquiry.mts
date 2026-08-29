// Public homepage enquiry endpoint. Every valid enquiry is persisted first,
// then optional confirmation/notification emails are attempted best-effort.

import { randomUUID } from "node:crypto";
import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { json, sendEmail } from "./_shared.mts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] as string
  ));
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return json(405, { status: "error", message: "Method not allowed" });
  }

  const input = await req.json().catch(() => ({}) as Record<string, unknown>);
  const name = String(input.name ?? "").trim().slice(0, 80);
  const business = String(input.business ?? "").trim().slice(0, 120);
  const address = String(input.address ?? "").trim().slice(0, 240);
  const email = String(input.email ?? "").trim().slice(0, 160);
  const phone = String(input.phone ?? "").trim().slice(0, 80);
  const service = String(input.service ?? "").trim().slice(0, 120);
  const details = String(input.details ?? "").trim().slice(0, 2000);
  const negotiate = Boolean(input.negotiate);

  if (!name || !email || !service) {
    return json(400, { status: "error", message: "Name, email and service are required" });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return json(400, { status: "error", message: "That email address doesn't look right" });
  }

  const createdAt = new Date().toISOString();
  const key = `requests/${createdAt}-enquiry-${randomUUID()}`;
  const requestSummary = [
    business ? `Business: ${business}` : "",
    address ? `Address: ${address}` : "",
    `Service: ${service}`,
    `Pricing discussion: ${negotiate ? "Yes" : "No"}`,
    details ? `Details: ${details}` : "",
  ].filter(Boolean).join("\n");

  const store = getStore({ name: "ai-agent-requests", consistency: "strong" });
  await store.setJSON(key, {
    key,
    name,
    contact: [email, phone].filter(Boolean).join(" · "),
    message: requestSummary,
    transcript: [],
    status: "new",
    createdAt,
    updatedAt: createdAt,
    source: "website-enquiry",
  });

  const businessInboxEmail = Netlify.env.get("ENQUIRY_NOTIFICATION_EMAIL") ?? "jonahquartey584@gmail.com";
  const summaryHtml = `
    <div style="font-family:sans-serif;color:#222;line-height:1.6;">
      <p>Hi ${escapeHtml(name)},</p>
      <p>Thanks for contacting <strong>Qp Digital</strong> about <strong>${escapeHtml(service)}</strong>.
      Your enquiry has been received and the team will respond as quickly as possible.</p>
      ${details ? `<p><strong>Details:</strong><br>${escapeHtml(details).replace(/\n/g, "<br>")}</p>` : ""}
      <p>— Qp Digital</p>
    </div>`;
  const summaryText = `Hi ${name},\n\nThanks for contacting Qp Digital about ${service}. Your enquiry has been received and the team will respond as quickly as possible.\n\n${details}\n\n— Qp Digital`;

  const emailSent = await sendEmail({
    to: email,
    subject: "We've received your enquiry — Qp Digital",
    html: summaryHtml,
    text: summaryText,
    replyTo: businessInboxEmail || undefined,
  });

  if (businessInboxEmail) {
    await sendEmail({
      to: businessInboxEmail,
      subject: `New website enquiry: ${service} from ${name}`,
      html: `<p><strong>New enquiry from ${escapeHtml(name)}</strong></p><pre>${escapeHtml(requestSummary)}</pre><p>Contact: ${escapeHtml(email)} ${escapeHtml(phone)}</p>`,
      text: `New enquiry from ${name}\nContact: ${email} ${phone}\n\n${requestSummary}`,
      replyTo: email,
    });
  }

  return json(200, { status: "ok", saved: true, emailSent });
};

export const config: Config = {
  path: "/api/enquiry.php",
};
