import { createClient } from "@/lib/supabase/server";
import { cancelBooking } from "@/lib/booking/actions";
import type { Booking, BookingService } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage() {
  const supabase = await createClient();
  const [{ data: bookings }, { data: services }] = await Promise.all([
    supabase.from("bookings").select("*").order("starts_at", { ascending: true }),
    supabase.from("booking_services").select("*"),
  ]);

  const serviceList = (services as BookingService[]) ?? [];
  const serviceName = (id: string | null) =>
    serviceList.find((s) => s.id === id)?.name ?? "Appointment";

  const now = Date.now();
  const list = ((bookings as Booking[]) ?? []).filter((b) => b.status === "confirmed");
  const upcoming = list.filter((b) => new Date(b.starts_at).getTime() >= now);
  const past = list.filter((b) => new Date(b.starts_at).getTime() < now);

  const Row = ({ booking }: { booking: Booking }) => (
    <div className="flex items-center justify-between p-4">
      <div>
        <p className="font-medium text-cream">
          {serviceName(booking.service_id)} — {booking.customer_name}
        </p>
        <p className="text-sm text-cream-dim">
          {[booking.customer_email, booking.customer_phone].filter(Boolean).join(" · ") || "—"}
        </p>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-cream-dim/60">
          {new Date(booking.starts_at).toLocaleString()}
        </p>
      </div>
      {new Date(booking.starts_at).getTime() >= now && (
        <form action={cancelBooking.bind(null, booking.id)}>
          <button type="submit" className="btn-ghost text-xs text-red-400 hover:text-red-300">
            Cancel
          </button>
        </form>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 font-display text-lg font-bold text-cream">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-cream-dim">No upcoming appointments.</p>
        ) : (
          <div className="card divide-y divide-ink-border">
            {upcoming.map((b) => <Row key={b.id} booking={b} />)}
          </div>
        )}
      </div>

      {past.length > 0 && (
        <div>
          <h2 className="mb-3 font-display text-lg font-bold text-cream">Past</h2>
          <div className="card divide-y divide-ink-border opacity-70">
            {past.slice(0, 20).map((b) => <Row key={b.id} booking={b} />)}
          </div>
        </div>
      )}
    </div>
  );
}
