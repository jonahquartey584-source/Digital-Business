import Link from "next/link";
import { PRODUCTS, type ProductSlug } from "@/lib/stripe";
import { getSubscriptions } from "@/lib/subscription";
import { hasProvisionedVoiceNumber } from "@/lib/voice/status";
import type { Subscription } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  unpaid: "Unpaid",
  incomplete: "Incomplete",
  incomplete_expired: "Expired",
  paused: "Paused",
};

function ProductBillingCard({
  slug,
  subscription,
}: {
  slug: ProductSlug;
  subscription: Subscription | undefined;
}) {
  const product = PRODUCTS[slug];
  const active = subscription && ["active", "trialing"].includes(subscription.status);

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-cream">{product.name}</h2>
          <p className="mt-1 text-sm text-cream-dim">{product.description}</p>
          {subscription && (
            <p className="mt-2 text-xs text-cream-dim/70">
              Status: {STATUS_LABEL[subscription.status] ?? subscription.status}
              {subscription.current_period_end &&
                ` · Renews ${new Date(subscription.current_period_end).toLocaleDateString()}`}
              {subscription.cancel_at_period_end && " · Cancels at period end"}
            </p>
          )}
        </div>

        {active ? (
          <form action="/api/stripe/portal" method="POST">
            <button type="submit" className="btn-secondary">
              Manage subscription
            </button>
          </form>
        ) : (
          <form action="/api/stripe/checkout" method="POST">
            <input type="hidden" name="product" value={slug} />
            <button type="submit" className="btn-primary">
              Subscribe — {product.priceLabel}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string; success?: string }>;
}) {
  const sp = await searchParams;
  const [subscriptions, voiceProvisioned] = await Promise.all([
    getSubscriptions(),
    hasProvisionedVoiceNumber(),
  ]);
  const slugs = Object.keys(PRODUCTS) as ProductSlug[];
  const upgradeSlug = slugs.includes(sp.upgrade as ProductSlug)
    ? (sp.upgrade as ProductSlug)
    : null;
  const upgradeSub = upgradeSlug && subscriptions.find((s) => s.product === upgradeSlug);
  const upgradeActive = upgradeSub && ["active", "trialing"].includes(upgradeSub.status);

  const voiceSub = subscriptions.find((s) => s.product === "voice");
  const voiceActive = voiceSub && ["active", "trialing"].includes(voiceSub.status);
  const voiceNeedsSetup = voiceActive && !voiceProvisioned;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-cream">Billing</h1>
      <p className="mt-1 text-sm text-cream-dim">
        Manage which Qp Digital services you&apos;re subscribed to.
      </p>

      {sp.success && (
        <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          Subscription updated. It may take a few seconds to appear below.
        </p>
      )}
      {voiceNeedsSetup && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold-600/40 bg-gold-500/10 px-4 py-3">
          <p className="text-sm text-gold-300">
            You&apos;re subscribed to AI Reception — connect a number to
            start taking calls.
          </p>
          <Link href="/dashboard/voice" className="btn-primary shrink-0 text-xs">
            Set up AI automation
          </Link>
        </div>
      )}
      {upgradeSlug && !upgradeActive && (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          Subscribe to {PRODUCTS[upgradeSlug].name} below to unlock that part
          of your dashboard.
        </p>
      )}

      <div className="mt-8 space-y-6">
        {slugs.map((slug) => (
          <ProductBillingCard
            key={slug}
            slug={slug}
            subscription={subscriptions.find((s) => s.product === slug)}
          />
        ))}
      </div>
    </div>
  );
}
