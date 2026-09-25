import Link from "next/link";
import { MarketingNav } from "@/components/marketing-nav";

/**
 * The business details every legal page needs. Placeholders in [brackets]
 * must be filled in before launch — see README "Legal pages".
 */
export const LEGAL = {
  business: "Qp Digital",
  entity: "[Legal entity name, e.g. Qp Digital Ltd]",
  companyNumber: "[Company number]",
  address: "[Registered address]",
  email: "[privacy@your-domain]",
  icoNumber: "[ICO registration number]",
  updated: "25 September 2026",
};

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <MarketingNav />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-3xl font-bold text-cream">{title}</h1>
        <p className="mt-2 text-sm text-cream-dim">Last updated {LEGAL.updated}</p>
        <div className="legal mt-10 space-y-4 text-sm leading-relaxed text-cream-dim [&_a]:text-gold-300 [&_a]:underline [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-cream [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-cream">
          {children}
        </div>
      </main>
      <LegalFooter />
    </>
  );
}

export function LegalFooter() {
  return (
    <footer className="border-t border-ink-border bg-ink-soft py-10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 text-center font-mono text-xs uppercase tracking-wider text-cream-dim">
        <span>© {new Date().getFullYear()} Qp Digital. All rights reserved.</span>
        <Link href="/privacy" className="hover:text-gold-300">Privacy</Link>
        <Link href="/terms" className="hover:text-gold-300">Terms</Link>
      </div>
    </footer>
  );
}
