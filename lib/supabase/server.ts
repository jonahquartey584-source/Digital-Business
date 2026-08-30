import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { REMEMBER_COOKIE } from "@/lib/supabase/remember";

/**
 * Supabase client for use in Server Components, Server Actions, and Route
 * Handlers. Reads/writes the auth cookies via next/headers.
 *
 * `cookies()` is async as of Next.js 15+, so this is async too — every
 * caller must `await createClient()`.
 *
 * `persist` controls whether auth cookies get Supabase's normal multi-day
 * expiry, or are stripped down to session-only (cleared when the browser
 * closes). Defaults to whatever REMEMBER_COOKIE says, so once login sets
 * that marker, every later call — including the middleware's own session
 * refresh — keeps honoring it without having to pass `persist` around
 * everywhere.
 */
export async function createClient(opts: { persist?: boolean } = {}) {
  const cookieStore = await cookies();
  const persist = opts.persist ?? cookieStore.get(REMEMBER_COOKIE)?.value !== "0";

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                ...(persist ? null : { maxAge: undefined, expires: undefined }),
              })
            );
          } catch {
            // Called from a Server Component with no request context to
            // write to — safe to ignore because middleware refreshes the
            // session on every navigation.
          }
        },
      },
    }
  );
}

/**
 * Admin client using the service role key. Bypasses Row Level Security —
 * only ever use this on the server, and only for trusted operations like
 * the Stripe webhook writing subscription status.
 */
export function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // no-op: admin client is not tied to a browser session
        },
      },
    }
  );
}
