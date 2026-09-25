import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCreditBalance } from "@/lib/dealpro/credits";
import { CREDIT_COSTS } from "@/lib/dealpro/model";
import { SectionHeading, Stat, StatStrip } from "@/components/dealpro/ui";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  import: "Advert import",
  research: "AI due diligence research",
  pack: "Final deal pack",
};

interface UsageRow {
  id: string;
  action: string;
  credits: number;
  created_at: string;
  dealpro_deals: { name: string } | null;
}

export default async function CreditsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [balance, { data: usage }] = await Promise.all([
    getCreditBalance(supabase, user),
    supabase
      .from("dealpro_credit_usage")
      .select("id, action, credits, created_at, dealpro_deals(name)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const rows = (usage as unknown as UsageRow[]) ?? [];
  const resets = new Date(balance.resetsOn).toLocaleDateString("en-GB", { day: "numeric", month: "long" });

  return (
    <div className="space-y-8">
      <StatStrip cols={2}>
        <Stat
          label="Credits left this month"
          value={balance.unlimited ? "Unlimited" : balance.remaining}
          sub={balance.unlimited ? "Admin account" : `of ${balance.allowance}, resets ${resets}`}
        />
        <Stat label="Used this month" value={balance.used} sub="Across all deals" />
      </StatStrip>

      <section>
        <SectionHeading title="What credits pay for" />
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-border text-left text-xs text-cream-dim">
                <th className="px-4 py-2 font-medium">Task</th>
                <th className="px-4 py-2 text-right font-medium">Credits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-border text-cream">
              <tr>
                <td className="px-4 py-2">Deal numbers, sensitivity, break-even, 90-night check, Deal Notice</td>
                <td className="px-4 py-2 text-right font-mono">Free</td>
              </tr>
              <tr>
                <td className="px-4 py-2">Import a unit from an advert</td>
                <td className="px-4 py-2 text-right font-mono">{CREDIT_COSTS.import}</td>
              </tr>
              <tr>
                <td className="px-4 py-2">Final deal pack (once per deal)</td>
                <td className="px-4 py-2 text-right font-mono">{CREDIT_COSTS.pack}</td>
              </tr>
              <tr>
                <td className="px-4 py-2">AI due diligence research (per run)</td>
                <td className="px-4 py-2 text-right font-mono">{CREDIT_COSTS.research}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionHeading title="Recent usage" />
        {rows.length === 0 ? (
          <p className="text-sm text-cream-dim">No credits used yet.</p>
        ) : (
          <div className="card divide-y divide-ink-border">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="text-cream">{ACTION_LABEL[r.action] ?? r.action}</p>
                  <p className="truncate text-xs text-cream-dim">
                    {r.dealpro_deals?.name ?? "Deleted deal"} ·{" "}
                    {new Date(r.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <span className="font-mono text-cream-dim">−{r.credits}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
