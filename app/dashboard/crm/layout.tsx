import { redirect } from "next/navigation";
import { hasActiveSubscription } from "@/lib/subscription";
import { CrmTabs } from "@/components/crm-tabs";

export const dynamic = "force-dynamic";

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
        <h1 className="font-display text-2xl font-bold text-cream">CRM</h1>
      </div>
      <CrmTabs />
      {children}
    </div>
  );
}
