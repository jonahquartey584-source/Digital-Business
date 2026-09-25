import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

// Handles the redirect from Supabase email confirmation / magic links.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code && isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next}`);
}

/**
 * Only same-site paths. Without this, `?next=@evil.com` would produce
 * `https://oursite@evil.com` (an open redirect to an attacker's page right
 * after a real login), and `//evil.com` or `/\evil.com` are
 * protocol-relative to another host.
 */
function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/dashboard";
  }
  return next;
}
