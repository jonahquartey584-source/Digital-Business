import { MarketingNav } from "@/components/marketing-nav";
import { PRODUCTS, type ProductSlug } from "@/lib/stripe";

export const dynamic = "force-dynamic";

function PricingCard({ slug }: { slug: ProductSlug }) {
  const product = PRODUCTS[slug];
  return (
    <div className="card flex flex-col p-8">
      <h2 className="font-display text-lg font-bold text-cream">{product.name}</h2>
      <p className="mt-2 text-sm text-cream-dim">{product.description}</p>
      <p className="mt-6 font-display text-3xl font-bold text-gold-300">
        {product.priceLabel}
      </p>
      <ul className="mt-6 flex-1 space-y-2 text-sm text-cream-dim">
        {product.features.map((feature) => (
          <li key={feature}>✓ {feature}</li>
        ))}
      </ul>
      {/* Works whether you're signed in or not — /api/stripe/checkout
          attaches to your account if you're logged in, or collects your
          email at checkout and creates one automatically once you pay. */}
      <form action="/api/stripe/checkout" method="POST" className="mt-8">
        <input type="hidden" name="product" value={slug} />
        <button type="submit" className="btn-primary w-full">
          Subscribe to {product.name}
        </button>
      </form>
    </div>
  );
}

export default function PricingPage() {
  return (
    <>
      <MarketingNav />
      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-center font-display text-3xl font-bold text-cream">
          Simple, per-service pricing
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-cream-dim">
          No account needed up front — subscribe below and we&apos;ll set one
          up for you automatically. Already have an account? Log in first
          and it subscribes on your existing account instead.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          <PricingCard slug="crm" />
          <PricingCard slug="voice" />
          <PricingCard slug="booking" />
        </div>

        <div className="card mt-6 flex flex-col p-8 opacity-60">
          <h2 className="font-display text-lg font-bold text-cream">More services</h2>
          <p className="mt-2 text-sm text-cream-dim">
            Invoicing and marketing tools are on the roadmap — each will be
            its own subscription, priced separately.
          </p>
          <p className="mt-6 font-mono text-xs uppercase tracking-wider text-cream-dim">
            Coming soon
          </p>
        </div>
      </main>
    </>
  );
}
