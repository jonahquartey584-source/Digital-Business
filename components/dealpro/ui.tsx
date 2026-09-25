// Small presentational pieces shared by the Deal Pro screens. No hooks, so
// they render in both server and client components.

export type Tone = "good" | "warn" | "bad" | "neutral" | "none";

const DOT: Record<Tone, string> = {
  good: "bg-emerald-400",
  warn: "bg-amber-400",
  bad: "bg-red-400",
  neutral: "bg-cream-dim",
  none: "bg-transparent ring-1 ring-inset ring-cream-dim/60",
};

export function StatusDot({ tone }: { tone: Tone }) {
  return <span aria-hidden className={`inline-block h-[7px] w-[7px] shrink-0 rounded-full ${DOT[tone]}`} />;
}

const ALERT: Record<"good" | "warn" | "bad", string> = {
  good: "border-l-emerald-400",
  warn: "border-l-amber-400",
  bad: "border-l-red-400",
};

export function Alert({ tone, title, children }: { tone: "good" | "warn" | "bad"; title?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-r-md border border-l-2 border-ink-border bg-ink-card px-4 py-2.5 text-sm text-cream-dim ${ALERT[tone]}`}>
      {title && <b className="font-semibold text-cream">{title} </b>}
      {children}
    </div>
  );
}

export function StatStrip({ children, cols = 4 }: { children: React.ReactNode; cols?: 2 | 4 }) {
  return (
    <div
      className={`grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-ink-border bg-ink-border ${
        cols === 4 ? "xl:grid-cols-4" : ""
      }`}
    >
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  negative,
  dot,
}: {
  label: string;
  value: string | number;
  sub?: string;
  negative?: boolean;
  dot?: Tone;
}) {
  return (
    <div className="min-w-0 bg-ink-card px-4 py-3.5">
      <div className="flex items-center gap-2 text-xs text-cream-dim">
        {dot && <StatusDot tone={dot} />}
        {label}
      </div>
      <div
        className={`mt-1.5 whitespace-nowrap font-mono text-xl font-medium tabular-nums tracking-tight ${
          negative ? "text-red-400" : "text-cream"
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-cream-dim">{sub}</div>}
    </div>
  );
}

export function SectionHeading({ title, meta, children }: { title: string; meta?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="text-sm font-semibold text-cream">{title}</h2>
      {meta && <span className="text-xs text-cream-dim">{meta}</span>}
      {children}
    </div>
  );
}

/** Credit cost chip shown inside AI action buttons. */
export function Cost({ credits }: { credits: number }) {
  return (
    <span className="border-l border-current pl-2 font-mono text-[10px] font-normal normal-case opacity-70">
      {credits} credit{credits === 1 ? "" : "s"}
    </span>
  );
}
