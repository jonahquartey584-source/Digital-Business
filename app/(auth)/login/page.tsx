"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/lib/auth-actions";
import { SubmitButton } from "@/components/submit-button";

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, {
    error: null,
    message: null,
  });

  return (
    <>
      <h1 className="font-display text-xl font-bold text-cream">Log in</h1>
      <p className="mt-1 text-sm text-cream-dim">
        Welcome back to Qp Digital.
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
        </div>

        <label className="flex items-center gap-2 text-sm text-cream-dim">
          <input
            type="checkbox"
            name="remember"
            defaultChecked
            className="h-4 w-4 rounded border-ink-border bg-ink-soft"
          />
          Remember me
        </label>

        {state.error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{state.error}</p>
        )}

        <SubmitButton pendingText="Logging in…">Log in</SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-cream-dim">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-gold-300 hover:underline">
          Sign up
        </Link>
      </p>
    </>
  );
}
