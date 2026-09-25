"use client";

import { useRef } from "react";
import { noticeText, type NoticeFields } from "@/lib/dealpro/model";
import type { TabProps } from "@/components/dealpro/workspace";
import { Panel, PanelSection, SelectField, TextField } from "@/components/dealpro/fields";

const STEPS = [
  { who: "You", title: "Find the deal", body: "Landlord agrees the rent and use." },
  { who: "You", title: "Send Deal Notice", body: "Registered if no reply in 3 working days." },
  { who: "Sourcer", title: "Sells to investor", body: "Under their redress, terms and fee." },
  { who: "Sourcer", title: "Pays your share", body: "Within 7 days of the investor paying them." },
];

export function NoticeTab({ deal, update, toast, senderName }: TabProps & { senderName: string }) {
  const f = deal.notice;
  const set = (patch: Partial<NoticeFields>) => update({ notice: { ...f, ...patch } });
  const text = noticeText(deal, senderName);
  const pre = useRef<HTMLPreElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast("Deal Notice copied");
    } catch {
      const range = document.createRange();
      range.selectNodeContents(pre.current!);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      toast("Selected. Press Ctrl/Cmd+C to copy");
    }
  }

  return (
    <div>
      <p className="mb-5 max-w-2xl text-sm text-cream-dim">
        Pass a deal to a compliant sourcer under your Deal Introduction Agreement. The Deal Notice registers the deal so
        your share is protected.
      </p>
      <ol className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-ink-border bg-ink-border lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="bg-ink-card px-4 py-3 text-xs text-cream-dim">
            <div className="mb-1 flex justify-between">
              <span>{s.who}</span>
              <span className="font-mono">{String(i + 1).padStart(2, "0")}</span>
            </div>
            <b className="mb-0.5 block text-sm font-semibold text-cream">{s.title}</b>
            {s.body}
          </li>
        ))}
      </ol>

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Panel>
          <PanelSection title="Sourcer">
            <div className="space-y-3">
              <TextField label="Sourcer company" placeholder="Company name" value={f.co} onValue={(co) => set({ co })} />
              <TextField label="Sourcer notice email" placeholder="notices@example.co.uk" value={f.email} onValue={(email) => set({ email })} />
            </div>
          </PanelSection>
          <PanelSection title="Property and contact">
            <div className="space-y-3">
              <TextField
                label="Property address and postcode"
                placeholder="Full address (not shown on pre-NDA packs)"
                value={f.addr}
                onValue={(addr) => set({ addr })}
              />
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Landlord or contact" value={f.ll} onValue={(ll) => set({ ll })} />
                <SelectField
                  label="Their role"
                  value={f.role}
                  options={["Owner / landlord", "Letting agent", "Managing agent"]}
                  onValue={(role) => set({ role })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Phone" value={f.phone} onValue={(phone) => set({ phone })} />
                <TextField label="Email" value={f.lemail} onValue={(lemail) => set({ lemail })} />
              </div>
              <SelectField
                label="Use agreed by landlord"
                value={f.use}
                options={["Serviced accommodation", "Company let", "Rent-to-rent"]}
                onValue={(use) => set({ use })}
              />
              <TextField label="Documents attached" value={f.docs} onValue={(docs) => set({ docs })} />
            </div>
          </PanelSection>
        </Panel>

        <div className="min-w-0">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-cream">Deal Notice</h3>
            <button type="button" className="btn-primary px-3 py-1.5" onClick={copy}>
              Copy Deal Notice
            </button>
          </div>
          <pre
            ref={pre}
            className="max-h-[480px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-ink-border bg-ink-soft px-4 py-3.5 font-mono text-xs leading-relaxed text-cream"
          >
            {text}
          </pre>
          <p className="mt-2 text-xs text-cream-dim">
            Paste this into an email to the sourcer&apos;s notice address, subject &ldquo;Deal Notice under Deal Introduction
            Agreement&rdquo;. Keep a copy.
          </p>
        </div>
      </div>
    </div>
  );
}
