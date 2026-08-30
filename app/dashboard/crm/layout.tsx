import Link from "next/link";
import { redirect } from "next/navigation";
import { hasActiveSubscription } from "@/lib/subscription";

export const dynamic = "force-dynamic";

const tabs = [
  { href: "/dashboard/crm", label: "Pipeline", exact: true },
  { href: "/dashboard/crm/contacts", label: "Contacts" },
  { href: "/dashboard/crm/companies", label: "Companies" },
];

export default async function CrmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const allowed = await hasActiveSubscription("crm");
  if (!allowed) redirect("/dashboard/billing?upgrade=crm");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">CRM</h1>
      </div>
      <div className="mb-6 flex gap-2 border-b border-slate-200">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="rounded-t-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            {tab.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
