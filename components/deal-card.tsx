"use client";

import { useTransition } from "react";
import { deleteDeal, updateDealStage } from "@/lib/crm/actions";
import type { CrmDeal, DealStage } from "@/lib/supabase/types";

const STAGES: DealStage[] = ["lead", "qualified", "proposal", "won", "lost"];

export function DealCard({ deal }: { deal: CrmDeal }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-slate-900">{deal.title}</p>
        <button
          onClick={() => startTransition(() => deleteDeal(deal.id))}
          className="text-xs text-slate-400 hover:text-red-600"
          aria-label="Delete deal"
        >
          ✕
        </button>
      </div>
      {deal.value != null && (
        <p className="mt-1 text-sm text-slate-600">
          ${Number(deal.value).toLocaleString()}
        </p>
      )}
      <select
        value={deal.stage}
        disabled={isPending}
        onChange={(e) =>
          startTransition(() =>
            updateDealStage(deal.id, e.target.value as DealStage)
          )
        }
        className="input mt-3 text-xs"
      >
        {STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {stage[0].toUpperCase() + stage.slice(1)}
          </option>
        ))}
      </select>
    </div>
  );
}
