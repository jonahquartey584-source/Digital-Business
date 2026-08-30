import Link from "next/link";
import { MarketingNav } from "@/components/marketing-nav";
import { BackgroundDots } from "@/components/background-dots";
import { PRODUCTS } from "@/lib/stripe";

export default function HomePage() {
  return (
    <>
      <MarketingNav />

      <main>
        <section className="relative overflow-hidden">
          <BackgroundDots />
          <div className="relative mx-auto max-w-6xl px-6 py-24 text-center">
            <p className="font-mono text-xs uppercase tracking-wider text-gold-400">
              $ Subscription tools for growing businesses
            </p>
            <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-bold tracking-tight text-cream sm:text-5xl">
              One account. Every business tool you pay for, none you don&apos;t.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-cream-dim">
              Qp Digital is a subscription platform for growing businesses.
              Create your account for free, then subscribe to just the services
              you need — starting with a full-featured CRM — on the web or from
              the Qp Digital app.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Link href="/signup" className="btn-primary px-6 py-3 text-sm">
                Create your free account
              </Link>
              <Link href="/pricing" className="btn-secondary px-6 py-3 text-sm">
                See pricing
              </Link>
            </div>
          </div>
        </section>

        <section className="border-t border-ink-border bg-ink-soft py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center font-display text-2xl font-bold text-cream">
              Services
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-cream-dim">
              Your account gives you access to Qp Digital. Subscribe to the
              individual services your business needs — cancel anytime.
            </p>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="card p-6">
                <p className="badge-success">Available now</p>
                <h3 className="mt-3 font-display text-lg font-bold text-cream">
                  {PRODUCTS.crm.name}
                </h3>
                <p className="mt-2 text-sm text-cream-dim">
                  {PRODUCTS.crm.description}
                </p>
                <p className="mt-4 text-sm font-medium text-gold-300">
                  {PRODUCTS.crm.priceLabel}
                </p>
              </div>

              <div className="card p-6">
                <p className="badge-success">Available now</p>
                <h3 className="mt-3 font-display text-lg font-bold text-cream">
                  {PRODUCTS.voice.name}
                </h3>
                <p className="mt-2 text-sm text-cream-dim">
                  {PRODUCTS.voice.description}
                </p>
                <p className="mt-4 text-sm font-medium text-gold-300">
                  {PRODUCTS.voice.priceLabel}
                </p>
              </div>

              <div className="card p-6 opacity-60">
                <p className="badge-neutral">Coming soon</p>
                <h3 className="mt-3 font-display text-lg font-bold text-cream">
                  Invoicing
                </h3>
                <p className="mt-2 text-sm text-cream-dim">
                  Send invoices and track payments from your CRM contacts.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="font-display text-2xl font-bold text-cream">
            Also available as an app
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-cream-dim">
            The same account and data, wrapped as a native app for iOS and
            Android — manage your CRM from your phone.
          </p>
        </section>
      </main>

      <footer className="border-t border-ink-border bg-ink-soft py-10">
        <div className="mx-auto max-w-6xl px-6 text-center font-mono text-xs uppercase tracking-wider text-cream-dim">
          © {new Date().getFullYear()} Qp Digital. All rights reserved.
        </div>
      </footer>
    </>
  );
}
