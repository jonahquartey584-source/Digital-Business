import { createClient } from "@/lib/supabase/server";
import type { CrmDeal, CrmLead, CrmTask, DealStage, LeadStatus } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const STAGE_LABEL: Record<DealStage, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};
const STAGE_ORDER: DealStage[] = ["lead", "qualified", "proposal", "won", "lost"];

const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  unqualified: "Unqualified",
  promoted: "Promoted",
};
const LEAD_STATUS_ORDER: LeadStatus[] = ["new", "contacted", "unqualified", "promoted"];

function money(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs uppercase tracking-wide text-cream-dim">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold text-cream">{value}</p>
      {sub && <p className="mt-1 text-xs text-cream-dim">{sub}</p>}
    </div>
  );
}

function Bar({ label, count, total, colorClass }: { label: string; count: number; total: number; colorClass: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-cream">{label}</span>
        <span className="text-cream-dim">{count}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function ReportingPage() {
  const supabase = await createClient();
  const [{ data: deals }, { data: leads }, { data: tasks }] = await Promise.all([
    supabase.from("crm_deals").select("*"),
    supabase.from("crm_leads").select("*"),
    supabase.from("crm_tasks").select("*"),
  ]);

  const dealList = (deals as CrmDeal[]) ?? [];
  const leadList = (leads as CrmLead[]) ?? [];
  const taskList = (tasks as CrmTask[]) ?? [];

  const openPipelineValue = dealList
    .filter((d) => d.stage !== "won" && d.stage !== "lost")
    .reduce((sum, d) => sum + (d.value ?? 0), 0);
  const wonValue = dealList.filter((d) => d.stage === "won").reduce((sum, d) => sum + (d.value ?? 0), 0);
  const closedCount = dealList.filter((d) => d.stage === "won" || d.stage === "lost").length;
  const wonCount = dealList.filter((d) => d.stage === "won").length;
  const winRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : null;

  const dealsByStage = STAGE_ORDER.map((stage) => ({
    stage,
    count: dealList.filter((d) => d.stage === stage).length,
  }));

  const leadsByStatus = LEAD_STATUS_ORDER.map((status) => ({
    status,
    count: leadList.filter((l) => l.status === status).length,
  }));
  const leadConversionRate =
    leadList.length > 0
      ? Math.round((leadList.filter((l) => l.status === "promoted").length / leadList.length) * 100)
      : null;

  const today = new Date(new Date().toDateString());
  const openTasks = taskList.filter((t) => t.status === "open");
  const overdueTasks = openTasks.filter((t) => t.due_date && new Date(t.due_date) < today);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Open pipeline value" value={money(openPipelineValue)} />
        <StatTile label="Won value" value={money(wonValue)} sub={`${wonCount} deal${wonCount === 1 ? "" : "s"}`} />
        <StatTile label="Win rate" value={winRate === null ? "—" : `${winRate}%`} sub="of closed deals" />
        <StatTile
          label="Open tasks"
          value={String(openTasks.length)}
          sub={overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : "none overdue"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 font-display text-lg font-bold text-cream">Pipeline by stage</h2>
          <div className="space-y-3">
            {dealsByStage.map(({ stage, count }) => (
              <Bar
                key={stage}
                label={STAGE_LABEL[stage]}
                count={count}
                total={dealList.length}
                colorClass={stage === "won" ? "bg-green-500" : stage === "lost" ? "bg-white/20" : "bg-gold-400"}
              />
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-cream">Lead funnel</h2>
            {leadConversionRate !== null && (
              <span className="text-xs text-cream-dim">{leadConversionRate}% promoted to contact</span>
            )}
          </div>
          <div className="space-y-3">
            {leadsByStatus.map(({ status, count }) => (
              <Bar
                key={status}
                label={LEAD_STATUS_LABEL[status]}
                count={count}
                total={leadList.length}
                colorClass={status === "promoted" ? "bg-green-500" : "bg-gold-400"}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
