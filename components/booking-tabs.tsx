"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard/booking", label: "Settings", exact: true },
  { href: "/dashboard/booking/appointments", label: "Appointments" },
];

export function BookingTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex gap-2 border-b border-ink-border">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`nav-link rounded-t-lg border-b-2 px-3 py-2 ${
              active ? "border-gold-400 text-gold-300" : "border-transparent hover:bg-white/5"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
