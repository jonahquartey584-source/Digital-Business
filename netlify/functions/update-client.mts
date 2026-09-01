// Admin-only endpoint: updates an existing client record in place — every
// field except the account number itself (the store's key; changing it
// would mean a rename, not an update). Called from admin.html's "Existing
// Clients" edit panel.
//
// Netlify-hosted equivalent of api/update_client.php.

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

  if (!account) {
    return json(400, { status: "error", message: "Account is required" });
  }

  const store = getStore({ name: "clients", consistency: "strong" });
  const existing = await store.get(account, { type: "json" }) as ClientRecord | null;

  if (!existing) {
    return json(404, { status: "error", message: "No client with that account number" });
  }

  const code = String(input.code ?? existing.code).trim().toUpperCase();
  const title = String(input.title ?? "").trim();
  const service = String(input.service ?? "").trim();
  const price = String(input.price ?? "").trim();
  const preview = String(input.preview ?? "").trim();
  const previewImageUrl = String(input.previewImageUrl ?? "").trim();
  const previewFileUrl = String(input.previewFileUrl ?? "").trim();
  const deliverableFileUrl = String(input.deliverableFileUrl ?? "").trim();
  const paymentUrl = String(input.paymentUrl ?? "").trim();
  const liveUrl = String(input.liveUrl ?? "").trim();
  // Not editable from the Members page yet — preserved as-is so editing
  // other fields never silently wipes out an already-attached website zip.
  const websiteZipUrl = existing.websiteZipUrl ?? null;
  const clientEmail = String(input.clientEmail ?? "").trim();
  const status: ClientRecord["status"] = input.status === "active" ? "active" : "pending_payment";

  // paymentUrl is optional now — see create-client.mts.
  if (!code || !service || !price) {
    return json(400, { status: "error", message: "Missing required fields" });
  }

  const updated: ClientRecord = {
    ...existing,
    code,
    title: title || null,
    service,
    price,
    preview,
    previewImageUrl: previewImageUrl || null,
    previewFileUrl: previewFileUrl || null,
    deliverableFileUrl: deliverableFileUrl || null,
    paymentUrl,
    liveUrl: liveUrl || null,
    websiteZipUrl,
    clientEmail: clientEmail || null,
    status,
    // Newly flipped to active by hand -> stamp it now. Already active ->
    // keep the original timestamp. Set back to pending -> clear it.
    activatedAt: status === "active" ? (existing.activatedAt ?? new Date().toISOString()) : null,
  };

  await store.setJSON(account, updated);

  return json(200, { status: "updated", account });
};

export const config: Config = {
  path: "/api/update_client.php",
};
