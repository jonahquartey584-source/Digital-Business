import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { CrmDeal, DealStage } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const STAGES: { key: DealStage; label: string }[] = [
  { key: "lead", label: "Lead" },
  { key: "qualified", label: "Qualified" },
  { key: "proposal", label: "Proposal" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];
const OPEN_STAGES: DealStage[] = ["lead", "qualified", "proposal"];

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

type ActivityRow = {
  id: string;
  type: string;
  content: string;
  created_at: string;
  contact_id: string | null;
  deal_id: string | null;
  crm_contacts: { first_name: string; last_name: string | null } | null;
  crm_deals: { title: string } | null;
};

export default async function CrmDashboardPage() {
  const supabase = await createClient();

  const [
    { count: contactsCount },
    { count: companiesCount },
    { data: deals },
    { data: activities },
  ] = await Promise.all([
    supabase.from("crm_contacts").select("*", { count: "exact", head: true }),
    supabase.from("crm_companies").select("*", { count: "exact", head: true }),
    supabase
      .from("crm_deals")
      .select("id, title, value, stage, updated_at"),
    supabase
      .from("crm_activities")
      .select(
        "id, type, content, created_at, contact_id, deal_id, crm_contacts(first_name,last_name), crm_deals(title)"
      )
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const dealList = (deals as Pick<CrmDeal, "id" | "title" | "value" | "stage" | "updated_at">[]) ?? [];
  const activityList = (activities as unknown as ActivityRow[]) ?? [];

  const sum = (list: typeof dealList) =>
    list.reduce((total, d) => total + (Number(d.value) || 0), 0);

  const openDeals = dealList.filter((d) => OPEN_STAGES.includes(d.stage));
  const wonDeals = dealList.filter((d) => d.stage === "won");
  const lostDeals = dealList.filter((d) => d.stage === "lost");

  // There's no dedicated "won_at" column, so this uses updated_at as a
  // proxy for when a deal was marked won — accurate as long as deals
  // aren't edited again after closing. Add a real won_at column if that
  // stops being a safe assumption.
  const now = new Date();
  const wonThisMonth = wonDeals.filter((d) => {
    const updated = new Date(d.updated_at);
    return (
      updated.getMonth() === now.getMonth() &&
      updated.getFullYear() === now.getFullYear()
    );
  });

  const closedCount = wonDeals.length + lostDeals.length;
  const winRate = closedCount > 0 ? Math.round((wonDeals.length / closedCount) * 100) : null;

  const stageBreakdown = STAGES.map((stage) => {
    const inStage = dealList.filter((d) => d.stage === stage.key);
    return { ...stage, count: inStage.length, value: sum(inStage) };
  });
  const maxStageCount = Math.max(1, ...stageBreakdown.map((s) => s.count));

  const stats = [
    { label: "Contacts", value: String(contactsCount ?? 0) },
    { label: "Companies", value: String(companiesCount ?? 0) },
    { label: "Open pipeline", value: currency.format(sum(openDeals)) },
    {
      label: "Won this month",
      value: `${currency.format(sum(wonThisMonth))} · ${wonThisMonth.length}`,
    },
  ];

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card p-5">
            <p className="font-mono text-xs uppercase tracking-wider text-cream-dim">
              {stat.label}
            </p>
            <p className="mt-2 font-display text-2xl font-bold text-cream">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-cream">Pipeline</h2>
            {winRate !== null && (
              <span className="badge-gold">{winRate}% win rate</span>
            )}
          </div>
          <div className="mt-5 space-y-4">
            {stageBreakdown.map((stage) => (
              <div key={stage.key}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-cream-dim">{stage.label}</span>
                  <span className="text-cream-dim">
                    {stage.count} · {currency.format(stage.value)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-border">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-gold-300 to-gold-600"
                    style={{ width: `${(stage.count / maxStageCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <Link href="/dashboard/crm/pipeline" className="btn-secondary mt-6 w-full">
            Open pipeline
          </Link>
        </div>

        <div className="card p-6">
          <h2 className="font-display text-lg font-bold text-cream">Recent activity</h2>
          {activityList.length === 0 ? (
            <p className="mt-4 text-sm text-cream-dim">
              Nothing logged yet — activity from your contacts and deals will
              show up here.
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {activityList.map((activity) => {
                const contactName = activity.crm_contacts
                  ? `${activity.crm_contacts.first_name} ${activity.crm_contacts.last_name ?? ""}`.trim()
                  : null;
                const target = contactName ?? activity.crm_deals?.title ?? null;
                return (
                  <li key={activity.id} className="text-sm">
                    <p className="text-cream-dim">
                      {target && (
                        <>
                          {activity.contact_id ? (
                            <Link
                              href={`/dashboard/crm/contacts/${activity.contact_id}`}
                              className="font-medium text-cream hover:text-gold-300"
                            >
                              {target}
                            </Link>
                          ) : (
                            <span className="font-medium text-cream">{target}</span>
                          )}
                          {" — "}
                        </>
                      )}
                      {activity.content}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-cream-dim/60">
                      {new Date(activity.created_at).toLocaleString()}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
