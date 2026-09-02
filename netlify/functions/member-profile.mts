// First-time onboarding answers ("Tell us about your business"), saved
// against the client's own Identity account instead of just this browser's
// localStorage — so the five-question wizard in members.js only ever runs
// once per client, no matter which device or browser they next sign in
// from. Same auth pattern as member-purchases.mts: getUser() reads the
// caller's Netlify Identity session for us, no separate token needed.

import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";
import { json } from "./_shared.mts";

export interface MemberProfile {
  contactName: string;
  businessName: string;
  industry: string;
  idealCustomer: string;
  primaryGoal: string;
  createdAt: string;
  updatedAt: string;
}

const SHORT_FIELDS = ["contactName", "businessName", "industry"] as const;
const LONG_FIELDS = ["idealCustomer", "primaryGoal"] as const;

function profileStore() {
  return getStore({ name: "member-profiles", consistency: "strong" });
}

export default async (req: Request, _context: Context) => {
  const user = await getUser().catch(() => null);
  if (!user?.email) return json(401, { status: "error", message: "Please sign in again." });
  const email = user.email.trim().toLowerCase();

  if (req.method === "GET") {
    const profile = (await profileStore().get(email, { type: "json" })) as MemberProfile | null;
    return json(200, { status: "ok", profile });
  }

  if (req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      const raw = await req.text();
      if (raw.length > 6_000) return json(413, { status: "error", message: "Request too large" });
      body = JSON.parse(raw);
    } catch {
      return json(400, { status: "error", message: "Invalid request" });
    }

    const clean: Record<string, string> = {};
    for (const field of SHORT_FIELDS) {
      const value = typeof body[field] === "string" ? (body[field] as string).trim().slice(0, 160) : "";
      if (!value) return json(400, { status: "error", message: `${field} is required` });
      clean[field] = value;
    }
    for (const field of LONG_FIELDS) {
      const value = typeof body[field] === "string" ? (body[field] as string).trim().slice(0, 600) : "";
      if (!value) return json(400, { status: "error", message: `${field} is required` });
      clean[field] = value;
    }

    const existing = (await profileStore().get(email, { type: "json" })) as MemberProfile | null;
    const now = new Date().toISOString();
    const profile: MemberProfile = {
      contactName: clean.contactName,
      businessName: clean.businessName,
      industry: clean.industry,
      idealCustomer: clean.idealCustomer,
      primaryGoal: clean.primaryGoal,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await profileStore().setJSON(email, profile);
    return json(200, { status: "ok", profile });
  }

  return json(405, { status: "error", message: "Method not allowed" });
};

export const config: Config = { path: "/api/member-profile" };
