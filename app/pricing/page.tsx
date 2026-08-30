import Link from "next/link";
import { MarketingNav } from "@/components/marketing-nav";
import { PRODUCTS } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <MarketingNav />
      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-center text-3xl font-bold text-slate-900">
          Simple, per-service pricing
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">
          A Qp Digital account is free. Subscribe to the services you need —
          upgrade, downgrade, or cancel anytime from your billing page.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <div className="card flex flex-col p-8">
            <h2 className="text-lg font-semibold text-slate-900">
              {PRODUCTS.crm.name}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {PRODUCTS.crm.description}
            </p>
            <p className="mt-6 text-3xl font-bold text-slate-900">
              {PRODUCTS.crm.priceLabel}
            </p>
            <ul className="mt-6 flex-1 space-y-2 text-sm text-slate-600">
              <li>✓ Unlimited contacts &amp; companies</li>
              <li>✓ Deal pipeline with stages</li>
              <li>✓ Activity notes &amp; timeline</li>
              <li>✓ Access on web and the Qp Digital app</li>
            </ul>
            {user ? (
              <form action="/api/stripe/checkout" method="POST" className="mt-8">
                <input type="hidden" name="product" value="crm" />
                <button type="submit" className="btn-primary w-full">
                  Subscribe to CRM
                </button>
              </form>
            ) : (
              <Link href="/signup?next=/pricing" className="btn-primary mt-8 w-full">
                Create an account to subscribe
              </Link>
            )}
          </div>

          <div className="card flex flex-col p-8 opacity-70">
            <h2 className="text-lg font-semibold text-slate-900">
              More services
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Invoicing, scheduling, and marketing tools are on the roadmap —
              each will be its own subscription, priced separately.
            </p>
            <p className="mt-6 text-sm font-medium text-slate-500">
              Coming soon
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
