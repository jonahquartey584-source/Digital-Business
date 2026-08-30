import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createContact, deleteContact } from "@/lib/crm/actions";
import { SubmitButton } from "@/components/submit-button";
import type { CrmCompany, CrmContact } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const supabase = await createClient();
  const [{ data: contacts }, { data: companies }] = await Promise.all([
    supabase.from("crm_contacts").select("*").order("first_name"),
    supabase.from("crm_companies").select("*").order("name"),
  ]);
  const contactList = (contacts as CrmContact[]) ?? [];
  const companyList = (companies as CrmCompany[]) ?? [];
  const companyName = (id: string | null) =>
    companyList.find((c) => c.id === id)?.name;

  return (
    <div>
      <details className="card mb-6 p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-900">
          + New contact
        </summary>
        <form action={createContact} className="mt-4 grid gap-3 sm:grid-cols-2">
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
          <div>
            <label className="label" htmlFor="title">Job title</label>
            <input className="input" id="title" name="title" />
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
              Add contact
            </SubmitButton>
          </div>
        </form>
      </details>

      {contactList.length === 0 ? (
        <p className="text-sm text-slate-500">No contacts yet.</p>
      ) : (
        <div className="card divide-y divide-slate-100">
          {contactList.map((contact) => (
            <div key={contact.id} className="flex items-center justify-between p-4">
              <Link href={`/dashboard/crm/contacts/${contact.id}`} className="min-w-0">
                <p className="font-medium text-slate-900">
                  {contact.first_name} {contact.last_name ?? ""}
                </p>
                <p className="text-sm text-slate-500">
                  {[contact.title, companyName(contact.company_id), contact.email]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </Link>
              <form action={deleteContact.bind(null, contact.id)}>
                <button type="submit" className="btn-ghost text-red-600">
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
