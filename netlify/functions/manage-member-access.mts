// Admin-only endpoint powering the Members Portal's own "Administrator" tab
// (members.js -> renderAdministratorMembers): regenerating a client's
// 12-digit portal code, or updating which services they have access to and
// whether their access is enabled — without leaving members.html or going
// through the separate New Client Setup form for an existing client.
//
// Same session model as create-client.mts/activate-client.mts
// (Authorization: Bearer <admin session token>), same Blobs store, same
// portal-code hashing as webhook.mts/activate-client.mts so a regenerated
// code works with member-access.mts exactly like one issued at signup.

import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { createHash, randomInt } from "node:crypto";
import { encryptPortalCode, json, requireAdminSession, type ClientRecord } from "./_shared.mts";

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
    return json(401, { status: "error", message: "Not logged in — sign in as administrator again." });
  }

  const input = await req.json().catch(() => ({}) as Record<string, unknown>);
  const action = String(input.action ?? "");
  const account = String(input.account ?? "").trim().toUpperCase();
  if (!account) {
    return json(400, { status: "error", message: "Missing account." });
  }

  const store = getStore({ name: "clients", consistency: "strong" });
  const client = (await store.get(account, { type: "json" })) as ClientRecord | null;
  if (!client) {
    return json(404, { status: "error", message: "No client with that account number." });
  }

  if (action === "regenerate_code") {
    const code = createPortalCode();
    client.status = "active";
    client.activatedAt = client.activatedAt ?? new Date().toISOString();
    client.portalCodeHash = hashPortalCode(code);
    client.portalCodeEncrypted = encryptPortalCode(code);
    client.portalCodeIssuedAt = new Date().toISOString();
    await store.setJSON(account, client);
    return json(200, { status: "ok", code: code.replace(/(\d{4})(?=\d)/g, "$1 ") });
  }

  if (action === "update_access") {
    const services = Array.isArray(input.services)
      ? input.services.map((value) => String(value)).filter(Boolean)
      : [];
    const enabled = Boolean(input.enabled);
    // Always write the submitted list, including an empty list. Previously
    // unchecking every service left the old value untouched, so revoked
    // services continued to appear in the client's portal.
    client.service = services.join(", ");
    client.status = enabled ? "active" : "pending_payment";
    if (enabled) client.activatedAt = client.activatedAt ?? new Date().toISOString();
    await store.setJSON(account, client);
    return json(200, { status: "ok", services, enabled });
  }

  return json(400, { status: "error", message: "Unknown action." });
};

export const config: Config = {
  path: "/api/manage-member-access",
};
