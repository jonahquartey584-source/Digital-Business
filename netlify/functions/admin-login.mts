// Admin login: exchanges an email + password + the answer to a personal
// security question for a short-lived session token. admin.html gates the
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
import { createSessionToken, json, safeEqual } from "./_shared.mts";

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
  const securityAnswer = Netlify.env.get("ADMIN_SECURITY_ANSWER") ?? "";
  const sessionSecret = Netlify.env.get("ADMIN_SESSION_SECRET") ?? "";

  if (!email || !password || !securityAnswer || !sessionSecret) {
    return json(500, {
      status: "error",
      message: "Admin login isn't configured yet — set ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_SECURITY_ANSWER and ADMIN_SESSION_SECRET",
    });
  }

  const emailOk = safeEqual(normalize(email), normalize(String(input.email ?? "")));
  const passwordOk = safeEqual(password, String(input.password ?? ""));
  const answerOk = safeEqual(normalize(securityAnswer), normalize(String(input.securityAnswer ?? "")));

  if (!emailOk || !passwordOk || !answerOk) {
    return json(401, { status: "error", message: "Wrong email, password, or answer" });
  }

  return json(200, { status: "ok", token: createSessionToken(sessionSecret) });
};

export const config: Config = {
  path: "/api/admin_login.php",
};
