"use client";

import { useActionState } from "react";
import { setPasswordAction } from "@/lib/auth-actions";
import { SubmitButton } from "@/components/submit-button";

export function SetPasswordForm() {
  const [state, formAction] = useActionState(setPasswordAction, { error: null });

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label className="label" htmlFor="password">New password</label>
        <input
          className="input"
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Confirm password</label>
        <input
          className="input"
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>

      {state.error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {state.error}
        </p>
      )}

      <SubmitButton pendingText="Saving…">Set password &amp; continue</SubmitButton>
    </form>
  );
}
