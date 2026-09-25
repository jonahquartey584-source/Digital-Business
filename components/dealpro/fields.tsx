"use client";

import { useEffect, useState } from "react";

/**
 * Number input that keeps its own text while typing (so clearing the
 * field or typing "1." doesn't snap back to 0), with an optional £ prefix
 * or unit suffix.
 */
export function NumField({
  label,
  value,
  onValue,
  prefix,
  suffix,
  step,
  min,
  hideLabel,
}: {
  label: string;
  value: number;
  onValue: (n: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  min?: number;
  hideLabel?: boolean;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
    // Only resync when the value changes from outside.
  }, [value]);

  return (
    <label className="block min-w-0">
      <span className={hideLabel ? "sr-only" : "label text-xs"}>{label}</span>
      <span className="relative block">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-cream-dim">
            {prefix}
          </span>
        )}
        <input
          className={`input text-right font-mono tabular-nums ${prefix ? "!pl-6" : ""} ${suffix ? "!pr-14" : ""}`}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value);
            onValue(Number.isFinite(n) ? n : 0);
          }}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-cream-dim">
            {suffix}
          </span>
        )}
      </span>
    </label>
  );
}

export function TextField({
  label,
  value,
  onValue,
  placeholder,
}: {
  label: string;
  value: string;
  onValue: (s: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="label text-xs">{label}</span>
      <input className="input" value={value} placeholder={placeholder} onChange={(e) => onValue(e.target.value)} />
    </label>
  );
}

export function SelectField({
  label,
  value,
  onValue,
  options,
}: {
  label: string;
  value: string;
  onValue: (s: string) => void;
  options: string[];
}) {
  return (
    <label className="block min-w-0">
      <span className="label text-xs">{label}</span>
      <select className="input" value={value} onChange={(e) => onValue(e.target.value)}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

export function Panel({ children }: { children: React.ReactNode }) {
  return <div className="card divide-y divide-ink-border self-start">{children}</div>;
}

export function PanelSection({
  title,
  action,
  description,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-cream">{title}</h3>
        {action}
      </div>
      {description && <p className="-mt-1.5 mb-3 text-xs text-cream-dim">{description}</p>}
      {children}
    </div>
  );
}
