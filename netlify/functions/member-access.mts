import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";
import { json, safeEqual, type ClientRecord } from "./_shared.mts";

function normalizeCode(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function hashCode(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return json(405, { status: "error", message: "Method not allowed" });

  const input = await req.json().catch(() => ({}) as Record<string, unknown>);
  const email = String(input.email ?? "").trim().toLowerCase();
  const code = normalizeCode(input.code);
  if (!email || !/^\d{12}$/.test(code)) {
    return json(400, { status: "error", message: "Enter your email and 12-digit access code." });
  }

  const store = getStore({ name: "clients", consistency: "strong" });
  const { blobs } = await store.list();
  const matchingClients: ClientRecord[] = [];
  const submittedHash = hashCode(code);

  for (const blob of blobs) {
    const client = await store.get(blob.key, { type: "json" }) as ClientRecord | null;
    if (!client || client.status !== "active") continue;
    if ((client.clientEmail ?? "").trim().toLowerCase() !== email) continue;
    matchingClients.push(client);
  }

  const authenticated = matchingClients.some((client) =>
    Boolean(client.portalCodeHash && safeEqual(client.portalCodeHash, submittedHash))
  );
  if (!authenticated) return json(401, { status: "no_match", message: "Those details do not match an active purchase." });

  const purchases = matchingClients.map((client) => ({
      account: client.account,
      title: client.title,
      service: client.service,
      price: client.price,
      activatedAt: client.activatedAt,
      liveUrl: client.liveUrl,
      deliverableFileUrl: client.deliverableFileUrl,
    }));
  return json(200, { status: "ok", purchases });
};

export const config: Config = { path: "/api/member-access" };
