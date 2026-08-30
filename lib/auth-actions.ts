"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { REMEMBER_COOKIE } from "@/lib/supabase/remember";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type AuthFormState = { error: string | null; message?: string | null };

const NOT_CONFIGURED_ERROR =
  "Accounts aren't set up yet on this deployment — check back soon.";

export async function signUpAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  if (!isSupabaseConfigured) return { error: NOT_CONFIGURED_ERROR };

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const companyName = String(formData.get("company_name") ?? "").trim();

  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, company_name: companyName },
      emailRedirectTo:
        `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/callback`,
    },
  });

  if (error) return { error: error.message };

  // If email confirmation is enabled on the Supabase project, signUp()
  // succeeds but returns no session — the user isn't signed in yet, so
  // don't redirect into the protected dashboard (middleware would just
  // bounce them back to /login). Tell them to check their inbox instead.
  if (!data.session) {
    return {
      error: null,
      message: "Check your email to confirm your account, then log in.",
    };
  }

  redirect("/dashboard?welcome=1");
}

export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  if (!isSupabaseConfigured) return { error: NOT_CONFIGURED_ERROR };

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const remember = formData.get("remember") === "on";

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  // Marker read by every later createClient() call (including the auth
  // middleware's own session refresh) so "don't persist" sticks for the
  // whole session, not just this response. "1"/absent = persist normally.
  const cookieStore = await cookies();
  if (remember) {
    cookieStore.delete(REMEMBER_COOKIE);
  } else {
    cookieStore.set(REMEMBER_COOKIE, "0", { httpOnly: true, sameSite: "lax" });
  }

  // persist: false makes the auth cookies session-only (cleared when the
  // browser closes) instead of Supabase's normal multi-day persistent
  // cookies — that's the entire difference "Remember me" makes.
  const supabase = await createClient({ persist: remember });
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return { error: error.message };

  redirect("/dashboard");
}

export async function signOutAction() {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
