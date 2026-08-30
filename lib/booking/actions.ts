"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { hasActiveSubscription } from "@/lib/subscription";
import { WEEKDAY_ORDER } from "@/lib/booking/availability";
import type { WeeklyHours } from "@/lib/supabase/types";

async function requireBookingAccess() {
  if (!isSupabaseConfigured) redirect("/login");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const allowed = await hasActiveSubscription("booking");
  if (!allowed) redirect("/dashboard/billing?upgrade=booking");
  return { supabase, user: user! };
}

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length ? trimmed : null;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function weeklyHoursFromForm(formData: FormData): WeeklyHours {
  const hours: WeeklyHours = {};
  for (const day of WEEKDAY_ORDER) {
    const open = formData.get(`${day}_open`) === "on";
    const start = str(formData, `${day}_start`);
    const end = str(formData, `${day}_end`);
    hours[day] = open && start && end ? [[start, end]] : [];
  }
  return hours;
}

export async function saveBookingSettings(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const { supabase, user } = await requireBookingAccess();

  const businessName = str(formData, "business_name");
  const requestedSlug = str(formData, "slug");
  const slug = requestedSlug ? slugify(requestedSlug) : slugify(businessName ?? user.id);
  if (!slug) return { error: "Please enter a valid booking page URL." };

  const { error } = await supabase.from("booking_settings").upsert(
    {
      owner_id: user.id,
      slug,
      business_name: businessName,
      description: str(formData, "description"),
      timezone: str(formData, "timezone") ?? "UTC",
      weekly_hours: weeklyHoursFromForm(formData),
      enabled: formData.get("enabled") === "on",
    },
    { onConflict: "owner_id" }
  );

  if (error) {
    if (error.code === "23505") {
      return { error: `"${slug}" is already taken — try a different booking page URL.` };
    }
    return { error: "Could not save settings. Please try again." };
  }

  revalidatePath("/dashboard/booking");
  return { error: null };
}

export async function createService(formData: FormData) {
  const { supabase, user } = await requireBookingAccess();
  const name = str(formData, "name");
  if (!name) throw new Error("Service name is required.");

  const duration = Number(str(formData, "duration_minutes") ?? "30");
  const priceStr = str(formData, "price");

  await supabase.from("booking_services").insert({
    owner_id: user.id,
    name,
    duration_minutes: Number.isFinite(duration) && duration > 0 ? duration : 30,
    price: priceStr ? Number(priceStr) : null,
  });

  revalidatePath("/dashboard/booking");
}

export async function deleteService(id: string) {
  const { supabase } = await requireBookingAccess();
  await supabase.from("booking_services").delete().eq("id", id);
  revalidatePath("/dashboard/booking");
}

export async function cancelBooking(id: string) {
  const { supabase } = await requireBookingAccess();
  await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
  revalidatePath("/dashboard/booking/appointments");
}
