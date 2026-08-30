import { createClient } from "@/lib/supabase/server";
import { createCompany, deleteCompany } from "@/lib/crm/actions";
import { SubmitButton } from "@/components/submit-button";
import type { CrmCompany } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("crm_companies")
    .select("*")
    .order("name");
  const companies = (data as CrmCompany[]) ?? [];

  return (
    <div>
      <details className="card mb-6 p-4">
        <summary className="cursor-pointer text-sm font-medium text-cream">
          + New company
        </summary>
        <form action={createCompany} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">Name</label>
            <input className="input" id="name" name="name" required />
          </div>
          <div>
            <label className="label" htmlFor="website">Website</label>
            <input className="input" id="website" name="website" placeholder="https://" />
          </div>
          <div>
            <label className="label" htmlFor="industry">Industry</label>
            <input className="input" id="industry" name="industry" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="notes">Notes</label>
            <textarea className="input" id="notes" name="notes" rows={2} />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton pendingText="Adding…" className="btn-primary">
              Add company
            </SubmitButton>
          </div>
        </form>
      </details>

      {companies.length === 0 ? (
        <p className="text-sm text-cream-dim">No companies yet.</p>
      ) : (
        <div className="card divide-y divide-ink-border">
          {companies.map((company) => (
            <div key={company.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-cream">{company.name}</p>
                <p className="text-sm text-cream-dim">
                  {[company.industry, company.website].filter(Boolean).join(" · ")}
                </p>
              </div>
              <form action={deleteCompany.bind(null, company.id)}>
                <button type="submit" className="btn-ghost text-red-400 hover:text-red-300">
                  Delete
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
