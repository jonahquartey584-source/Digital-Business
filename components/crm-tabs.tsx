"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard/crm", label: "Dashboard", exact: true },
  { href: "/dashboard/crm/pipeline", label: "Pipeline" },
  { href: "/dashboard/crm/leads", label: "Leads Database" },
  { href: "/dashboard/crm/contacts", label: "Contacts" },
  { href: "/dashboard/crm/companies", label: "Companies" },
  { href: "/dashboard/crm/tasks", label: "Tasks & Follow-ups" },
  { href: "/dashboard/crm/reporting", label: "Reporting" },
  { href: "/dashboard/crm/import", label: "Import History" },
];

export function CrmTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex gap-2 overflow-x-auto border-b border-ink-border">
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`nav-link shrink-0 whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2 ${
              active
                ? "border-gold-400 text-gold-300"
                : "border-transparent hover:bg-white/5"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
