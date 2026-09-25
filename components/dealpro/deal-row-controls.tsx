"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteDeal, setDealStatus } from "@/lib/dealpro/actions";
import { DEAL_STATUSES, type DealStatus } from "@/lib/dealpro/model";
import { StatusDot } from "@/components/dealpro/ui";

const STATUS_TONE: Record<DealStatus, "warn" | "bad" | "neutral" | "good"> = {
  Checking: "warn",
  "Issue found": "bad",
  "Sent to sourcer": "neutral",
  Completed: "good",
};

export function DealRowControls({ id, status, name }: { id: string; status: DealStatus; name: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-[150px] flex-1">
        <span className="sr-only">Status for {name}</span>
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
          <StatusDot tone={STATUS_TONE[status]} />
        </span>
        <select
          className="input !py-1.5 !pl-7"
          defaultValue={status}
          disabled={pending}
          onChange={(e) => startTransition(() => setDealStatus(id, e.target.value))}
        >
          {DEAL_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <Link href={`/dashboard/dealpro/${id}`} className="btn-secondary px-3 py-1.5">
        Open
      </Link>
      <button
        type="button"
        className={`btn-ghost px-2 py-1.5 ${confirming ? "text-red-400 hover:text-red-300" : ""}`}
        disabled={pending}
        onClick={() => {
          if (!confirming) {
            setConfirming(true);
            setTimeout(() => setConfirming(false), 3000);
            return;
          }
          startTransition(() => deleteDeal(id));
        }}
      >
        {confirming ? "Confirm delete" : "Delete"}
      </button>
    </div>
  );
}
