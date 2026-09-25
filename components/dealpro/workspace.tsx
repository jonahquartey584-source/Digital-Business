"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveDeal, type ActionResult, type DealPatch } from "@/lib/dealpro/actions";
import type { Deal } from "@/lib/dealpro/model";
import { AnalyseTab } from "@/components/dealpro/analyse-tab";
import { DiligenceTab } from "@/components/dealpro/diligence-tab";
import { PackTab } from "@/components/dealpro/pack-tab";
import { NoticeTab } from "@/components/dealpro/notice-tab";

export type WorkspaceTab = "analyse" | "diligence" | "pack" | "notice";

const TAB_LABEL: Record<WorkspaceTab, string> = {
  analyse: "Analyse deal",
  diligence: "Due diligence",
  pack: "Deal pack",
  notice: "Send to sourcer",
};

type SaveState = "saved" | "saving" | "unsaved" | "error";

/** What each tab gets to read and change the deal. */
export interface TabProps {
  deal: Deal;
  update: (patch: DealPatch) => void;
  /** Runs a credit-spending server action; returns true on success. */
  runAi: (cost: number, label: string, fn: () => Promise<ActionResult<Deal>>) => Promise<boolean>;
  credits: number | null; // null = unlimited
  aiConfigured: boolean;
  toast: (msg: string) => void;
}

export function DealWorkspace({
  initialDeal,
  initialTab,
  credits: initialCredits,
  senderName,
  aiConfigured,
}: {
  initialDeal: Deal;
  initialTab: WorkspaceTab;
  credits: number | null;
  senderName: string;
  aiConfigured: boolean;
}) {
  const [deal, setDeal] = useState(initialDeal);
  const [tab, setTab] = useState(initialTab);
  const [credits, setCredits] = useState(initialCredits);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const pending = useRef<DealPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3200);
  }, []);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const patch = pending.current;
    if (!Object.keys(patch).length) return true;
    pending.current = {};
    setSaveState("saving");
    const res = await saveDeal(deal.id, patch);
    if (!res.ok) {
      // Put the patch back (under anything newer) so the next save retries it.
      pending.current = { ...patch, ...pending.current };
      setSaveState("error");
      toast(res.error);
      return false;
    }
    setSaveState(Object.keys(pending.current).length ? "unsaved" : "saved");
    return true;
  }, [deal.id, toast]);

  const update = useCallback(
    (patch: DealPatch) => {
      setDeal((d) => ({ ...d, ...patch }) as Deal);
      pending.current = { ...pending.current, ...patch };
      setSaveState("unsaved");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 700);
    },
    [flush]
  );

  // Don't lose the last keystrokes when navigating away.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const runAi = useCallback<TabProps["runAi"]>(
    async (cost, label, fn) => {
      if (credits !== null && credits < cost) {
        toast(`Not enough credits: ${label} needs ${cost}. Credits reset on the 1st.`);
        return false;
      }
      if (!(await flush())) return false;
      const res = await fn();
      if (!res.ok) {
        toast(res.error);
        return false;
      }
      setDeal(res.data);
      if (credits !== null) setCredits((c) => (c === null ? c : c - cost));
      toast(`${label}: ${cost} credit${cost === 1 ? "" : "s"} used`);
      return true;
    },
    [credits, flush, toast]
  );

  function go(next: WorkspaceTab) {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "analyse") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
    window.scrollTo(0, 0);
  }

  const props: TabProps = { deal, update, runAi, credits, aiConfigured, toast };
  const meta = [deal.area, deal.strategy, `${deal.units.length} unit${deal.units.length === 1 ? "" : "s"}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-ink-border pb-5 print:hidden">
        <div className="min-w-0">
          <nav className="mb-1 flex items-center gap-1.5 text-xs text-cream-dim" aria-label="Breadcrumb">
            <Link href="/dashboard/dealpro" className="hover:text-cream hover:underline">
              Deals
            </Link>
            <span className="text-ink-border">/</span>
            <span className="truncate text-cream-dim">{TAB_LABEL[tab]}</span>
          </nav>
          <h2 className="break-words font-display text-xl font-bold text-cream">{deal.name || "Untitled deal"}</h2>
          <p className="mt-0.5 text-sm text-cream-dim">{meta}</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-cream-dim">
          <span aria-live="polite">
            {saveState === "saving"
              ? "Saving…"
              : saveState === "unsaved"
                ? "Unsaved changes"
                : saveState === "error"
                  ? <button className="text-red-400 hover:underline" onClick={() => void flush()}>Save failed — retry</button>
                  : "All changes saved"}
          </span>
          <Link href="/dashboard/dealpro/credits" className="font-mono hover:text-cream">
            {credits === null ? "Unlimited credits" : `${credits} credits left`}
          </Link>
        </div>
      </header>

      <div className="mb-6 flex gap-1 overflow-x-auto print:hidden" role="tablist">
        {(Object.keys(TAB_LABEL) as WorkspaceTab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => go(t)}
            className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${
              tab === t
                ? "border border-gold-600/40 bg-gold-500/10 text-gold-300"
                : "border border-transparent text-cream-dim hover:bg-white/5 hover:text-cream"
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === "analyse" && <AnalyseTab {...props} />}
      {tab === "diligence" && <DiligenceTab {...props} />}
      {tab === "pack" && <PackTab {...props} />}
      {tab === "notice" && <NoticeTab {...props} senderName={senderName} />}

      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed bottom-6 left-4 right-4 z-50 mx-auto max-w-sm rounded-lg bg-cream px-4 py-2.5 text-sm font-medium text-ink shadow-xl transition-all sm:left-auto sm:right-6 sm:mx-0 print:hidden ${
          toastMsg ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
      >
        {toastMsg}
      </div>
    </div>
  );
}
