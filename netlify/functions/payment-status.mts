import type { Config } from "@netlify/functions";

export default async (request: Request) => {
  if (request.method !== "GET") return Response.json({ status: "error" }, { status: 405 });
  const sessionId = new URL(request.url).searchParams.get("session_id") || "";
  const stripeKey = Netlify.env.get("STRIPE_SECRET_KEY") || "";
  if (!sessionId.startsWith("cs_") || !stripeKey) return Response.json({ status: "pending" }, { status: 400 });
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, { headers: { Authorization: `Bearer ${stripeKey}` } });
  const session = await response.json().catch(() => ({})) as {
    payment_status?: string;
    status?: string;
    customer_email?: string;
    customer_details?: { email?: string };
    metadata?: { portal_code?: string; account?: string };
  };
  const code = String(session.metadata?.portal_code || "").replace(/\D/g, "").slice(0, 12);
  if (!response.ok || session.payment_status !== "paid" || code.length !== 12) return Response.json({ status: "pending" }, { status: 202 });
  return Response.json({
    status: "paid",
    code: code.replace(/(\d{4})(?=\d)/g, "$1 "),
    account: session.metadata?.account || "",
    email: session.customer_details?.email || session.customer_email || "",
  }, { headers: { "Cache-Control": "no-store" } });
};

export const config: Config = { path: "/api/payment-status", method: "GET" };
