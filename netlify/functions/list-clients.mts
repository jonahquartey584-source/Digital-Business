// Admin-only endpoint: lists every client record, newest first. Called by
// admin.html's "Existing Clients" list on login and on demand (Refresh).
//
// Netlify-hosted equivalent of api/list_clients.php.

import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { decryptPortalCode, json, requireAdminSession, type ClientRecord } from "./_shared.mts";

export default async (req: Request, context: Context) => {
  if (req.method !== "GET") {
    return json(405, { status: "error", message: "Method not allowed" });
  }

  if (!requireAdminSession(req)) {
    return json(401, { status: "error", message: "Not logged in — log into admin.html again" });
  }

  const store = getStore({ name: "clients", consistency: "strong" });
  const { blobs } = await store.list();

  const clients = (
    await Promise.all(blobs.map(({ key }) => store.get(key, { type: "json" }) as Promise<ClientRecord | null>))
  ).filter((client): client is ClientRecord => client !== null);

  clients.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  return json(200, {
    status: "ok",
    clients: clients.map((client) => ({
      ...client,
      portalCode: decryptPortalCode(client.portalCodeEncrypted),
      portalCodeHash: undefined,
      portalCodeEncrypted: undefined,
    })),
  });
};

export const config: Config = {
  path: "/api/list_clients.php",
};
