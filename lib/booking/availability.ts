import type { WeeklyHours } from "@/lib/supabase/types";

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export interface TimeSlot {
  start: string; // ISO
  end: string; // ISO
}

export interface ExistingBookingWindow {
  starts_at: string;
  ends_at: string;
}

/**
 * MVP limitation: dates/times are treated as wall-clock, using whatever
 * timezone the server process runs in (Netlify/Vercel functions default to
 * UTC) — there's no per-business IANA timezone conversion yet, even though
 * booking_settings.timezone is stored for future use. Fine as long as a
 * business's hours are entered with that in mind; a real fix would run
 * this through a timezone library (e.g. date-fns-tz) keyed off that column.
 */
export function computeAvailableSlots(
  weeklyHours: WeeklyHours,
  dateStr: string,
  durationMinutes: number,
  existingBookings: ExistingBookingWindow[],
  slotIntervalMinutes = 15
): TimeSlot[] {
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime()) || durationMinutes <= 0) return [];

  const weekday = WEEKDAY_KEYS[date.getDay()];
  const ranges = weeklyHours[weekday] ?? [];
  if (ranges.length === 0) return [];

  const slots: TimeSlot[] = [];
  const now = Date.now();

  for (const [startStr, endStr] of ranges) {
    const rangeStart = combineDateAndTime(dateStr, startStr);
    const rangeEnd = combineDateAndTime(dateStr, endStr);
    if (!rangeStart || !rangeEnd || rangeEnd <= rangeStart) continue;

    let cursor = rangeStart;
    while (cursor.getTime() + durationMinutes * 60_000 <= rangeEnd.getTime()) {
      const slotEndMs = cursor.getTime() + durationMinutes * 60_000;

      const overlapsExisting = existingBookings.some((b) => {
        const bStart = new Date(b.starts_at).getTime();
        const bEnd = new Date(b.ends_at).getTime();
        return cursor.getTime() < bEnd && slotEndMs > bStart;
      });

      if (!overlapsExisting && cursor.getTime() > now) {
        slots.push({
          start: cursor.toISOString(),
          end: new Date(slotEndMs).toISOString(),
        });
      }

      cursor = new Date(cursor.getTime() + slotIntervalMinutes * 60_000);
    }
  }

  return slots;
}

function combineDateAndTime(dateStr: string, timeStr: string): Date | null {
  const match = /^(\d{2}):(\d{2})$/.exec(timeStr);
  if (!match) return null;
  const d = new Date(`${dateStr}T${match[1]}:${match[2]}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const WEEKDAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const WEEKDAY_LABELS: Record<(typeof WEEKDAY_ORDER)[number], string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export const DEFAULT_WEEKLY_HOURS: WeeklyHours = {
  mon: [["09:00", "17:00"]],
  tue: [["09:00", "17:00"]],
  wed: [["09:00", "17:00"]],
  thu: [["09:00", "17:00"]],
  fri: [["09:00", "17:00"]],
};
