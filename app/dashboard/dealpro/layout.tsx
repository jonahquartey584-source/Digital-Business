import Link from "next/link";
import { redirect } from "next/navigation";
import { hasActiveSubscription } from "@/lib/subscription";
import { DealProTabs } from "@/components/dealpro/dealpro-tabs";

export const dynamic = "force-dynamic";

export default async function DealProLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const allowed = await hasActiveSubscription("dealpro");
  if (!allowed) redirect("/dashboard/billing?upgrade=dealpro");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-cream">Deal Pro</h1>
      </div>
      <DealProTabs />
      {children}
      <p className="mt-10 border-t border-ink-border pt-4 text-xs text-cream-dim print:hidden">
        Figures are illustrative models of the numbers you enter, not forecasts or financial, legal or planning advice.
        AI findings are drafts to verify. You are responsible for your own property-sourcing compliance (redress
        scheme, AML supervision, planning and licensing). See the{" "}
        <Link href="/terms" className="text-gold-300 hover:underline">Terms</Link>.
      </p>
    </div>
  );
}
