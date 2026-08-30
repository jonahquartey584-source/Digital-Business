/**
 * Business-owner "admin" accounts — full access to every paid service
 * regardless of Stripe subscription status, for the platform operator's
 * own use. Not a customer-facing role and not a multi-tenant admin panel
 * (an admin still only ever sees their own CRM/AI Reception/Booking data,
 * same as any other account — this only bypasses the paywall).
 *
 * Configure via the ADMIN_EMAILS env var: a comma-separated list of email
 * addresses, e.g. "you@example.com,cofounder@example.com".
 */
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email || ADMIN_EMAILS.length === 0) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
