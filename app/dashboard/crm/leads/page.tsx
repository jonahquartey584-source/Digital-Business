import { createClient } from "@/lib/supabase/server";
import { createLead, deleteLead, promoteLead, updateLeadStatus } from "@/lib/crm/actions";
import { SubmitButton } from "@/components/submit-button";
import type { CrmLead, LeadStatus } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  unqualified: "Unqualified",
  promoted: "Promoted",
};

const STATUS_CLASS: Record<LeadStatus, string> = {
  new: "bg-gold-500/15 text-gold-300",
  contacted: "bg-blue-500/15 text-blue-300",
  unqualified: "bg-white/10 text-cream-dim",
  promoted: "bg-green-500/15 text-green-300",
};

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: leads } = await supabase
    .from("crm_leads")
    .select("*")
    .order("created_at", { ascending: false });
  const leadList = (leads as CrmLead[]) ?? [];

  return (
    <div>
      <p className="mb-6 text-sm text-cream-dim">
        Unqualified, not-yet-worth-a-full-record leads live here. Promote one
        to a full Contact once it's worth tracking properly.
      </p>

      <details className="card mb-6 p-4">
        <summary className="cursor-pointer text-sm font-medium text-cream">
          + New lead
        </summary>
        <form action={createLead} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="first_name">First name</label>
            <input className="input" id="first_name" name="first_name" required />
          </div>
          <div>
            <label className="label" htmlFor="last_name">Last name</label>
            <input className="input" id="last_name" name="last_name" />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" />
          </div>
          <div>
            <label className="label" htmlFor="phone">Phone</label>
            <input className="input" id="phone" name="phone" type="tel" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="source">Source</label>
            <input className="input" id="source" name="source" placeholder="e.g. Website form, Referral" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="notes">Notes</label>
            <textarea className="input" id="notes" name="notes" rows={2} />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton pendingText="Adding…" className="btn-primary">
              Add lead
            </SubmitButton>
          </div>
        </form>
      </details>

      {leadList.length === 0 ? (
        <p className="text-sm text-cream-dim">No leads yet.</p>
      ) : (
        <div className="card divide-y divide-ink-border">
          {leadList.map((lead) => (
            <div key={lead.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-cream">
                    {lead.first_name} {lead.last_name ?? ""}
                  </p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[lead.status]}`}>
                    {STATUS_LABEL[lead.status]}
                  </span>
                </div>
                <p className="text-sm text-cream-dim">
                  {[lead.source, lead.email, lead.phone].filter(Boolean).join(" · ") || "No contact details"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {lead.status !== "promoted" && (
                  <>
                    <form action={updateLeadStatus.bind(null, lead.id, "contacted")}>
                      <button type="submit" className="btn-ghost text-xs">Mark contacted</button>
                    </form>
                    <form action={updateLeadStatus.bind(null, lead.id, "unqualified")}>
                      <button type="submit" className="btn-ghost text-xs">Unqualify</button>
                    </form>
                    <form action={promoteLead.bind(null, lead.id)}>
                      <button type="submit" className="btn-primary text-xs">Promote to contact</button>
                    </form>
                  </>
                )}
                <form action={deleteLead.bind(null, lead.id)}>
                  <button type="submit" className="btn-ghost text-red-400 hover:text-red-300">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
