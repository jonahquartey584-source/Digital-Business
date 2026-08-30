"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { createPublicBooking, getSlotsForDate } from "@/lib/booking/public-actions";
import type { TimeSlot } from "@/lib/booking/availability";
import type { BookingService } from "@/lib/supabase/types";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function BookingWidget({
  slug,
  services,
}: {
  slug: string;
  services: BookingService[];
}) {
  const [serviceId, setServiceId] = useState<string>(services[0]?.id ?? "");
  const [date, setDate] = useState(todayStr());
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [searching, startSearch] = useTransition();

  const [formState, formAction] = useActionState(createPublicBooking, {
    error: null,
    success: false,
  });

  const loadSlots = (nextDate: string, nextServiceId: string) => {
    setDate(nextDate);
    setSelectedSlot(null);
    setSlots([]);
    startSearch(async () => {
      const result = await getSlotsForDate(slug, nextDate, nextServiceId || null);
      setSlots(result.slots);
      setSlotsError(result.error);
    });
  };

  // Load today's availability as soon as the widget mounts, instead of
  // waiting for the visitor to touch the date/service inputs first.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => loadSlots(date, serviceId), []);

  if (formState.success) {
    return (
      <div className="card p-6 text-center">
        <p className="font-display text-lg font-bold text-cream">You&apos;re booked!</p>
        <p className="mt-2 text-sm text-cream-dim">
          You should receive a confirmation shortly. See you then.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-6">
      {services.length > 0 && (
        <div className="mb-4">
          <label className="label" htmlFor="service">Service</label>
          <select
            id="service"
            className="input"
            value={serviceId}
            onChange={(e) => {
              setServiceId(e.target.value);
              loadSlots(date, e.target.value);
            }}
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.duration_minutes} min{s.price != null ? ` · $${Number(s.price).toFixed(2)}` : ""})
              </option>
            ))}
          </select>
        </div>
      )}

      <label className="label" htmlFor="date">Date</label>
      <input
        id="date"
        type="date"
        className="input"
        value={date}
        min={todayStr()}
        onChange={(e) => loadSlots(e.target.value, serviceId)}
      />

      <div className="mt-4">
        {searching ? (
          <p className="text-sm text-cream-dim">Checking availability…</p>
        ) : slotsError ? (
          <p className="text-sm text-red-400">{slotsError}</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-cream-dim">No times available that day — try another date.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((slot) => (
              <button
                key={slot.start}
                type="button"
                onClick={() => setSelectedSlot(slot)}
                className={`rounded-md border px-2 py-1.5 text-xs font-mono ${
                  selectedSlot?.start === slot.start
                    ? "border-gold-400 bg-gold-500/10 text-gold-300"
                    : "border-ink-border text-cream-dim hover:border-gold-600/40"
                }`}
              >
                {new Date(slot.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedSlot && (
        <form action={formAction} className="mt-6 space-y-3 border-t border-ink-border pt-6">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="service_id" value={serviceId} />
          <input type="hidden" name="starts_at" value={selectedSlot.start} />
          <input type="hidden" name="ends_at" value={selectedSlot.end} />

          <p className="text-sm text-cream">
            Booking for{" "}
            <span className="font-medium text-gold-300">
              {new Date(selectedSlot.start).toLocaleString()}
            </span>
          </p>

          <div>
            <label className="label" htmlFor="customer_name">Your name</label>
            <input className="input" id="customer_name" name="customer_name" required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="customer_email">Email</label>
              <input className="input" id="customer_email" name="customer_email" type="email" />
            </div>
            <div>
              <label className="label" htmlFor="customer_phone">Phone</label>
              <input className="input" id="customer_phone" name="customer_phone" type="tel" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="notes">Notes (optional)</label>
            <textarea className="input" id="notes" name="notes" rows={2} />
          </div>

          {formState.error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {formState.error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full">
            Confirm booking
          </button>
        </form>
      )}
    </div>
  );
}
