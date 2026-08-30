import { createClient } from "@/lib/supabase/server";
import { createDeal } from "@/lib/crm/actions";
import { DealCard } from "@/components/deal-card";
import { SubmitButton } from "@/components/submit-button";
import type { CrmCompany, CrmContact, CrmDeal, DealStage } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const STAGES: { key: DealStage; label: string }[] = [
  { key: "lead", label: "Lead" },
  { key: "qualified", label: "Qualified" },
  { key: "proposal", label: "Proposal" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

export default async function CrmPipelinePage() {
  const supabase = await createClient();

  const [{ data: deals }, { data: contacts }, { data: companies }] =
    await Promise.all([
      supabase
        .from("crm_deals")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("crm_contacts").select("*").order("first_name"),
      supabase.from("crm_companies").select("*").order("name"),
    ]);

  const dealList = (deals as CrmDeal[]) ?? [];
  const contactList = (contacts as CrmContact[]) ?? [];
  const companyList = (companies as CrmCompany[]) ?? [];

  return (
    <div>
      <details className="card mb-6 p-4">
        <summary className="cursor-pointer text-sm font-medium text-cream">
          + New deal
        </summary>
        <form action={createDeal} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="title">Title</label>
            <input className="input" id="title" name="title" required />
          </div>
          <div>
            <label className="label" htmlFor="value">Value ($)</label>
            <input className="input" id="value" name="value" type="number" step="0.01" />
          </div>
          <div>
            <label className="label" htmlFor="stage">Stage</label>
            <select className="input" id="stage" name="stage" defaultValue="lead">
              {STAGES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="contact_id">Contact</label>
            <select className="input" id="contact_id" name="contact_id" defaultValue="">
              <option value="">None</option>
              {contactList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name ?? ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="company_id">Company</label>
            <select className="input" id="company_id" name="company_id" defaultValue="">
              <option value="">None</option>
              {companyList.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton pendingText="Adding…" className="btn-primary">
              Add deal
            </SubmitButton>
          </div>
        </form>
      </details>

      {dealList.length === 0 ? (
        <p className="text-sm text-cream-dim">
          No deals yet. Add your first deal above.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STAGES.map((stage) => (
            <div key={stage.key}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-cream-dim">
                {stage.label} ·{" "}
                {dealList.filter((d) => d.stage === stage.key).length}
              </h2>
              <div className="space-y-3">
                {dealList
                  .filter((d) => d.stage === stage.key)
                  .map((deal) => (
                    <DealCard key={deal.id} deal={deal} />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
