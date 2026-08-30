"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";
import type { DealStage } from "@/lib/supabase/types";

async function requireCrmAccess() {
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
}

export async function deleteCompany(id: string) {
  const { supabase } = await requireCrmAccess();
  await supabase.from("crm_companies").delete().eq("id", id);
  revalidatePath("/dashboard/crm/companies");
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
}

export async function deleteContact(id: string) {
  const { supabase } = await requireCrmAccess();
  await supabase.from("crm_contacts").delete().eq("id", id);
  revalidatePath("/dashboard/crm/contacts");
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
  if (deal_id) revalidatePath(`/dashboard/crm/deals`);
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

  revalidatePath("/dashboard/crm/deals");
}

export async function updateDealStage(id: string, stage: DealStage) {
  const { supabase } = await requireCrmAccess();
  await supabase.from("crm_deals").update({ stage }).eq("id", id);
  revalidatePath("/dashboard/crm/deals");
}

export async function deleteDeal(id: string) {
  const { supabase } = await requireCrmAccess();
  await supabase.from("crm_deals").delete().eq("id", id);
  revalidatePath("/dashboard/crm/deals");
}
