// Admin-only endpoint: creates a new client record (account number, code,
// service, price, preview text/image, payment link). Called from
// admin.html's "Save To Live Database" button.
//
// Netlify-hosted equivalent of api/create_client.php — same request/response
// shape, backed by a Netlify Blobs store instead of MySQL. The route is
// deliberately kept at the same "api/create_client.php" path so admin.js
// doesn't need to know or care which backend is actually live.

import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { json, requireAdminSession, type ClientRecord } from "./_shared.mts";

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return json(405, { status: "error", message: "Method not allowed" });
  }

  if (!requireAdminSession(req)) {
    return json(401, { status: "error", message: "Not logged in — log into admin.html again" });
  }

  const input = await req.json().catch(() => ({}) as Record<string, unknown>);

  const account = String(input.account ?? "").trim().toUpperCase();
  const code = String(input.code ?? "").trim().toUpperCase();
  const title = String(input.title ?? "").trim();
  const service = String(input.service ?? "").trim();
  const price = String(input.price ?? "").trim();
  const preview = String(input.preview ?? "").trim();
  const previewImageUrl = String(input.previewImageUrl ?? "").trim();
  const previewFileUrl = String(input.previewFileUrl ?? "").trim();
  const paymentUrl = String(input.paymentUrl ?? "").trim();
  const liveUrl = String(input.liveUrl ?? "").trim();

  if (!account || !code || !service || !price || !paymentUrl) {
    return json(400, { status: "error", message: "Missing required fields" });
  }

  const store = getStore({ name: "clients", consistency: "strong" });

  const existing = await store.get(account, { type: "json" });
  if (existing) {
    // Most likely cause: account number collision — admin.js generates a
    // fresh random one on retry, same as the PHP version's UNIQUE
    // constraint violation.
    return json(409, {
      status: "error",
      message: "That account number already exists — try again to generate a new one",
    });
  }

  const record: ClientRecord = {
    account,
    code,
    title: title || null,
    service,
    price,
    preview,
    previewImageUrl: previewImageUrl || null,
    previewFileUrl: previewFileUrl || null,
    paymentUrl,
    liveUrl: liveUrl || null,
    status: "pending_payment",
    createdAt: new Date().toISOString(),
    activatedAt: null,
  };

  await store.setJSON(account, record);

  return json(200, { status: "created", account });
};

export const config: Config = {
  path: "/api/create_client.php",
};
