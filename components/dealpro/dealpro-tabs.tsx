"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard/dealpro/credits", label: "Credits" },
  // Everything else under /dashboard/dealpro is a deal, so "My deals" is
  // the catch-all tab.
  { href: "/dashboard/dealpro", label: "My deals" },
];

export function DealProTabs() {
  const pathname = usePathname();
  const activeHref = tabs.find((t) => pathname.startsWith(t.href))?.href;

  return (
    <div className="mb-6 flex gap-2 overflow-x-auto border-b border-ink-border">
      {[...tabs].reverse().map((tab) => {
        const active = tab.href === activeHref;
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
