import { PRODUCTS } from "@/lib/stripe";
import { getSubscriptions } from "@/lib/subscription";

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

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string; success?: string }>;
}) {
  const sp = await searchParams;
  const subscriptions = await getSubscriptions();
  const crmSub = subscriptions.find((s) => s.product === "crm");
  const crmActive = crmSub && ["active", "trialing"].includes(crmSub.status);

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
      {sp.upgrade === "crm" && !crmActive && (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          Subscribe to CRM below to unlock that part of your dashboard.
        </p>
      )}

      <div className="mt-8 card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-cream">
              {PRODUCTS.crm.name}
            </h2>
            <p className="mt-1 text-sm text-cream-dim">
              {PRODUCTS.crm.description}
            </p>
            {crmSub && (
              <p className="mt-2 text-xs text-cream-dim/70">
                Status: {STATUS_LABEL[crmSub.status] ?? crmSub.status}
                {crmSub.current_period_end &&
                  ` · Renews ${new Date(
                    crmSub.current_period_end
                  ).toLocaleDateString()}`}
                {crmSub.cancel_at_period_end && " · Cancels at period end"}
              </p>
            )}
          </div>

          {crmActive ? (
            <form action="/api/stripe/portal" method="POST">
              <button type="submit" className="btn-secondary">
                Manage subscription
              </button>
            </form>
          ) : (
            <form action="/api/stripe/checkout" method="POST">
              <input type="hidden" name="product" value="crm" />
              <button type="submit" className="btn-primary">
                Subscribe — {PRODUCTS.crm.priceLabel}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
