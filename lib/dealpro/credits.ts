import type { SupabaseClient, User } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/admin";
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
  constructor(needed: number, remaining: number) {
    super(
      `This needs ${needed} credit${needed === 1 ? "" : "s"} and you have ${remaining} left this month. Credits reset on the 1st.`
    );
  }
}

/** Throws NotEnoughCreditsError if the user can't afford `action`. Call before doing the work. */
export async function assertCredits(supabase: SupabaseClient, user: User, action: CreditAction) {
  const balance = await getCreditBalance(supabase, user);
  const needed = CREDIT_COSTS[action];
  if (balance.remaining < needed) throw new NotEnoughCreditsError(needed, balance.remaining);
}

/** Records the spend. Call only after the work succeeded, so failures are never charged. */
export async function recordCredits(
  supabase: SupabaseClient,
  user: User,
  action: CreditAction,
  dealId: string | null
) {
  await supabase.from("dealpro_credit_usage").insert({
    owner_id: user.id,
    deal_id: dealId,
    action,
    credits: CREDIT_COSTS[action],
  });
}
