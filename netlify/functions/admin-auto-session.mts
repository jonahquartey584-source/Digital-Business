// Auto-login for the site owner. members.html's "Administrator" tab
// normally needs its own email + password, separate from the Netlify
// Identity password a member (including the owner) already signs in with.
// This endpoint removes that second prompt: if the Netlify Identity user
// already authenticated in this browser (via the ordinary Member "Password
// login" form) is ADMIN_EMAIL, it hands back a normal admin session token —
// the exact same kind admin-login.mts issues — with no password re-entry.
//
// Anyone who isn't signed in as ADMIN_EMAIL just gets a 403; nothing here
// grants more than admin-login.mts already would for that one address, it
// just skips asking for the password again once Identity has already
// proven who they are.

import type { Config, Context } from "@netlify/functions";
import { getUser } from "@netlify/identity";
import { createSessionToken, json, REMEMBERED_SESSION_TTL_SECONDS } from "./_shared.mts";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export default async (_req: Request, _context: Context) => {
  const adminEmail = Netlify.env.get("ADMIN_EMAIL") ?? "";
  const sessionSecret = Netlify.env.get("ADMIN_SESSION_SECRET") ?? "";

  if (!adminEmail || !sessionSecret) {
    return json(500, { status: "error", message: "Admin login isn't configured yet." });
  }

  const user = await getUser().catch(() => null);
  if (!user?.email || normalize(user.email) !== normalize(adminEmail)) {
    return json(403, { status: "error", message: "Not the administrator account." });
  }

  return json(200, {
    status: "ok",
    token: createSessionToken(sessionSecret, REMEMBERED_SESSION_TTL_SECONDS),
    email: user.email,
  });
};

export const config: Config = {
  path: "/api/admin_auto_session.php",
};
