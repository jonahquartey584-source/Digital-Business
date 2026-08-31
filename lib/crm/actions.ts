"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { hasActiveSubscription } from "@/lib/subscription";
import { parseCsv, csvRowsToLeads } from "@/lib/crm/csv";
import type { DealStage, LeadStatus, TaskStatus } from "@/lib/supabase/types";

async function requireCrmAccess() {
  if (!isSupabaseConfigured) redirect("/login");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const allowed = await hasActiveSubscription("crm");
  if (!allowed) redirect("/dashboard/billing?upgrade=crm");
  return { supabase, user: user! };
}

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length ? trimmed : null;
}

// ---------- Companies ----------

export async function createCompany(formData: FormData) {
  const { supabase, user } = await requireCrmAccess();
  const name = str(formData, "name");
  if (!name) throw new Error("Company name is required.");

  await supabase.from("crm_companies").insert({
    owner_id: user.id,
    name,
    website: str(formData, "website"),
    industry: str(formData, "industry"),
    notes: str(formData, "notes"),
  });

  revalidatePath("/dashboard/crm/companies");
  revalidatePath("/dashboard/crm");
}

export async function deleteCompany(id: string) {
  const { supabase } = await requireCrmAccess();
  await supabase.from("crm_companies").delete().eq("id", id);
  revalidatePath("/dashboard/crm/companies");
  revalidatePath("/dashboard/crm");
}

// ---------- Contacts ----------

export async function createContact(formData: FormData) {
  const { supabase, user } = await requireCrmAccess();
  const first_name = str(formData, "first_name");
  if (!first_name) throw new Error("First name is required.");

  await supabase.from("crm_contacts").insert({
    owner_id: user.id,
    first_name,
    last_name: str(formData, "last_name"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    title: str(formData, "title"),
    company_id: str(formData, "company_id"),
    notes: str(formData, "notes"),
  });

  revalidatePath("/dashboard/crm/contacts");
  revalidatePath("/dashboard/crm");
}

export async function deleteContact(id: string) {
  const { supabase } = await requireCrmAccess();
  await supabase.from("crm_contacts").delete().eq("id", id);
  revalidatePath("/dashboard/crm/contacts");
  revalidatePath("/dashboard/crm");
}

export async function addActivity(formData: FormData) {
  const { supabase, user } = await requireCrmAccess();
  const content = str(formData, "content");
  if (!content) throw new Error("Note content is required.");

  const contact_id = str(formData, "contact_id");
  const deal_id = str(formData, "deal_id");

  await supabase.from("crm_activities").insert({
    owner_id: user.id,
    contact_id,
    deal_id,
    type: str(formData, "type") ?? "note",
    content,
  });

  if (contact_id) revalidatePath(`/dashboard/crm/contacts/${contact_id}`);
  if (deal_id) revalidatePath("/dashboard/crm/pipeline");
  revalidatePath("/dashboard/crm");
}

// ---------- Deals ----------

export async function createDeal(formData: FormData) {
  const { supabase, user } = await requireCrmAccess();
  const title = str(formData, "title");
  if (!title) throw new Error("Deal title is required.");

  const valueStr = str(formData, "value");

  await supabase.from("crm_deals").insert({
    owner_id: user.id,
    title,
    value: valueStr ? Number(valueStr) : null,
    stage: (str(formData, "stage") as DealStage) ?? "lead",
    contact_id: str(formData, "contact_id"),
    company_id: str(formData, "company_id"),
    close_date: str(formData, "close_date"),
    notes: str(formData, "notes"),
  });

  revalidatePath("/dashboard/crm/pipeline");
  revalidatePath("/dashboard/crm");
}

export async function updateDealStage(id: string, stage: DealStage) {
  const { supabase } = await requireCrmAccess();
  await supabase.from("crm_deals").update({ stage }).eq("id", id);
  revalidatePath("/dashboard/crm/pipeline");
  revalidatePath("/dashboard/crm");
}

export async function deleteDeal(id: string) {
  const { supabase } = await requireCrmAccess();
  await supabase.from("crm_deals").delete().eq("id", id);
  revalidatePath("/dashboard/crm/pipeline");
  revalidatePath("/dashboard/crm");
}

// ---------- Leads ----------

export async function createLead(formData: FormData) {
  const { supabase, user } = await requireCrmAccess();
  const first_name = str(formData, "first_name");
  if (!first_name) throw new Error("First name is required.");

  await supabase.from("crm_leads").insert({
    owner_id: user.id,
    first_name,
    last_name: str(formData, "last_name"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    source: str(formData, "source") ?? "Manual entry",
    notes: str(formData, "notes"),
  });

  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard/crm/reporting");
  revalidatePath("/dashboard/crm");
}

export async function updateLeadStatus(id: string, status: LeadStatus) {
  const { supabase } = await requireCrmAccess();
  await supabase.from("crm_leads").update({ status }).eq("id", id);
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard/crm/reporting");
}

// Turns a lead into a full crm_contacts record. The lead row is kept
// (marked 'promoted', linked via promoted_contact_id) rather than deleted,
// so lead-source reporting — e.g. "how many website-form leads convert" —
// stays accurate after the fact.
export async function promoteLead(id: string) {
  const { supabase, user } = await requireCrmAccess();

  const { data: lead } = await supabase
    .from("crm_leads")
    .select("*")
    .eq("id", id)
    .maybeSingle<{ first_name: string; last_name: string | null; email: string | null; phone: string | null; notes: string | null }>();
  if (!lead) throw new Error("Lead not found.");

  const { data: contact, error } = await supabase
    .from("crm_contacts")
    .insert({
      owner_id: user.id,
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email,
      phone: lead.phone,
      notes: lead.notes,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !contact) throw new Error("Could not create contact from this lead.");

  await supabase
    .from("crm_leads")
    .update({ status: "promoted", promoted_contact_id: contact.id })
    .eq("id", id);

  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard/crm/contacts");
  revalidatePath("/dashboard/crm/reporting");
  revalidatePath("/dashboard/crm");
}

export async function deleteLead(id: string) {
  const { supabase } = await requireCrmAccess();
  await supabase.from("crm_leads").delete().eq("id", id);
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard/crm/reporting");
}

// ---------- Tasks & follow-ups ----------

export async function createTask(formData: FormData) {
  const { supabase, user } = await requireCrmAccess();
  const title = str(formData, "title");
  if (!title) throw new Error("Task title is required.");

  await supabase.from("crm_tasks").insert({
    owner_id: user.id,
    title,
    due_date: str(formData, "due_date"),
    lead_id: str(formData, "lead_id"),
    contact_id: str(formData, "contact_id"),
    deal_id: str(formData, "deal_id"),
  });

  revalidatePath("/dashboard/crm/tasks");
  revalidatePath("/dashboard/crm/reporting");
  revalidatePath("/dashboard/crm");
}

export async function setTaskStatus(id: string, status: TaskStatus) {
  const { supabase } = await requireCrmAccess();
  await supabase.from("crm_tasks").update({ status }).eq("id", id);
  revalidatePath("/dashboard/crm/tasks");
  revalidatePath("/dashboard/crm/reporting");
}

export async function deleteTask(id: string) {
  const { supabase } = await requireCrmAccess();
  await supabase.from("crm_tasks").delete().eq("id", id);
  revalidatePath("/dashboard/crm/tasks");
  revalidatePath("/dashboard/crm/reporting");
}

// ---------- CSV import ----------

export async function importLeadsCsv(formData: FormData) {
  const { supabase, user } = await requireCrmAccess();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a CSV file to import.");
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    throw new Error("Only .csv files are supported.");
  }

  const text = await file.text();
  const rows = parseCsv(text);
  const { ok, errorCount } = csvRowsToLeads(rows);

  if (ok.length > 0) {
    await supabase.from("crm_leads").insert(
      ok.map((lead) => ({
        owner_id: user.id,
        ...lead,
        source: "CSV import",
      }))
    );
  }

  await supabase.from("crm_imports").insert({
    owner_id: user.id,
    filename: file.name,
    row_count: ok.length + errorCount,
    success_count: ok.length,
    error_count: errorCount,
    status: ok.length > 0 || errorCount === 0 ? "completed" : "failed",
    error_summary:
      errorCount > 0
        ? `${errorCount} row(s) skipped — missing a first name/name column value.`
        : null,
  });

  revalidatePath("/dashboard/crm/import");
  revalidatePath("/dashboard/crm/leads");
  revalidatePath("/dashboard/crm/reporting");
}
