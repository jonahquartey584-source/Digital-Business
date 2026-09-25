import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createDeal } from "@/lib/dealpro/actions";
import { gbp, normalizeDeal, summarize, type Deal } from "@/lib/dealpro/model";
import { SubmitButton } from "@/components/submit-button";
import { DealRowControls } from "@/components/dealpro/deal-row-controls";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("dealpro_deals")
    .select("*")
    .order("updated_at", { ascending: false });
  const deals = ((data as Deal[]) ?? []).map(normalizeDeal);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-xl text-sm text-cream-dim">
          Analyse a rent-to-SA deal, check it, then build an investor pack and
          a Deal Notice for your sourcer. Numbers are free; AI tasks use
          credits.
        </p>
        <form action={createDeal}>
          <SubmitButton pendingText="Creating…" className="btn-primary">
            New deal
          </SubmitButton>
        </form>
      </div>

      {deals.length === 0 ? (
        <div className="card p-10 text-center text-sm text-cream-dim">
          No deals yet. Start one with <span className="text-cream">New deal</span>.
        </div>
      ) : (
        <div className="card divide-y divide-ink-border">
          <div className="hidden grid-cols-[minmax(0,1fr)_96px_104px_104px_300px] gap-4 px-5 py-2 font-mono text-[11px] uppercase tracking-wider text-cream-dim lg:grid">
            <span>Deal</span>
            <span className="text-right">Rent pcm</span>
            <span className="text-right">Surplus 60%</span>
            <span className="text-right">Surplus 80%</span>
            <span>Status</span>
          </div>
          {deals.map((deal) => {
            const s = summarize(deal.units, deal.assumptions);
            return (
              <div
                key={deal.id}
                className="grid grid-cols-3 items-center gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_96px_104px_104px_300px]"
              >
                <div className="col-span-3 min-w-0 lg:col-span-1">
                  <Link
                    href={`/dashboard/dealpro/${deal.id}`}
                    className="font-medium text-cream hover:text-gold-300 hover:underline"
                  >
                    {deal.name}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-cream-dim">
                    {[deal.area, deal.strategy, `${deal.units.length} unit${deal.units.length === 1 ? "" : "s"}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <Figure label="Rent pcm" value={s.rent} />
                <Figure label="Surplus 60%" value={s.surplus[0]} signed />
                <Figure label="Surplus 80%" value={s.surplus[1]} signed />
                <div className="col-span-3 lg:col-span-1">
                  <DealRowControls id={deal.id} status={deal.status} name={deal.name} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Figure({ label, value, signed }: { label: string; value: number; signed?: boolean }) {
  return (
    <div className="lg:text-right">
      <span className="block text-[11px] text-cream-dim lg:hidden">{label}</span>
      <span className={`font-mono text-sm tabular-nums ${signed && value < 0 ? "text-red-400" : "text-cream"}`}>
        {gbp(value)}
      </span>
    </div>
  );
}
