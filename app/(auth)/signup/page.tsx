"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUpAction } from "@/lib/auth-actions";
import { SubmitButton } from "@/components/submit-button";

export default function SignUpPage() {
  const [state, formAction] = useActionState(signUpAction, {
    error: null,
    message: null,
  });

  return (
    <>
      <h1 className="font-display text-xl font-bold text-cream">Create your account</h1>
      <p className="mt-1 text-sm text-cream-dim">
        Free to join. Subscribe to services like CRM when you&apos;re ready.
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="full_name">Full name</label>
          <input className="input" id="full_name" name="full_name" type="text" autoComplete="name" required />
        </div>
        <div>
          <label className="label" htmlFor="company_name">Company name</label>
          <input className="input" id="company_name" name="company_name" type="text" autoComplete="organization" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </div>

        {state.error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{state.error}</p>
        )}
        {state.message && (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
            {state.message}
          </p>
        )}

        <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-cream-dim">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-gold-300 hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
