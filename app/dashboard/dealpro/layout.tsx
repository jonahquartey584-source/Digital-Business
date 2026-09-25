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
    </div>
  );
}
