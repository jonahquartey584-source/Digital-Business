import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import { json, type ClientRecord } from "./_shared.mts";

export default async (_req: Request, _context: Context) => {
  const user = await getUser();
  if (!user?.email) return json(401, { status: "error", message: "Please sign in again." });

  const email = user.email.trim().toLowerCase();
  const store = getStore({ name: "clients", consistency: "strong" });
  const { blobs } = await store.list();
  const purchases = [];

  for (const blob of blobs) {
    const client = await store.get(blob.key, { type: "json" }) as ClientRecord | null;
    if (!client || client.status !== "active") continue;
    if ((client.clientEmail ?? "").trim().toLowerCase() !== email) continue;
    purchases.push({
      account: client.account,
      title: client.title,
      service: client.service,
      price: client.price,
      activatedAt: client.activatedAt,
      liveUrl: client.liveUrl,
      deliverableFileUrl: client.deliverableFileUrl,
    });
  }

  if (!purchases.length) return json(404, { status: "error", message: "No active purchases were found for this account." });
  return json(200, { status: "ok", purchases });
};

export const config: Config = { path: "/api/member-purchases" };
