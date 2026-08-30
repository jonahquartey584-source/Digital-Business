import Link from "next/link";
import { PRODUCTS } from "@/lib/stripe";
import { hasActiveSubscription } from "@/lib/subscription";

export const dynamic = "force-dynamic";

export default async function DashboardOverviewPage() {
  const crmActive = await hasActiveSubscription("crm");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>
      <p className="mt-1 text-sm text-slate-600">
        Your Qp Digital services, in one place.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              {PRODUCTS.crm.name}
            </h2>
            {crmActive ? (
              <span className="badge bg-emerald-50 text-emerald-700">Active</span>
            ) : (
              <span className="badge bg-slate-100 text-slate-600">Not subscribed</span>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-600">{PRODUCTS.crm.description}</p>
          <Link
            href={crmActive ? "/dashboard/crm" : "/dashboard/billing?upgrade=crm"}
            className="btn-primary mt-6 w-full"
          >
            {crmActive ? "Open CRM" : "Subscribe to CRM"}
          </Link>
        </div>

        <div className="card p-6 opacity-70">
          <h2 className="text-lg font-semibold text-slate-900">More services</h2>
          <p className="mt-2 text-sm text-slate-600">
            Invoicing, scheduling, and more are on the way. New services
            appear here as soon as they launch.
          </p>
          <span className="badge bg-slate-100 text-slate-600 mt-6 inline-flex">
            Coming soon
          </span>
        </div>
      </div>
    </div>
  );
}
