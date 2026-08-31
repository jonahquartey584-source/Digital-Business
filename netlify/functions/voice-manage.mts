// Client-facing AI Reception setup/management — the backend for the AI
// Assistant panel in ai-automation.html. Auth note: same trust model as
// crm-data.mts (this site's throughout pattern) — the client's own
// verified email from qpMemberSession scopes their workspace, no separate
// session token.

import type { Config, Context } from "@netlify/functions";
import {
  getVoiceSettings,
  saveVoiceSettings,
  searchAvailableUkNumbers,
  provisionNumberForEmail,
  releaseNumberForEmail,
  json,
} from "./_voice-shared.mts";

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function str(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}

// Never send the encrypted Subaccount Auth Token (or the raw Subaccount
// SID, no reason to expose it either) to the client.
function publicView(settings: Awaited<ReturnType<typeof getVoiceSettings>>) {
  return {
    email: settings.email,
    phoneNumber: settings.phoneNumber,
    businessName: settings.businessName,
    businessContext: settings.businessContext,
    forwardingNumber: settings.forwardingNumber,
    greeting: settings.greeting,
    enabled: settings.enabled,
    calls: settings.calls.map((c) => ({
      callSid: c.callSid,
      fromNumber: c.fromNumber,
      status: c.status,
      summary: c.summary,
      durationSeconds: c.durationSeconds,
      startedAt: c.startedAt,
      endedAt: c.endedAt,
      transcript: c.transcript,
    })),
  };
}

export default async (req: Request, _context: Context) => {
  if (req.method === "GET") {
    const email = normalizeEmail(new URL(req.url).searchParams.get("email"));
    if (!email) return json(400, { status: "error", message: "email is required" });
    const settings = await getVoiceSettings(email);
    return json(200, { status: "ok", settings: publicView(settings) });
  }

  if (req.method !== "POST") {
    return json(405, { status: "error", message: "Method not allowed" });
  }

  const input = await req.json().catch(() => ({}) as Record<string, unknown>);
  const email = normalizeEmail(input.email);
  const action = String(input.action ?? "");
  const payload = (input.payload ?? {}) as Record<string, unknown>;
  if (!email) return json(400, { status: "error", message: "email is required" });

  switch (action) {
    case "searchNumbers": {
      try {
        const numbers = await searchAvailableUkNumbers();
        return json(200, { status: "ok", numbers });
      } catch (error) {
        console.error("searchNumbers failed:", error);
        return json(500, {
          status: "error",
          message: "Couldn't search for numbers — check the platform's Twilio account is set up and out of trial mode.",
        });
      }
    }

    case "provision": {
      const phoneNumber = str(payload.phoneNumber);
      if (!phoneNumber) return json(400, { status: "error", message: "Choose a phone number first." });

      const existing = await getVoiceSettings(email);
      await saveVoiceSettings({
        ...existing,
        businessName: str(payload.businessName) ?? existing.businessName,
        businessContext: str(payload.businessContext) ?? existing.businessContext,
        forwardingNumber: str(payload.forwardingNumber) ?? existing.forwardingNumber,
        greeting: str(payload.greeting) ?? existing.greeting,
      });

      const siteUrl = new URL(req.url).origin;
      try {
        const settings = await provisionNumberForEmail(email, phoneNumber, siteUrl);
        return json(200, { status: "ok", settings: publicView(settings) });
      } catch (error) {
        console.error("provisionNumberForEmail failed:", error);
        return json(500, {
          status: "error",
          message: "Couldn't set up that number — check the platform's Twilio account has billing added (trial accounts can't provision real client numbers).",
        });
      }
    }

    case "updateSettings": {
      const settings = await getVoiceSettings(email);
      const updated = {
        ...settings,
        businessName: str(payload.businessName) ?? settings.businessName,
        businessContext: str(payload.businessContext) ?? settings.businessContext,
        forwardingNumber: str(payload.forwardingNumber) ?? settings.forwardingNumber,
        greeting: str(payload.greeting) ?? settings.greeting,
      };
      await saveVoiceSettings(updated);
      return json(200, { status: "ok", settings: publicView(updated) });
    }

    case "release": {
      await releaseNumberForEmail(email);
      const settings = await getVoiceSettings(email);
      return json(200, { status: "ok", settings: publicView(settings) });
    }

    default:
      return json(400, { status: "error", message: `Unknown action: ${action}` });
  }
};

export const config: Config = { path: "/api/voice-manage" };
