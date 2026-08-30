// Admin login: exchanges an email + password for a short-lived session token. admin.html gates the
// New Client Setup tool behind this — log in once, then the tool attaches
// the returned token as `Authorization: Bearer <token>` to every
// create-client/upload call instead of asking for a password on each one.
//
// All three factors are checked before reporting anything, and the error
// never says which one was wrong — just "wrong email, password, or answer"
// either way, so a wrong guess can't be used to narrow down which factor
// failed. Netlify-hosted equivalent of api/admin_login.php.
//
// Note for whoever's debugging a stray "isn't configured yet" error even
// after setting all four environment variables: Netlify Functions read
// their environment at deploy time, not live — a var set via the API/UI
// after the last deploy won't be visible until the next one. Trigger a
// redeploy (or just push again) after changing any of these.

import type { Config, Context } from "@netlify/functions";
import { createSessionToken, json, REMEMBERED_SESSION_TTL_SECONDS, safeEqual, SESSION_TTL_SECONDS } from "./_shared.mts";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return json(405, { status: "error", message: "Method not allowed" });
  }

  const input = await req.json().catch(() => ({}) as Record<string, unknown>);

  const email = Netlify.env.get("ADMIN_EMAIL") ?? "";
  const password = Netlify.env.get("ADMIN_PASSWORD") ?? "";
  const sessionSecret = Netlify.env.get("ADMIN_SESSION_SECRET") ?? "";

  if (!email || !password || !sessionSecret) {
    return json(500, {
      status: "error",
      message: "Admin login isn't configured yet.",
    });
  }

  const emailOk = safeEqual(normalize(email), normalize(String(input.email ?? "")));
  const passwordOk = safeEqual(password, String(input.password ?? ""));
  if (!emailOk || !passwordOk) {
    return json(401, { status: "error", message: "Wrong email or password" });
  }

  const ttlSeconds = input.remember ? REMEMBERED_SESSION_TTL_SECONDS : SESSION_TTL_SECONDS;
  return json(200, { status: "ok", token: createSessionToken(sessionSecret, ttlSeconds) });
};

export const config: Config = {
  path: "/api/admin_login.php",
};
