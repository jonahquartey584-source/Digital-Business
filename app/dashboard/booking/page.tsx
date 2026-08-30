import { createClient } from "@/lib/supabase/server";
import { createService, deleteService } from "@/lib/booking/actions";
import { SubmitButton } from "@/components/submit-button";
import { BookingSettingsForm } from "@/components/booking-settings-form";
import type { BookingService, BookingSettings } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function BookingSettingsPage() {
  const supabase = await createClient();
  const [{ data: settings }, { data: services }] = await Promise.all([
    supabase.from("booking_settings").select("*").maybeSingle<BookingSettings>(),
    supabase.from("booking_services").select("*").order("name"),
  ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://your-domain";
  const serviceList = (services as BookingService[]) ?? [];

  return (
    <div className="space-y-6">
      <BookingSettingsForm settings={settings ?? null} siteUrl={siteUrl} />

      <div className="card p-6">
        <h2 className="font-display text-lg font-bold text-cream">Services</h2>
        <p className="mt-1 text-sm text-cream-dim">
          What customers can book. Each has its own duration, so your
          availability adjusts automatically.
        </p>

        <form action={createService} className="mt-4 grid gap-3 sm:grid-cols-4">
          <input className="input sm:col-span-2" name="name" placeholder="Consultation call" required />
          <input className="input" name="duration_minutes" type="number" min={5} step={5} defaultValue={30} placeholder="Minutes" />
          <input className="input" name="price" type="number" step="0.01" placeholder="Price (optional)" />
          <div className="sm:col-span-4">
            <SubmitButton pendingText="Adding…" className="btn-secondary">
              Add service
            </SubmitButton>
          </div>
        </form>

        {serviceList.length > 0 && (
          <div className="mt-4 divide-y divide-ink-border border-t border-ink-border">
            {serviceList.map((service) => (
              <div key={service.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-cream">{service.name}</p>
                  <p className="text-xs text-cream-dim">
                    {service.duration_minutes} min
                    {service.price != null && ` · $${Number(service.price).toFixed(2)}`}
                  </p>
                </div>
                <form action={deleteService.bind(null, service.id)}>
                  <button type="submit" className="btn-ghost text-xs text-red-400 hover:text-red-300">
                    Delete
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
