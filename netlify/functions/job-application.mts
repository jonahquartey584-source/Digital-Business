// Public "Careers" page application endpoint (careers.html / careers.js).
// Same shape and store as enquiry.mts — every application lands in the
// same admin-only /api/agent-requests inbox, tagged source:"job-application"
// so admin-careers.html can show just the applications (same pattern
// admin-enquiries.html already uses for source:"website-enquiry").

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
  const role = String(input.role ?? "Cold Caller").trim().slice(0, 80);
  const name = String(input.name ?? "").trim().slice(0, 80);
  const email = String(input.email ?? "").trim().slice(0, 160);
  const phone = String(input.phone ?? "").trim().slice(0, 80);
  const message = String(input.message ?? "").trim().slice(0, 2000);

  if (!name || (!email && !phone)) {
    return json(400, { status: "error", message: "Add your name and an email or phone number so we can reach you." });
  }
  if (email && !EMAIL_PATTERN.test(email)) {
    return json(400, { status: "error", message: "That email address doesn't look right" });
  }

  const createdAt = new Date().toISOString();
  const key = `requests/${createdAt}-application-${randomUUID()}`;

  const store = getStore({ name: "ai-agent-requests", consistency: "strong" });
  await store.setJSON(key, {
    key,
    name,
    contact: [email, phone].filter(Boolean).join(" · "),
    message: [`Role: ${role}`, message].filter(Boolean).join("\n\n"),
    transcript: [],
    status: "new",
    createdAt,
    updatedAt: createdAt,
    source: "job-application",
  });

  const ownerEmail = Netlify.env.get("ENQUIRY_NOTIFICATION_EMAIL") ?? "contact@qp-digital.co.uk";

  if (email) {
    await sendEmail({
      to: email,
      subject: `We've received your application — Qp Digital`,
      html: `<div style="font-family:sans-serif;color:#222;line-height:1.6;">
        <p>Hi ${escapeHtml(name)},</p>
        <p>Thanks for applying for the <strong>${escapeHtml(role)}</strong> role at <strong>Qp Digital</strong>. We've received your application and will be in touch if it's a good fit.</p>
        <p>— Qp Digital</p>
      </div>`,
      text: `Hi ${name},\n\nThanks for applying for the ${role} role at Qp Digital. We've received your application and will be in touch if it's a good fit.\n\n— Qp Digital`,
      replyTo: ownerEmail || undefined,
    });
  }

  if (ownerEmail) {
    await sendEmail({
      to: ownerEmail,
      subject: `New job application: ${role} — ${name}`,
      html: `<p><strong>New application from ${escapeHtml(name)}</strong></p><p><strong>Role:</strong> ${escapeHtml(role)}</p><p><strong>Contact:</strong> ${escapeHtml([email, phone].filter(Boolean).join(" · "))}</p>${message ? `<p><strong>Message:</strong><br>${escapeHtml(message).replace(/\n/g, "<br>")}</p>` : ""}`,
      text: `New application from ${name}\nRole: ${role}\nContact: ${[email, phone].filter(Boolean).join(" · ")}\n\n${message}`,
      replyTo: email || undefined,
    });
  }

  return json(200, { status: "ok" });
};

export const config: Config = {
  path: "/api/job-application",
};
