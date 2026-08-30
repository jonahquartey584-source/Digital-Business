/**
 * Whether real Supabase credentials are configured. Used to skip auth/DB
 * calls entirely (rather than firing a request at a placeholder domain and
 * waiting on it) so the site stays fast and doesn't 500 before real
 * credentials are wired up — see .env.example.
 */
export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")
);
