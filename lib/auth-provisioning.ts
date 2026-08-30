import { createAdminClient } from "@/lib/supabase/server";

/**
 * Finds the existing account for this email, or creates one and emails
 * them an invite to set a password — used when someone pays without
 * already having a Qp Digital account (app/api/stripe/checkout,
 * app/api/stripe/webhook). Requires supabase/migrations/0004_profiles_email.sql
 * (adds profiles.email, used here for a fast indexed lookup instead of
 * paging through every auth user).
 */
export async function resolveOrCreateUserForEmail(
  email: string,
  siteUrl: string
): Promise<string> {
  const admin = createAdminClient();
  const normalizedEmail = email.trim().toLowerCase();

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle<{ id: string }>();
  if (existing) return existing.id;

  // Creates the account AND emails them a link (Supabase's built-in auth
  // email, no separate email provider needed) that logs them in and sends
  // them to set a password — see app/auth/set-password.
  const { data, error } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
    redirectTo: `${siteUrl}/auth/callback?next=/auth/set-password`,
  });

  if (error || !data?.user) {
    // Rare race: created between our lookup and this call (e.g. two
    // payments for the same new email seconds apart). Look it up again
    // rather than fail the whole webhook.
    const { data: retry } = await admin
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle<{ id: string }>();
    if (retry) return retry.id;

    throw new Error(
      `Could not create an account for ${normalizedEmail}: ${error?.message ?? "unknown error"}`
    );
  }

  return data.user.id;
}
