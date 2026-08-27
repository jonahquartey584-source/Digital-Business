// Public endpoint: a visitor submitting the homepage's enquiry form lands
// here. Sends them an automatic "we've got it" confirmation email, and
// (best-effort — its failure doesn't affect the visitor's response) a
// notification to the business inbox with the enquiry's details.
//
// Netlify-hosted equivalent of api/enquiry.php. Unlike every other
// endpoint in this codebase, this one is intentionally public — anyone can
// submit an enquiry, that's the point of the form.

import type { Config, Context } from "@netlify/functions";
import { json, sendEmail } from "./_shared.mts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] as string
  ));
}

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return json(405, { status: "error", message: "Method not allowed" });
  }

  const input = await req.json().catch(() => ({}) as Record<string, unknown>);

  const name = String(input.name ?? "").trim();
  const business = String(input.business ?? "").trim();
  const address = String(input.address ?? "").trim();
  const email = String(input.email ?? "").trim();
  const phone = String(input.phone ?? "").trim();
  const service = String(input.service ?? "").trim();
  const details = String(input.details ?? "").trim();
  const negotiate = Boolean(input.negotiate);

  if (!name || !email || !service) {
    return json(400, { status: "error", message: "Name, email and service are required" });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return json(400, { status: "error", message: "That email address doesn't look right" });
  }

  const businessInboxEmail = Netlify.env.get("ADMIN_EMAIL") ?? "";

  const summaryRowsHtml = [
    ["Service", service],
    business ? ["Business", business] : null,
    address ? ["Address", address] : null,
    phone ? ["Phone", phone] : null,
    ["Open to negotiating price", negotiate ? "Yes" : "No"],
  ]
    .filter((row): row is [string, string] => row !== null)
    .map(([label, value]) => `<tr><td style="padding:4px 12px 4px 0;color:#666;">${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`)
    .join("");

  const confirmationHtml = `
    <div style="font-family:sans-serif;color:#222;line-height:1.6;">
      <p>Hi ${escapeHtml(name)},</p>
      <p>Thanks for reaching out to <strong>Qp Digital</strong> about <strong>${escapeHtml(service)}</strong>.
      We've received your enquiry and our team will respond as quickly as possible.</p>
      <p>Here's what you sent us:</p>
      <table style="border-collapse:collapse;">${summaryRowsHtml}</table>
      ${details ? `<p style="margin-top:16px;"><strong>Details:</strong><br>${escapeHtml(details).replace(/\n/g, "<br>")}</p>` : ""}
      <p style="margin-top:16px;">If anything above needs correcting, just reply to this email.</p>
      <p>— Qp Digital</p>
    </div>
  `;
  const confirmationText = [
    `Hi ${name},`,
    "",
    `Thanks for reaching out to Qp Digital about ${service}. We've received your enquiry and our team will respond as quickly as possible.`,
    "",
    "Here's what you sent us:",
    `Service: ${service}`,
    business ? `Business: ${business}` : null,
    address ? `Address: ${address}` : null,
    phone ? `Phone: ${phone}` : null,
    `Open to negotiating price: ${negotiate ? "Yes" : "No"}`,
    "",
    details ? `Details:\n${details}` : null,
    "",
    "If anything above needs correcting, just reply to this email.",
    "",
    "— Qp Digital",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const confirmationSent = await sendEmail({
    to: email,
    subject: "We've received your enquiry — Qp Digital",
    html: confirmationHtml,
    text: confirmationText,
    replyTo: businessInboxEmail || undefined,
  });

  // Best-effort: a visitor's confirmation is the important part and is
  // already sent above; whether the business's own notification succeeds
  // doesn't change what we tell them.
  if (businessInboxEmail) {
    await sendEmail({
      to: businessInboxEmail,
      subject: `New enquiry: ${service} from ${name}`,
      html: confirmationHtml.replace("Hi " + escapeHtml(name), `New enquiry from ${escapeHtml(name)} (${escapeHtml(email)})`),
      text: confirmationText.replace(`Hi ${name},`, `New enquiry from ${name} (${email}):`),
      replyTo: email,
    });
  }

  return json(200, { status: "ok", emailSent: confirmationSent });
};

export const config: Config = {
  path: "/api/enquiry.php",
};
