import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import { CREDIT_COSTS, type CreditAction } from "@/lib/dealpro/model";

/**
 * Credits included with a Deal Pro subscription each calendar month (UTC).
 * Live number-crunching is free; only AI tasks spend credits (see
 * CREDIT_COSTS in lib/dealpro/model.ts). This exists to put a ceiling on
 * the platform's Anthropic API spend per subscriber.
 */
export const MONTHLY_CREDITS = 200;

export interface CreditBalance {
  allowance: number;
  used: number;
  remaining: number;
  unlimited: boolean;
  resetsOn: string; // ISO date of the next reset
}

function monthStart(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export async function getCreditBalance(supabase: SupabaseClient, user: User): Promise<CreditBalance> {
  const start = monthStart();
  const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const { data } = await supabase
    .from("dealpro_credit_usage")
    .select("credits")
    .eq("owner_id", user.id)
    .gte("created_at", start.toISOString());
  const used = ((data as { credits: number }[] | null) ?? []).reduce((s, r) => s + r.credits, 0);
  const unlimited = isAdminEmail(user.email);
  return {
    allowance: MONTHLY_CREDITS,
    used,
    remaining: unlimited ? Infinity : Math.max(0, MONTHLY_CREDITS - used),
    unlimited,
    resetsOn: next.toISOString(),
  };
}

export class NotEnoughCreditsError extends Error {
  constructor(needed: number) {
    super(
      `This needs ${needed} credit${needed === 1 ? "" : "s"} and you don't have enough left this month. Credits reset on the 1st.`
    );
  }
}

/**
 * Atomically checks the balance and records the spend, before the work
 * runs (supabase/migrations/0007_dealpro_hardening.sql). Goes through the
 * service role: users can read their ledger but never write to it. Pair
 * every call with refundCredits() if the work then fails, so failures
 * are never charged.
 */
export async function reserveCredits(user: User, action: CreditAction, dealId: string | null): Promise<string> {
  const needed = CREDIT_COSTS[action];
  const { data, error } = await createAdminClient().rpc("dealpro_spend_credits", {
    p_user: user.id,
    p_deal: dealId,
    p_action: action,
    p_credits: needed,
    p_allowance: isAdminEmail(user.email) ? null : MONTHLY_CREDITS,
  });
  if (error) {
    if (error.message.includes("insufficient_credits")) throw new NotEnoughCreditsError(needed);
    throw new Error("Couldn't check your credits. Please try again.");
  }
  return data as string;
}

export async function refundCredits(reservationId: string) {
  await createAdminClient().rpc("dealpro_refund_credits", { p_id: reservationId });
}
