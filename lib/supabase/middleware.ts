import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { REMEMBER_COOKIE } from "@/lib/supabase/remember";

/**
 * Refreshes the Supabase auth session on every request and returns both the
 * (possibly redirected) response and the resolved user, so middleware.ts can
 * make routing decisions without a second round trip.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Without real credentials there's nothing to check — skip the network
  // call entirely rather than hitting a placeholder domain on every request.
  if (!isSupabaseConfigured) {
    return { response, user: null };
  }

  const persist = request.cookies.get(REMEMBER_COOKIE)?.value !== "0";

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              // Keep honoring "Remember me: off" on every session refresh,
              // not just the login response — otherwise the very next
              // request silently upgrades the cookie back to persistent.
              ...(persist ? null : { maxAge: undefined, expires: undefined }),
            })
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
