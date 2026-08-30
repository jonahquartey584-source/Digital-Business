"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { computeAvailableSlots, type TimeSlot } from "@/lib/booking/availability";
import type { Booking, BookingService, BookingSettings } from "@/lib/supabase/types";

async function getSettingsAndBookings(slug: string, dateStr: string) {
  if (!isSupabaseConfigured) return null;
  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("booking_settings")
    .select("*")
    .eq("slug", slug)
    .eq("enabled", true)
    .maybeSingle<BookingSettings>();
  if (!settings) return null;

  const dayStart = new Date(`${dateStr}T00:00:00`).toISOString();
  const dayEnd = new Date(`${dateStr}T23:59:59`).toISOString();

  const { data: bookings } = await admin
    .from("bookings")
    .select("starts_at, ends_at")
    .eq("owner_id", settings.owner_id)
    .eq("status", "confirmed")
    .gte("starts_at", dayStart)
    .lte("starts_at", dayEnd);

  return { admin, settings, bookings: (bookings as Pick<Booking, "starts_at" | "ends_at">[]) ?? [] };
}

/** Called from the public booking widget (a client component) to show open times for a date. */
export async function getSlotsForDate(
  slug: string,
  dateStr: string,
  serviceId: string | null
): Promise<{ slots: TimeSlot[]; error: string | null }> {
  const context = await getSettingsAndBookings(slug, dateStr);
  if (!context) return { slots: [], error: "This booking page isn't available." };

  let durationMinutes = 30;
  if (serviceId) {
    const { data: service } = await context.admin
      .from("booking_services")
      .select("duration_minutes")
      .eq("id", serviceId)
      .eq("owner_id", context.settings.owner_id)
      .maybeSingle<Pick<BookingService, "duration_minutes">>();
    if (service) durationMinutes = service.duration_minutes;
  }

  const slots = computeAvailableSlots(
    context.settings.weekly_hours,
    dateStr,
    durationMinutes,
    context.bookings
  );
  return { slots, error: null };
}

export type CreateBookingState = { error: string | null; success: boolean };

/** Called by the public booking form — no signed-in user. */
export async function createPublicBooking(
  _prevState: CreateBookingState,
  formData: FormData
): Promise<CreateBookingState> {
  if (!isSupabaseConfigured) {
    return { error: "Booking isn't available right now.", success: false };
  }

  const slug = String(formData.get("slug") ?? "");
  const startsAt = String(formData.get("starts_at") ?? "");
  const endsAt = String(formData.get("ends_at") ?? "");
  const serviceId = (formData.get("service_id") as string) || null;
  const customerName = String(formData.get("customer_name") ?? "").trim();
  const customerEmail = (String(formData.get("customer_email") ?? "").trim() || null);
  const customerPhone = (String(formData.get("customer_phone") ?? "").trim() || null);
  const notes = (String(formData.get("notes") ?? "").trim() || null);

  if (!slug || !startsAt || !endsAt || !customerName) {
    return { error: "Please fill in your name and pick a time.", success: false };
  }

  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("booking_settings")
    .select("*")
    .eq("slug", slug)
    .eq("enabled", true)
    .maybeSingle<BookingSettings>();
  if (!settings) return { error: "This booking page isn't available.", success: false };

  // Re-check the slot is still free right before inserting — the caller's
  // last availability fetch could be stale by the time they submit.
  const { data: conflicts } = await admin
    .from("bookings")
    .select("id")
    .eq("owner_id", settings.owner_id)
    .eq("status", "confirmed")
    .lt("starts_at", endsAt)
    .gt("ends_at", startsAt)
    .limit(1);

  if (conflicts && conflicts.length > 0) {
    return {
      error: "Sorry, that time was just booked by someone else — please pick another.",
      success: false,
    };
  }

  const { data: booking } = await admin
    .from("bookings")
    .insert({
      owner_id: settings.owner_id,
      service_id: serviceId,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      notes,
      starts_at: startsAt,
      ends_at: endsAt,
      status: "confirmed",
    })
    .select("id")
    .single<Pick<Booking, "id">>();

  if (booking) {
    await linkBookingToCrm(admin, settings.owner_id, booking.id, {
      customerName,
      customerEmail,
      customerPhone,
      startsAt,
      serviceId,
    });
  }

  return { error: null, success: true };
}

async function linkBookingToCrm(
  admin: ReturnType<typeof createAdminClient>,
  ownerId: string,
  bookingId: string,
  info: {
    customerName: string;
    customerEmail: string | null;
    customerPhone: string | null;
    startsAt: string;
    serviceId: string | null;
  }
) {
  const { data: crmSub } = await admin
    .from("subscriptions")
    .select("status")
    .eq("user_id", ownerId)
    .eq("product", "crm")
    .maybeSingle<{ status: string }>();
  if (!crmSub || !["active", "trialing"].includes(crmSub.status)) return;
  if (!info.customerEmail && !info.customerPhone) return;

  let query = admin.from("crm_contacts").select("id").eq("owner_id", ownerId);
  query = info.customerEmail
    ? query.eq("email", info.customerEmail)
    : query.eq("phone", info.customerPhone!);
  let { data: contact } = await query.maybeSingle<{ id: string }>();

  if (!contact) {
    const [firstName, ...rest] = info.customerName.split(" ");
    const { data: created } = await admin
      .from("crm_contacts")
      .insert({
        owner_id: ownerId,
        first_name: firstName || info.customerName,
        last_name: rest.join(" ") || null,
        email: info.customerEmail,
        phone: info.customerPhone,
        notes: "Auto-created from a Booking System appointment.",
      })
      .select("id")
      .single<{ id: string }>();
    contact = created;
  }

  if (!contact) return;

  let serviceName = "an appointment";
  if (info.serviceId) {
    const { data: service } = await admin
      .from("booking_services")
      .select("name")
      .eq("id", info.serviceId)
      .maybeSingle<{ name: string }>();
    if (service) serviceName = service.name;
  }

  await admin.from("crm_activities").insert({
    owner_id: ownerId,
    contact_id: contact.id,
    type: "booking",
    content: `Booked ${serviceName} for ${new Date(info.startsAt).toLocaleString()}.`,
  });

  await admin.from("bookings").update({ contact_id: contact.id }).eq("id", bookingId);
}
