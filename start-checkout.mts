import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { randomInt } from "node:crypto";
import { type ClientRecord } from "./_shared.mts";

function redirect(location: string, status = 303) {
  return new Response(null, { status, headers: { Location: location, "Cache-Control": "no-store" } });
}

export default async (request: Request) => {
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const account = new URL(request.url).searchParams.get("account")?.trim().toUpperCase() || "";
  if (!account) return redirect("/activate.html?payment=invalid");

  const store = getStore({ name: "clients", consistency: "strong" });
  const client = await store.get(account, { type: "json" }) as ClientRecord | null;
  if (!client || client.status === "active") return redirect("/members.html");

  const stripeKey = Netlify.env.get("STRIPE_SECRET_KEY") || "";
  if (!stripeKey) return redirect(client.paymentUrl);

  const amount = Math.round(Number(String(client.price).replace(/[^0-9.]/g, "")) * 100);
  if (!Number.isFinite(amount) || amount < 50) return redirect(client.paymentUrl);

  const recurring = /month|monthly|membership|subscription/i.test(`${client.price} ${client.service}`);
  const portalCode = Array.from({ length: 12 }, () => randomInt(0, 10)).join("");
  const origin = "https://qp-digital.co.uk";
  const form = new URLSearchParams({
    mode: recurring ? "subscription" : "payment",
    client_reference_id: account,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "gbp",
    "line_items[0][price_data][unit_amount]": String(amount),
    "line_items[0][price_data][product_data][name]": client.title || client.service,
    success_url: `${origin}/payment-success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/activate.html?payment=cancelled`,
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
  const session = await response.json().catch(() => ({})) as { url?: string };
  return session.url ? redirect(session.url) : redirect(client.paymentUrl);
};

export const config: Config = { path: "/api/start-checkout", method: "GET" };
