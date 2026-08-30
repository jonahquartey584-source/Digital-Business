import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { BookingService, BookingSettings } from "@/lib/supabase/types";

/**
 * Reads via the admin client, not a signed-in user's session — the public
 * booking page has no session at all. Deliberately not exposed through RLS
 * (see supabase/migrations/0003_booking.sql) so a slug lookup can only ever
 * return what this function chooses to select.
 */
export async function getPublicBookingPage(slug: string): Promise<{
  settings: BookingSettings;
  services: BookingService[];
} | null> {
  if (!isSupabaseConfigured) return null;
  const admin = createAdminClient();

  const { data: settings } = await admin
    .from("booking_settings")
    .select("*")
    .eq("slug", slug)
    .eq("enabled", true)
    .maybeSingle<BookingSettings>();

  if (!settings) return null;

  const { data: services } = await admin
    .from("booking_services")
    .select("*")
    .eq("owner_id", settings.owner_id)
    .eq("active", true)
    .order("name");

  return { settings, services: (services as BookingService[]) ?? [] };
}
