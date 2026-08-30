import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addActivity } from "@/lib/crm/actions";
import { SubmitButton } from "@/components/submit-button";
import type { CrmActivity, CrmCompany, CrmContact } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: contact } = await supabase
    .from("crm_contacts")
    .select("*")
    .eq("id", id)
    .maybeSingle<CrmContact>();

  if (!contact) notFound();

  const [{ data: activities }, { data: company }] = await Promise.all([
    supabase
      .from("crm_activities")
      .select("*")
      .eq("contact_id", id)
      .order("created_at", { ascending: false }),
    contact.company_id
      ? supabase
          .from("crm_companies")
          .select("*")
          .eq("id", contact.company_id)
          .maybeSingle<CrmCompany>()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div>
      <Link href="/dashboard/crm/contacts" className="text-sm text-gold-300 hover:underline">
        ← Contacts
      </Link>

      <h1 className="mt-2 font-display text-2xl font-bold text-cream">
        {contact.first_name} {contact.last_name ?? ""}
      </h1>
      <p className="text-sm text-cream-dim">
        {[contact.title, company?.name].filter(Boolean).join(" · ")}
      </p>

      <div className="mt-4 grid gap-2 text-sm text-cream-dim sm:grid-cols-2">
        {contact.email && <p>Email: {contact.email}</p>}
        {contact.phone && <p>Phone: {contact.phone}</p>}
      </div>
      {contact.notes && (
        <p className="mt-4 whitespace-pre-wrap text-sm text-cream-dim">{contact.notes}</p>
      )}

      <h2 className="mt-8 font-display text-lg font-bold text-cream">Activity</h2>
      <form action={addActivity} className="mt-3 flex gap-2">
        <input type="hidden" name="contact_id" value={contact.id} />
        <input type="hidden" name="type" value="note" />
        <input
          className="input"
          name="content"
          placeholder="Log a call, email, or note…"
          required
        />
        <SubmitButton pendingText="Adding…" className="btn-primary shrink-0">
          Add
        </SubmitButton>
      </form>

      <ul className="mt-4 space-y-3">
        {((activities as CrmActivity[]) ?? []).map((activity) => (
          <li key={activity.id} className="card p-3 text-sm">
            <p className="text-cream-dim">{activity.content}</p>
            <p className="mt-1 text-xs text-cream-dim/60">
              {new Date(activity.created_at).toLocaleString()}
            </p>
          </li>
        ))}
        {(!activities || activities.length === 0) && (
          <p className="text-sm text-cream-dim">No activity logged yet.</p>
        )}
      </ul>
    </div>
  );
}
