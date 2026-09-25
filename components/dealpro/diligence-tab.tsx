"use client";

import { useState } from "react";
import { runDealResearch } from "@/lib/dealpro/actions";
import { CREDIT_COSTS, DD_LABEL, DD_STATUSES, DD_TEMPLATE, type DdItem, type DdStatus } from "@/lib/dealpro/model";
import type { TabProps } from "@/components/dealpro/workspace";
import { Alert, Cost, Stat, StatStrip, StatusDot, type Tone } from "@/components/dealpro/ui";

export const DD_TONE: Record<DdStatus, Tone> = { none: "none", partly: "warn", verified: "good", issue: "bad" };

export function DiligenceTab({ deal, update, runAi, aiConfigured, toast }: TabProps) {
  const [running, setRunning] = useState(false);
  const counts = DD_STATUSES.reduce(
    (c, k) => ({ ...c, [k]: deal.diligence.filter((x) => x.s === k).length }),
    {} as Record<DdStatus, number>
  );

  const setItem = (k: string, patch: Partial<DdItem>) =>
    update({ diligence: deal.diligence.map((x) => (x.k === k ? { ...x, ...patch } : x)) });

  async function research() {
    setRunning(true);
    const ok = await runAi(CREDIT_COSTS.research, "AI research", () => runDealResearch(deal.id));
    setRunning(false);
    if (ok) toast("Findings drafted. Check each one before relying on it.");
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-2xl text-sm text-cream-dim">
          Track every check before a deal goes to investors. Run AI research to draft findings from public sources
          (council, planning, transport and market data), then confirm each one yourself.
        </p>
        <button type="button" className="btn-primary" disabled={running || !aiConfigured} onClick={research}>
          {running ? "Researching… (up to a minute)" : <>Run AI research <Cost credits={CREDIT_COSTS.research} /></>}
        </button>
      </div>
      {!aiConfigured && (
        <div className="mb-4">
          <Alert tone="warn" title="AI research is not set up.">
            Add ANTHROPIC_API_KEY to the environment to turn it on. You can still track checks by hand.
          </Alert>
        </div>
      )}
      {deal.ai_researched_at && (
        <p className="mb-3 text-xs text-cream-dim">
          Last researched {new Date(deal.ai_researched_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      )}

      <StatStrip>
        {DD_STATUSES.map((k) => (
          <Stat key={k} label={DD_LABEL[k]} value={counts[k]} dot={DD_TONE[k]} negative={k === "issue" && counts[k] > 0} />
        ))}
      </StatStrip>

      <div className="card mt-5 divide-y divide-ink-border">
        {DD_TEMPLATE.map((t, i) => {
          const x = deal.diligence.find((d) => d.k === t.k)!;
          return (
            <div key={t.k} className="grid gap-x-7 gap-y-3 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2.5">
                  <span className="w-4 font-mono text-xs text-cream-dim">{i + 1}</span>
                  <h3 className="text-sm font-semibold text-cream">{t.t}</h3>
                </div>
                <p className="mt-1 text-sm text-cream-dim lg:ml-6">{t.d}</p>
                {x.ai && (
                  <div className="mt-3 rounded-r-md border-l-2 border-gold-400 bg-white/[0.03] px-3 py-2 text-sm text-cream lg:ml-6">
                    <div className="mb-0.5 text-xs font-semibold text-gold-300">
                      AI draft <span className="ml-1.5 font-normal text-cream-dim">Verify before relying on it</span>
                    </div>
                    <p className="whitespace-pre-line">{x.ai}</p>
                  </div>
                )}
              </div>
              <div className="space-y-2.5">
                <label className="block">
                  <span className="label text-xs">Status</span>
                  <span className="relative block">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                      <StatusDot tone={DD_TONE[x.s]} />
                    </span>
                    <select
                      className="input !pl-7"
                      value={x.s}
                      onChange={(e) => setItem(t.k, { s: e.target.value as DdStatus })}
                    >
                      {DD_STATUSES.map((k) => (
                        <option key={k} value={k}>
                          {DD_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
                <label className="block">
                  <span className="label text-xs">Notes and evidence</span>
                  <textarea
                    className="input min-h-[64px] text-xs"
                    placeholder="Your notes and evidence"
                    value={x.n}
                    onChange={(e) => setItem(t.k, { n: e.target.value })}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
