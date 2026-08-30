import Link from "next/link";
import { PRODUCTS, type ProductSlug } from "@/lib/stripe";
import { hasActiveSubscription } from "@/lib/subscription";
import { hasProvisionedVoiceNumber } from "@/lib/voice/status";

export const dynamic = "force-dynamic";

const SERVICE_HREF: Record<ProductSlug, string> = {
  crm: "/dashboard/crm",
  voice: "/dashboard/voice",
};

export default async function DashboardOverviewPage() {
  const slugs = Object.keys(PRODUCTS) as ProductSlug[];
  const [activity, voiceProvisioned] = await Promise.all([
    Promise.all(slugs.map((slug) => hasActiveSubscription(slug))),
    hasProvisionedVoiceNumber(),
  ]);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-cream">Overview</h1>
      <p className="mt-1 text-sm text-cream-dim">
        Your Qp Digital services, in one place.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {slugs.map((slug, i) => {
          const product = PRODUCTS[slug];
          const active = activity[i];
          // AI Reception needs one more step after paying — connecting a
          // number — before there's anything to "open".
          const needsSetup = slug === "voice" && active && !voiceProvisioned;

          return (
            <div key={slug} className="card p-6">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display text-lg font-bold text-cream">
                  {product.name}
                </h2>
                {needsSetup ? (
                  <span className="badge-gold">Setup needed</span>
                ) : active ? (
                  <span className="badge-success">Active</span>
                ) : (
                  <span className="badge-neutral">Not subscribed</span>
                )}
              </div>
              <p className="mt-2 text-sm text-cream-dim">{product.description}</p>
              <Link
                href={active ? SERVICE_HREF[slug] : `/dashboard/billing?upgrade=${slug}`}
                className="btn-primary mt-6 w-full"
              >
                {needsSetup
                  ? "Set up AI automation"
                  : active
                    ? `Open ${product.name}`
                    : `Subscribe to ${product.name}`}
              </Link>
            </div>
          );
        })}

        <div className="card p-6 opacity-60">
          <h2 className="font-display text-lg font-bold text-cream">More services</h2>
          <p className="mt-2 text-sm text-cream-dim">
            Invoicing, scheduling, and more are on the way. New services
            appear here as soon as they launch.
          </p>
          <span className="badge-neutral mt-6 inline-flex">
            Coming soon
          </span>
        </div>
      </div>
    </div>
  );
}
