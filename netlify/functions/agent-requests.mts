import { randomUUID } from "node:crypto";
import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { json, requireAdminSession } from "./_shared.mts";

type AgentRequest = {
  key: string;
  name: string;
  contact: string;
  message: string;
  status: "new" | "contacted";
  createdAt: string;
  contactedAt?: string;
};

export default async (req: Request, _context: Context) => {
  const store = getStore({ name: "ai-agent-requests", consistency: "strong" });

  if (req.method === "POST") {
    try {
      const raw = await req.text();
      if (raw.length > 4_000) return json(413, { status: "error", message: "Request too large" });
      const body = JSON.parse(raw) as Record<string, unknown>;
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
      const contact = typeof body.contact === "string" ? body.contact.trim().slice(0, 160) : "";
      const message = typeof body.message === "string" ? body.message.trim().slice(0, 800) : "";
      if (!name || !contact) return json(400, { status: "error", message: "Name and contact details are required" });

      const createdAt = new Date().toISOString();
      const key = `requests/${createdAt}-${randomUUID()}`;
      const record: AgentRequest = { key, name, contact, message, status: "new", createdAt };
      await store.setJSON(key, record);
      return json(201, { status: "created" });
    } catch {
      return json(400, { status: "error", message: "Invalid request" });
    }
  }

  if (!requireAdminSession(req)) {
    return json(401, { status: "error", message: "Not logged in — log into admin.html again" });
  }

  if (req.method === "GET") {
    const { blobs } = await store.list({ prefix: "requests/" });
    const requests = (await Promise.all(
      blobs.map(({ key }) => store.get(key, { type: "json" }) as Promise<AgentRequest | null>)
    )).filter((item): item is AgentRequest => item !== null);
    requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return json(200, { status: "ok", requests });
  }

  if (req.method === "PATCH") {
    try {
      const body = await req.json() as { key?: unknown };
      const key = typeof body.key === "string" && body.key.startsWith("requests/") ? body.key : "";
      if (!key) return json(400, { status: "error", message: "Invalid request key" });
      const record = await store.get(key, { type: "json" }) as AgentRequest | null;
      if (!record) return json(404, { status: "error", message: "Request not found" });
      await store.setJSON(key, { ...record, status: "contacted", contactedAt: new Date().toISOString() });
      return json(200, { status: "updated" });
    } catch {
      return json(400, { status: "error", message: "Invalid request" });
    }
  }

  return json(405, { status: "error", message: "Method not allowed" });
};

export const config: Config = {
  path: "/api/agent-requests",
};
