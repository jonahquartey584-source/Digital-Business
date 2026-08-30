import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { LogoWordmark } from "@/components/logo-wordmark";
import { SetPasswordForm } from "@/components/set-password-form";

export const dynamic = "force-dynamic";

export default async function SetPasswordPage() {
  if (!isSupabaseConfigured) redirect("/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="mx-auto inline-flex w-fit">
            <LogoWordmark />
          </Link>
        </div>
        <div className="card p-8">
          <h1 className="font-display text-xl font-bold text-cream">
            Welcome to Qp Digital
          </h1>
          <p className="mt-1 text-sm text-cream-dim">
            Your account for <span className="text-cream">{user.email}</span> is
            ready — set a password so you can log back in.
          </p>
          <SetPasswordForm />
        </div>
      </div>
    </main>
  );
}
