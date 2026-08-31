import { createClient } from "@/lib/supabase/server";
import { importLeadsCsv } from "@/lib/crm/actions";
import { SubmitButton } from "@/components/submit-button";
import type { CrmImport } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const supabase = await createClient();
  const { data: imports } = await supabase
    .from("crm_imports")
    .select("*")
    .order("created_at", { ascending: false });
  const importList = (imports as CrmImport[]) ?? [];

  return (
    <div>
      <div className="card mb-8 p-5">
        <h2 className="mb-1 font-display text-lg font-bold text-cream">Import leads from CSV</h2>
        <p className="mb-4 text-sm text-cream-dim">
          Upload a CSV with at least a name column (first name, or a
          combined "name" column) — email and phone columns are picked up
          automatically if present, under any of the usual header names.
          Every row lands in your{" "}
          <a href="/dashboard/crm/leads" className="text-gold-300 hover:underline">Leads Database</a>{" "}
          as a new lead.
        </p>
        <form action={importLeadsCsv} className="flex flex-wrap items-center gap-3">
          <input
            className="input file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-gold-500/15 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gold-300"
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
          />
          <SubmitButton pendingText="Importing…" className="btn-primary">
            Import
          </SubmitButton>
        </form>
      </div>

      <h2 className="mb-3 font-display text-lg font-bold text-cream">Import history</h2>
      {importList.length === 0 ? (
        <p className="text-sm text-cream-dim">No imports yet.</p>
      ) : (
        <div className="card divide-y divide-ink-border">
          {importList.map((imp) => (
            <div key={imp.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="font-medium text-cream">{imp.filename}</p>
                <p className="text-sm text-cream-dim">
                  {new Date(imp.created_at).toLocaleString()} · {imp.success_count} imported
                  {imp.error_count > 0 ? `, ${imp.error_count} skipped` : ""}
                  {imp.error_summary ? ` — ${imp.error_summary}` : ""}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  imp.status === "completed" ? "bg-green-500/15 text-green-300" : "bg-red-500/15 text-red-300"
                }`}
              >
                {imp.status === "completed" ? "Completed" : "Failed"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
