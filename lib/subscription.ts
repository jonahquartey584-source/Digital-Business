import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { ProductSlug } from "@/lib/stripe";
import type { Subscription } from "@/lib/supabase/types";

const ACTIVE_STATUSES = new Set(["trialing", "active"]);

/**
 * Returns whether the currently signed-in user has an active (or trialing)
 * subscription to the given product/service.
 */
export async function hasActiveSubscription(
  product: ProductSlug
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", user.id)
    .eq("product", product)
    .maybeSingle<Pick<Subscription, "status">>();

  return !!data && ACTIVE_STATUSES.has(data.status);
}

export async function getSubscriptions(): Promise<Subscription[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id);

  return (data as Subscription[]) ?? [];
}
