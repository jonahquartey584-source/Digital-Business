"use client";

import { useState } from "react";
import { finalizePack } from "@/lib/dealpro/actions";
import {
  CREDIT_COSTS,
  DD_LABEL,
  DD_TEMPLATE,
  OCCUPANCY,
  breakEven,
  formatToday,
  gbp,
  month,
  pct,
  stripPostcode,
  summarize,
  type DdStatus,
  type PackSettings,
} from "@/lib/dealpro/model";
import type { TabProps } from "@/components/dealpro/workspace";
import { Panel, PanelSection, TextField } from "@/components/dealpro/fields";
import { Alert, Cost, StatusDot } from "@/components/dealpro/ui";

const PAPER_STATUS: Record<DdStatus, string> = {
  issue: "text-[#B42318]",
  partly: "text-[#A35C06]",
  verified: "text-[#1E7A4C]",
  none: "text-[#6A6F7A]",
};

export function PackTab({ deal, update, runAi }: TabProps) {
  const [generating, setGenerating] = useState(false);
  const p = deal.pack;
  const a = deal.assumptions;
  const U = deal.units;
  const s = summarize(U, a);
  const setPack = (patch: Partial<PackSettings>) => update({ pack: { ...p, ...patch } });
  const area = p.nda ? stripPostcode(deal.area ?? "") : deal.notice.addr || deal.area || "";

  async function generate() {
    setGenerating(true);
    await runAi(CREDIT_COSTS.pack, "Deal pack", () => finalizePack(deal.id));
    setGenerating(false);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
      <div className="space-y-4 print:hidden">
        <Panel>
          <PanelSection title="Pack settings">
            <div className="space-y-3">
              <TextField
                label="Sourcing business shown on pack"
                placeholder="e.g. your compliant sourcer's name"
                value={p.biz}
                onValue={(biz) => setPack({ biz })}
              />
              <TextField label="Redress scheme and number" placeholder="e.g. PRS 000000" value={p.redress} onValue={(redress) => setPack({ redress })} />
              <TextField label="Sourcing fee shown to investor" placeholder="e.g. £2,500 per unit" value={p.fee} onValue={(fee) => setPack({ fee })} />
              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-cream-dim">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-gold-400"
                  checked={p.nda}
                  onChange={(e) => setPack({ nda: e.target.checked })}
                />
                Pre-NDA version (hide exact address)
              </label>
            </div>
          </PanelSection>
          <PanelSection title="Generate">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" disabled={p.final || generating} onClick={generate}>
                {p.final ? "Pack generated" : generating ? "Generating…" : <>Generate final pack <Cost credits={CREDIT_COSTS.pack} /></>}
              </button>
              <button type="button" className="btn-secondary" onClick={() => window.print()}>
                Print / save PDF
              </button>
            </div>
            <p className="mt-3 text-xs text-cream-dim">
              Generating removes the preview watermark. Use Print and choose &ldquo;Save as PDF&rdquo; to send it.
            </p>
          </PanelSection>
        </Panel>
        <Alert tone="warn">
          Only send packs through a sourcer who is in a redress scheme, or once you are in one yourself. Keep the numbers
          labelled as illustrative.
        </Alert>
      </div>

      <div className="min-w-0">
        <div className="mb-2.5 flex items-center gap-2 text-xs text-cream-dim print:hidden">
          <StatusDot tone={p.final ? "good" : "none"} />
          {p.final ? "Final pack generated" : "Preview. Generate the final pack to remove the watermark."}
        </div>
        <article className="dealpro-pack relative mx-auto max-w-[760px] overflow-hidden rounded-sm border border-ink-border bg-white px-5 pb-5 pt-6 text-[12.5px] leading-relaxed text-[#1A1C21] shadow-2xl sm:px-11 sm:pt-9 print:border-0 print:shadow-none">
          {!p.final && (
            <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden">
              <span className="-rotate-[24deg] text-6xl font-semibold tracking-widest text-[#1F2F57]/[0.07] sm:text-8xl">PREVIEW</span>
            </div>
          )}
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-[#8F5F22] pb-2 text-[11px] text-[#5E636E]">
            <b className="text-[11.5px] font-semibold text-[#8F5F22]">Investment summary</b>
            <span>
              {p.nda ? "Pre-NDA" : "Full"} · {formatToday()}
            </span>
          </div>
          <h2 className="break-words text-2xl font-semibold tracking-tight text-[#14161A]">{deal.name || "Untitled deal"}</h2>
          <p className="mb-1 mt-0.5 text-[#5E636E]">
            {area} | {deal.strategy} opportunity | {U.length} unit{U.length === 1 ? "" : "s"}
          </p>

          <PaperHeading>The deal</PaperHeading>
          <p>A rental business opportunity, not a purchase of the property. Terms are as advertised by the landlord and need written confirmation.</p>
          <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-x-6 gap-y-3.5">
            {U.map((u, i) => (
              <KV
                key={i}
                title={u.label}
                rows={[
                  ["Rent incl. bills", `${gbp(u.rent)}/month`],
                  ["Deposit", gbp(u.dep)],
                  ["Model rate", `£${u.rate}/night`],
                ]}
              />
            ))}
            {U.length > 1 && (
              <KV
                title="All units"
                rows={[
                  ["Rent", `${gbp(s.rent)}/month`],
                  ["Deposits", gbp(s.deposits)],
                  ["Upfront", gbp(s.upfront)],
                ]}
              />
            )}
          </div>

          <PaperHeading>Illustrative monthly surplus</PaperHeading>
          <PaperTable head={["Per unit", ...OCCUPANCY.map(pct), "Break-even"]}>
            {U.map((u, i) => (
              <tr key={i}>
                <td className="px-2.5 py-1.5">
                  {u.label} at £{u.rate}
                </td>
                {OCCUPANCY.map((o) => {
                  const v = month(u, o, a).surplus;
                  return (
                    <td key={o} className={`px-2.5 py-1.5 text-right font-mono ${v < 0 ? "text-[#B42318]" : ""}`}>
                      {gbp(v)}
                    </td>
                  );
                })}
                <td className="px-2.5 py-1.5 text-right font-mono">
                  {Number.isFinite(breakEven(u, a)) ? `~${pct(breakEven(u, a))}` : "Never"}
                </td>
              </tr>
            ))}
          </PaperTable>
          <p className="mt-2 text-[10.5px] text-[#6A6F7A]">
            {a.fee}% platform fees, £{a.clean} cleaning per {a.stay}-night stay, £{a.other}/month other costs, 30-day month.
            Not a forecast; nightly rates and occupancy are unvalidated.
            {deal.london && deal.strategy === "R2SA" && " London short lets are limited to 90 nights a year without planning permission."}
          </p>

          <PaperHeading>Due diligence status</PaperHeading>
          <PaperTable head={["Check", "Status"]} leftAll>
            {DD_TEMPLATE.map((t) => {
              const x = deal.diligence.find((d) => d.k === t.k)!;
              return (
                <tr key={t.k}>
                  <td className="px-2.5 py-1.5">{t.t}</td>
                  <td className={`px-2.5 py-1.5 font-medium ${PAPER_STATUS[x.s]}`}>
                    <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle" />
                    {DD_LABEL[x.s]}
                  </td>
                </tr>
              );
            })}
          </PaperTable>

          <PaperHeading>Next steps</PaperHeading>
          <p className="mb-2">
            Sourcing fee: <b>{p.fee || "on request"}</b>. The full address and landlord introduction are released after you sign
            the terms of business and pay the reservation fee.
          </p>
          <p className="text-[10.5px] text-[#6A6F7A]">
            {p.biz ? `Offered by ${p.biz}` : "Sourcing business not set"}
            {p.redress && ` | Redress: ${p.redress}`}. This summary is not financial, legal or investment advice. Returns depend
            on performance and are not guaranteed.
          </p>
          <div className="mt-5 flex flex-wrap justify-between gap-2 border-t border-[#E3E5EA] pt-2 text-[9.5px] tracking-wide text-[#5E636E]">
            <span>
              {(deal.name || "").toUpperCase()} | {p.nda ? "PRE-NDA SUMMARY" : "FULL SUMMARY"}
            </span>
            <span>Made with Deal Pro by Qp Digital</span>
          </div>
        </article>
      </div>
    </div>
  );
}

function PaperHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 mt-5 border-b border-[#E3E5EA] pb-1.5 text-[12.5px] font-semibold text-[#8F5F22]">{children}</h3>;
}

function KV({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div>
      <div className="mb-1 font-semibold text-[#14161A]">{title}</div>
      <dl className="space-y-0.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2.5 border-b border-dotted border-[#E3E5EA] py-0.5">
            <dt className="text-[#5E636E]">{k}</dt>
            <dd className="whitespace-nowrap font-mono text-[11.5px] text-[#14161A]">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function PaperTable({ head, children, leftAll }: { head: string[]; children: React.ReactNode; leftAll?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-sm border border-[#E3E5EA]">
      <table className="w-full whitespace-nowrap text-[11.5px]">
        <thead className="bg-[#F5F6F8] text-[11px] text-[#5E636E]">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={`px-2.5 py-1.5 font-medium ${i === 0 || leftAll ? "text-left" : "text-right"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E3E5EA]">{children}</tbody>
      </table>
    </div>
  );
}
