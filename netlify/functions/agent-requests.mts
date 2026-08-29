import { randomUUID } from "node:crypto";
import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { json, requireAdminSession, safeEqual } from "./_shared.mts";

type ChatMessage = {
  role: "user" | "assistant" | "agent";
  content: string;
};

type AgentRequest = {
  key: string;
  visitorToken?: string;
  name: string;
  contact: string;
  message: string;
  transcript: ChatMessage[];
  status: "new" | "contacted";
  createdAt: string;
  updatedAt?: string;
  contactedAt?: string;
};

const cleanMessage = (value: unknown): string =>
  typeof value === "string" ? value.trim().slice(0, 1000) : "";

const cleanTranscript = (value: unknown): ChatMessage[] =>
  Array.isArray(value)
    ? value
        .slice(-40)
        .filter(
          (item): item is ChatMessage =>
            typeof item === "object" &&
            item !== null &&
            "role" in item &&
            (item.role === "user" || item.role === "assistant" || item.role === "agent") &&
            "content" in item &&
            typeof item.content === "string"
        )
        .map((item) => ({ role: item.role, content: cleanMessage(item.content) }))
        .filter((item) => item.content.length > 0)
    : [];

export default async (req: Request, _context: Context) => {
  const store = getStore({ name: "ai-agent-requests", consistency: "strong" });

  if (req.method === "POST") {
    try {
      const raw = await req.text();
      if (raw.length > 45_000) return json(413, { status: "error", message: "Request too large" });
      const body = JSON.parse(raw) as Record<string, unknown>;
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
      const contact = typeof body.contact === "string" ? body.contact.trim().slice(0, 160) : "";
      const message = typeof body.message === "string" ? body.message.trim().slice(0, 800) : "";
      const transcript = cleanTranscript(body.transcript);
      if (!name || !contact) return json(400, { status: "error", message: "Name and contact details are required" });

      const createdAt = new Date().toISOString();
      const visitorToken = randomUUID();
      const key = `requests/${createdAt}-${randomUUID()}`;
      const record: AgentRequest = {
        key,
        visitorToken,
        name,
        contact,
        message,
        transcript,
        status: "new",
        createdAt,
        updatedAt: createdAt,
      };
      await store.setJSON(key, record);
      return json(201, { status: "created", key, visitorToken, transcriptLength: transcript.length });
    } catch {
      return json(400, { status: "error", message: "Invalid request" });
    }
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    const key = url.searchParams.get("key") || "";
    const visitorToken = url.searchParams.get("token") || "";

    if (key && visitorToken && key.startsWith("requests/")) {
      const record = await store.get(key, { type: "json" }) as AgentRequest | null;
      if (!record?.visitorToken || !safeEqual(record.visitorToken, visitorToken)) {
        return json(401, { status: "error", message: "Chat access denied" });
      }
      return json(200, {
        status: "ok",
        requestStatus: record.status,
        transcript: cleanTranscript(record.transcript),
        updatedAt: record.updatedAt || record.createdAt,
      });
    }

    if (!requireAdminSession(req)) {
      return json(401, { status: "error", message: "Not logged in — log into admin.html again" });
    }

    const { blobs } = await store.list({ prefix: "requests/" });
    const records = (await Promise.all(
      blobs.map(({ key: blobKey }) => store.get(blobKey, { type: "json" }) as Promise<AgentRequest | null>)
    )).filter((item): item is AgentRequest => item !== null);

    const requests = records.map(({ visitorToken: _visitorToken, ...record }) => ({
      ...record,
      transcript: cleanTranscript(record.transcript),
    }));
    requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return json(200, { status: "ok", requests });
  }

  if (req.method === "PATCH") {
    try {
      const raw = await req.text();
      if (raw.length > 6_000) return json(413, { status: "error", message: "Request too large" });
      const body = JSON.parse(raw) as Record<string, unknown>;
      const key = typeof body.key === "string" && body.key.startsWith("requests/") ? body.key : "";
      if (!key) return json(400, { status: "error", message: "Invalid request key" });

      const record = await store.get(key, { type: "json" }) as AgentRequest | null;
      if (!record) return json(404, { status: "error", message: "Request not found" });

      const visitorToken = typeof body.visitorToken === "string" ? body.visitorToken : "";
      if (visitorToken) {
        if (!record.visitorToken || !safeEqual(record.visitorToken, visitorToken)) {
          return json(401, { status: "error", message: "Chat access denied" });
        }
        const content = cleanMessage(body.content);
        if (!content) return json(400, { status: "error", message: "Message is required" });
        const transcript = [...cleanTranscript(record.transcript), { role: "user" as const, content }].slice(-40);
        await store.setJSON(key, { ...record, transcript, updatedAt: new Date().toISOString() });
        return json(200, { status: "message-sent", transcriptLength: transcript.length });
      }

      if (!requireAdminSession(req)) {
        return json(401, { status: "error", message: "Not logged in — log into admin.html again" });
      }

      if (body.action === "reply") {
        const content = cleanMessage(body.content);
        if (!content) return json(400, { status: "error", message: "Reply is required" });
        const transcript = [...cleanTranscript(record.transcript), { role: "agent" as const, content }].slice(-40);
        await store.setJSON(key, { ...record, transcript, updatedAt: new Date().toISOString() });
        return json(200, { status: "reply-sent" });
      }

      await store.setJSON(key, {
        ...record,
        status: "contacted",
        contactedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return json(200, { status: "updated" });
    } catch {
      return json(400, { status: "error", message: "Invalid request" });
    }
  }

  if (req.method === "DELETE") {
    if (!requireAdminSession(req)) {
      return json(401, { status: "error", message: "Not logged in — log into admin.html again" });
    }
    try {
      const raw = await req.text();
      if (raw.length > 2_000) return json(413, { status: "error", message: "Request too large" });
      const body = JSON.parse(raw) as Record<string, unknown>;
      const key = typeof body.key === "string" && body.key.startsWith("requests/") ? body.key : "";
      if (!key) return json(400, { status: "error", message: "Invalid request key" });

      const record = await store.get(key, { type: "json" }) as (AgentRequest & { source?: string }) | null;
      if (!record) return json(404, { status: "error", message: "Request not found" });
      if (record.source === "website-enquiry") {
        return json(400, { status: "error", message: "Website enquiries cannot be deleted here" });
      }

      await store.delete(key);
      return json(200, { status: "deleted" });
    } catch {
      return json(400, { status: "error", message: "Invalid request" });
    }
  }

  return json(405, { status: "error", message: "Method not allowed" });
};

export const config: Config = {
  path: "/api/agent-requests",
};
