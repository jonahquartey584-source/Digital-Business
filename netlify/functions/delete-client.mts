// Admin-only endpoint: permanently deletes a client record. Called from
// admin.html's "Existing Clients" list — a destructive, irreversible
// action, so admin.js confirms with the user before ever calling this.
//
// Netlify-hosted equivalent of api/delete_client.php.

import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { json, requireAdminSession } from "./_shared.mts";

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
  const existing = await store.get(account, { type: "json" });

  if (!existing) {
    return json(404, { status: "error", message: "No client with that account number" });
  }

  await store.delete(account);

  return json(200, { status: "deleted", account });
};

export const config: Config = {
  path: "/api/delete_client.php",
};
