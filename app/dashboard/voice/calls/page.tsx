import { createClient } from "@/lib/supabase/server";
import type { VoiceCall } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<VoiceCall["status"], string> = {
  ringing: "Ringing",
  human_answered: "Answered by team",
  ai_answered: "AI answered",
  completed: "Completed",
  no_answer: "No answer",
  failed: "Failed",
};

export default async function VoiceCallsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("voice_calls")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(50);

  const calls = (data as VoiceCall[]) ?? [];

  if (calls.length === 0) {
    return (
      <p className="text-sm text-cream-dim">
        No calls yet. Once your Twilio number is connected, calls will show
        up here automatically.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {calls.map((call) => (
        <details key={call.id} className="card p-4">
          <summary className="flex cursor-pointer items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium text-cream">{call.from_number ?? "Unknown number"}</p>
              <p className="mt-0.5 truncate text-sm text-cream-dim">
                {call.summary ?? "—"}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <span className="badge-gold">{STATUS_LABEL[call.status]}</span>
              <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-cream-dim/60">
                {new Date(call.started_at).toLocaleString()}
              </p>
            </div>
          </summary>

          {call.transcript.length > 0 ? (
            <ul className="mt-4 space-y-2 border-t border-ink-border pt-4 text-sm">
              {call.transcript.map((turn, i) => (
                <li key={i}>
                  <span className={turn.role === "ai" ? "text-gold-300" : "text-cream"}>
                    {turn.role === "ai" ? "AI" : "Caller"}:
                  </span>{" "}
                  <span className="text-cream-dim">{turn.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 border-t border-ink-border pt-4 text-sm text-cream-dim">
              No conversation recorded for this call.
            </p>
          )}
        </details>
      ))}
    </div>
  );
}
