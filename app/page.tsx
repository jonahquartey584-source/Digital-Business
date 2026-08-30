import Link from "next/link";
import { MarketingNav } from "@/components/marketing-nav";
import { PRODUCTS } from "@/lib/stripe";

export default function HomePage() {
  return (
    <>
      <MarketingNav />

      <main>
        <section className="mx-auto max-w-6xl px-6 py-20 text-center">
          <p className="badge bg-brand-50 text-brand-700 mx-auto mb-6">
            Qp Digital Business Suite
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            One account. Every business tool you pay for, none you don&apos;t.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            Qp Digital is a subscription platform for growing businesses.
            Create your account for free, then subscribe to just the services
            you need — starting with a full-featured CRM — on the web or from
            the Qp Digital app.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/signup" className="btn-primary px-6 py-3 text-base">
              Create your free account
            </Link>
            <Link href="/pricing" className="btn-secondary px-6 py-3 text-base">
              See pricing
            </Link>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-white py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-2xl font-semibold text-slate-900">
              Services
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-slate-600">
              Your account gives you access to Qp Digital. Subscribe to the
              individual services your business needs — cancel anytime.
            </p>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="card p-6">
                <p className="badge bg-emerald-50 text-emerald-700">Available now</p>
                <h3 className="mt-3 text-lg font-semibold text-slate-900">
                  {PRODUCTS.crm.name}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  {PRODUCTS.crm.description}
                </p>
                <p className="mt-4 text-sm font-medium text-slate-900">
                  {PRODUCTS.crm.priceLabel}
                </p>
              </div>

              <div className="card p-6 opacity-70">
                <p className="badge bg-slate-100 text-slate-600">Coming soon</p>
                <h3 className="mt-3 text-lg font-semibold text-slate-900">
                  Invoicing
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Send invoices and track payments from your CRM contacts.
                </p>
              </div>

              <div className="card p-6 opacity-70">
                <p className="badge bg-slate-100 text-slate-600">Coming soon</p>
                <h3 className="mt-3 text-lg font-semibold text-slate-900">
                  Scheduling
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Client-facing booking pages backed by your calendar.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="text-2xl font-semibold text-slate-900">
            Also available as an app
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-slate-600">
            The same account and data, wrapped as a native app for iOS and
            Android — manage your CRM from your phone.
          </p>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} Qp Digital. All rights reserved.
        </div>
      </footer>
    </>
  );
}
