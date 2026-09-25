"use client";

import { useState } from "react";
import { importAdvert } from "@/lib/dealpro/actions";
import {
  CREDIT_COSTS,
  OCCUPANCY,
  SAMPLE_ADVERT,
  breakEven,
  dealFlags,
  gbp,
  month,
  pct,
  summarize,
  type DealUnit,
  type MonthResult,
} from "@/lib/dealpro/model";
import type { TabProps } from "@/components/dealpro/workspace";
import { NumField, Panel, PanelSection, SelectField, TextField } from "@/components/dealpro/fields";
import { Alert, Cost, SectionHeading, Stat, StatStrip } from "@/components/dealpro/ui";

export function AnalyseTab({ deal, update, runAi, aiConfigured }: TabProps) {
  const [advert, setAdvert] = useState("");
  const [importing, setImporting] = useState(false);
  const a = deal.assumptions;
  const U = deal.units;

  const setUnit = (i: number, patch: Partial<DealUnit>) =>
    update({ units: U.map((u, j) => (j === i ? { ...u, ...patch } : u)) });

  async function doImport() {
    if (!advert.trim()) return;
    setImporting(true);
    const ok = await runAi(CREDIT_COSTS.import, "Advert import", () => importAdvert(deal.id, advert));
    setImporting(false);
    if (ok) setAdvert("");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
      <Panel>
        <PanelSection title="Deal">
          <div className="space-y-3">
            <TextField label="Deal name" value={deal.name} onValue={(name) => update({ name })} />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Area" value={deal.area ?? ""} onValue={(area) => update({ area })} />
              <SelectField
                label="Strategy"
                value={deal.strategy}
                options={["R2SA", "R2R"]}
                onValue={(strategy) => update({ strategy: strategy as "R2SA" | "R2R" })}
              />
            </div>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-cream-dim">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-gold-400"
                checked={deal.london}
                onChange={(e) => update({ london: e.target.checked })}
              />
              In London (90-night short-let limit applies)
            </label>
          </div>
        </PanelSection>

        <PanelSection
          title="Units"
          action={
            <button
              type="button"
              className="btn-secondary px-2.5 py-1"
              onClick={() => update({ units: [...U, { label: `Unit ${U.length + 1}`, rent: 1500, dep: 1500, rate: 160 }] })}
            >
              Add unit
            </button>
          }
        >
          <div className="divide-y divide-ink-border">
            {U.map((u, i) => (
              <div key={i} className="py-3 first:pt-0 last:pb-0">
                <div className="mb-2 flex items-center gap-2">
                  <span className="w-4 font-mono text-xs text-cream-dim">{i + 1}</span>
                  <input
                    className="input !py-1.5 font-medium"
                    aria-label="Unit name"
                    value={u.label}
                    onChange={(e) => setUnit(i, { label: e.target.value })}
                  />
                  {U.length > 1 && (
                    <button
                      type="button"
                      className="btn-ghost px-2"
                      aria-label={`Remove ${u.label}`}
                      onClick={() => update({ units: U.filter((_, j) => j !== i) })}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 pl-6">
                  <NumField label="Rent pcm" prefix="£" value={u.rent} onValue={(rent) => setUnit(i, { rent })} />
                  <NumField label="Deposit" prefix="£" value={u.dep} onValue={(dep) => setUnit(i, { dep })} />
                  <NumField label="Nightly rate" prefix="£" value={u.rate} onValue={(rate) => setUnit(i, { rate })} />
                </div>
              </div>
            ))}
            {U.length === 0 && <p className="text-sm text-cream-dim">Add a unit to see the numbers.</p>}
          </div>
        </PanelSection>

        <PanelSection
          title="Import from an advert"
          description={`Paste a landlord or sourcing advert. ${
            aiConfigured ? "AI pulls out" : "Deal Pro pulls out"
          } the rent, deposit, nightly rate and area as a new unit.`}
        >
          <label className="sr-only" htmlFor="advert">Advert text</label>
          <textarea
            id="advert"
            className="input min-h-[96px] text-xs"
            placeholder="Paste advert text here"
            value={advert}
            onChange={(e) => setAdvert(e.target.value)}
          />
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" className="btn-primary px-3 py-1.5" disabled={importing || !advert.trim()} onClick={doImport}>
              {importing ? "Importing…" : <>Import unit <Cost credits={CREDIT_COSTS.import} /></>}
            </button>
            <button type="button" className="btn-ghost px-2" onClick={() => setAdvert(SAMPLE_ADVERT)}>
              Use sample advert
            </button>
          </div>
        </PanelSection>

        <PanelSection title="Assumptions">
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Platform fees" suffix="%" step={0.5} value={a.fee} onValue={(fee) => update({ assumptions: { ...a, fee } })} />
            <NumField label="Cleaning per stay" prefix="£" value={a.clean} onValue={(clean) => update({ assumptions: { ...a, clean } })} />
            <NumField label="Average stay" suffix="nights" step={0.5} min={1} value={a.stay} onValue={(stay) => update({ assumptions: { ...a, stay } })} />
            <NumField label="Other costs pcm" prefix="£" value={a.other} onValue={(other) => update({ assumptions: { ...a, other } })} />
          </div>
          <p className="mt-3 text-xs text-cream-dim">
            30-day month. Other costs cover insurance, software, consumables and minor repairs per unit. Rent is
            treated as bills-included.
          </p>
        </PanelSection>
      </Panel>

      <Results {...{ deal }} />
    </div>
  );
}

function Results({ deal }: Pick<TabProps, "deal">) {
  const a = deal.assumptions;
  const U = deal.units;
  if (!U.length) return <div className="card p-8 text-center text-sm text-cream-dim">No units yet.</div>;

  const s = summarize(U, a);
  const flags = dealFlags(deal);

  const rows: { label: string; value: (u: DealUnit, m: MonthResult) => number | string; total?: boolean }[] = [
    { label: "Occupied nights", value: (_, m) => String(m.nights) },
    { label: "Booking revenue", value: (_, m) => m.revenue },
    { label: `Platform fees (${a.fee}%)`, value: (_, m) => m.fees },
    { label: "Cleaning and linen", value: (_, m) => m.cleaning },
    { label: "Rent incl. bills", value: (u) => u.rent },
    { label: "Other costs", value: () => a.other },
    { label: "Operating surplus", value: (_, m) => m.surplus, total: true },
  ];

  return (
    <div className="min-w-0 space-y-8">
      <div>
        <StatStrip>
          <Stat label="Upfront cash" value={gbp(s.upfront)} sub="Deposits and first month" />
          <Stat label="Surplus at 60%" value={gbp(s.surplus[0])} negative={s.surplus[0] < 0} sub="Per month, all units" />
          <Stat label="Surplus at 80%" value={gbp(s.surplus[1])} negative={s.surplus[1] < 0} sub="Per month, all units" />
          <Stat
            label="Break-even"
            value={Number.isFinite(s.worstBreakEven) ? pct(s.worstBreakEven) : "Never"}
            sub="Occupancy, weakest unit"
          />
        </StatStrip>
        <div className="mt-4 space-y-2">
          {flags.map((f) => (
            <Alert key={f.title} tone={f.tone} title={f.title}>
              {f.body}
            </Alert>
          ))}
        </div>
      </div>

      <section>
        <SectionHeading title="Monthly model" meta="Per unit at 60%, 80% and 100% occupancy" />
        <div className="card overflow-x-auto">
          <table className="w-full whitespace-nowrap text-sm">
            <thead className="text-xs text-cream-dim">
              <tr className="border-b border-ink-border">
                <th rowSpan={2} className="px-3 py-2 text-left align-bottom font-medium">Per unit, per month</th>
                {U.map((u, i) => (
                  <th key={i} colSpan={3} className="border-l border-ink-border px-3 pt-2 text-center font-medium text-cream">
                    {u.label}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-ink-border">
                {U.map((_, i) =>
                  OCCUPANCY.map((o, j) => (
                    <th key={`${i}-${j}`} className={`px-3 py-1.5 text-right font-medium ${j === 0 ? "border-l border-ink-border" : ""}`}>
                      {pct(o)}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-border">
              {rows.map((r) => (
                <tr key={r.label} className={r.total ? "border-t border-cream-dim/30 font-semibold" : ""}>
                  <td className="px-3 py-2 text-cream">{r.label}</td>
                  {U.map((u, i) =>
                    OCCUPANCY.map((o, j) => {
                      const v = r.value(u, month(u, o, a));
                      const neg = typeof v === "number" && v < 0;
                      return (
                        <td
                          key={`${i}-${j}`}
                          className={`px-3 py-2 text-right font-mono text-xs tabular-nums ${j === 0 ? "border-l border-ink-border" : ""} ${
                            neg ? "text-red-400" : "text-cream"
                          }`}
                        >
                          {typeof v === "number" ? gbp(v) : v}
                        </td>
                      );
                    })
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-cream-dim">
          £{a.clean} cleaning per turnover with a {a.stay}-night average stay. 100% is a theoretical ceiling.
          Illustrative only, not a forecast.
        </p>
      </section>

      <section>
        <SectionHeading title="If the nightly rate is lower" meta="Monthly surplus per unit" />
        <div className="card overflow-x-auto">
          <table className="w-full whitespace-nowrap text-sm">
            <thead className="text-xs text-cream-dim">
              <tr className="border-b border-ink-border">
                <th className="px-3 py-2 text-left font-medium">Unit</th>
                <th className="px-3 py-2 text-right font-medium">Nightly rate</th>
                {OCCUPANCY.map((o) => (
                  <th key={o} className="px-3 py-2 text-right font-medium">{pct(o)}</th>
                ))}
                <th className="px-3 py-2 text-right font-medium">Break-even</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-border">
              {U.flatMap((u, ui) =>
                [u.rate, u.rate - 15, u.rate - 35].map((rate, k) => {
                  const be = breakEven(u, a, rate);
                  return (
                    <tr key={`${ui}-${k}`}>
                      {k === 0 && (
                        <td rowSpan={3} className="px-3 py-2 align-top font-medium text-cream">
                          {u.label}
                        </td>
                      )}
                      <td className="px-3 py-2 text-right font-mono text-xs text-cream">
                        {k === 0 && <span className="mr-1 font-sans text-[11px] text-cream-dim">base</span>}£{rate}
                      </td>
                      {OCCUPANCY.map((o) => {
                        const v = month(u, o, a, rate).surplus;
                        return (
                          <td key={o} className={`px-3 py-2 text-right font-mono text-xs ${v < 0 ? "text-red-400" : "text-cream"}`}>
                            {gbp(v)}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right font-mono text-xs text-cream">
                        {Number.isFinite(be) ? `~${pct(be)}` : "Never"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionHeading title="Break-even occupancy" meta="Covers rent, platform fees, cleaning and other costs" />
        <div className="card divide-y divide-ink-border">
          {U.map((u, i) => {
            const b = s.breakEvens[i];
            const x = Math.min(Number.isFinite(b) ? b : 1, 1) * 100;
            return (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-2 px-4 py-3.5 sm:grid-cols-[150px_minmax(0,1fr)_96px]">
                <div className="min-w-0">
                  <span className="block truncate font-medium text-cream">{u.label}</span>
                  <span className="block font-mono text-xs text-cream-dim">£{u.rate}/night</span>
                </div>
                <div
                  className="relative col-span-2 row-start-2 h-8 sm:col-span-1 sm:row-start-auto"
                  role="img"
                  aria-label={`${u.label} break-even ${Number.isFinite(b) ? pct(b) : "never"}`}
                >
                  <span className="absolute inset-x-0 top-2.5 h-1 rounded bg-ink-border" />
                  <span className="absolute left-0 top-2.5 h-1 rounded bg-gold-700" style={{ width: `${x}%` }} />
                  {[0, 60, 80, 100].map((t) => (
                    <span key={t}>
                      <span className="absolute top-[7px] h-2.5 w-px bg-cream-dim/40" style={{ left: `${t}%` }} />
                      <span
                        className="absolute top-5 font-mono text-[10px] text-cream-dim"
                        style={{ left: `${t}%`, transform: t === 0 ? "none" : t === 100 ? "translateX(-100%)" : "translateX(-50%)" }}
                      >
                        {t}%
                      </span>
                    </span>
                  ))}
                  <span className="absolute top-1 h-4 w-0.5 -translate-x-px rounded bg-gold-300" style={{ left: `${x}%` }} />
                </div>
                <div className="text-right font-mono text-base text-cream">
                  {Number.isFinite(b) && b <= 1 ? pct(b) : "Above 100%"}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
