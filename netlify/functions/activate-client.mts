// Admin-only endpoint: manually activates a client record and issues its
// 12-digit members-portal code, without a real Stripe payment going
// through webhook.mts. For comp/free accounts (e.g. your own admin
// access) — everything else about the record (status, portalCodeHash,
// portalCodeIssuedAt) matches exactly what a real payment would set, so
// member-access.mts treats it identically either way.
//
// Not called from admin.html's UI (no button wired up yet) — invoke it
// directly, same way you'd call create-client, with the admin bearer
// token: POST { account, code? } to /api/activate_client.php. `code` is
// optional — a random 12-digit code is generated if omitted. The
// plaintext code is only ever returned in this one response (mirroring
// webhook.mts, which only ever emails it once) — store it now, it can't
// be retrieved again afterward, only reissued (which invalidates the old
// one).

import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { createHash, randomInt } from "node:crypto";
import {
  encryptPortalCode,
  json,
  requireAdminSession,
  provisionRealAppAccess,
  realAppProductForService,
  deployClientWebsite,
  type ClientRecord,
} from "./_shared.mts";

function createPortalCode(): string {
  return Array.from({ length: 12 }, () => randomInt(0, 10)).join("");
}

function hashPortalCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return json(405, { status: "error", message: "Method not allowed" });
  }

  if (!requireAdminSession(req)) {
    return json(401, { status: "error", message: "Not logged in — log into admin.html again" });
  }

  const input = await req.json().catch(() => ({}) as Record<string, unknown>);
  const account = String(input.account ?? "").trim().toUpperCase();
  const requestedCode = String(input.code ?? "").trim();

  if (!account) {
    return json(400, { status: "error", message: "Account is required" });
  }
  if (requestedCode && !/^\d{12}$/.test(requestedCode)) {
    return json(400, { status: "error", message: "code must be exactly 12 digits, or omitted to auto-generate one" });
  }

  const store = getStore({ name: "clients", consistency: "strong" });
  const existing = (await store.get(account, { type: "json" })) as ClientRecord | null;
  if (!existing) {
    return json(404, { status: "error", message: "No client with that account number" });
  }
  if (!existing.clientEmail) {
    return json(400, {
      status: "error",
      message: "This client record has no clientEmail set — member-access.mts matches on email, so it's required before a portal code is any use.",
    });
  }

  const code = requestedCode || createPortalCode();

  const updated: ClientRecord = {
    ...existing,
    status: "active",
    activatedAt: existing.activatedAt ?? new Date().toISOString(),
    portalCodeHash: hashPortalCode(code),
    portalCodeEncrypted: encryptPortalCode(code),
    portalCodeIssuedAt: new Date().toISOString(),
  };

  if (!updated.netlifySiteId && updated.websiteZipUrl) {
    const deployed = await deployClientWebsite(updated);
    if (deployed) {
      updated.netlifySiteId = deployed.siteId;
      updated.liveUrl = deployed.url;
    }
  }

  await store.setJSON(account, updated);

  const realAppProduct = realAppProductForService(updated.service);
  if (realAppProduct) {
    await provisionRealAppAccess(existing.clientEmail, realAppProduct);
  }

  return json(200, { status: "activated", account, code, clientEmail: updated.clientEmail, liveUrl: updated.liveUrl });
};

export const config: Config = {
  path: "/api/activate_client.php",
};
