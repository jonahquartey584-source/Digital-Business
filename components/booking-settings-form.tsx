"use client";

import { useActionState } from "react";
import { saveBookingSettings } from "@/lib/booking/actions";
import { SubmitButton } from "@/components/submit-button";
import { WEEKDAY_LABELS, WEEKDAY_ORDER, DEFAULT_WEEKLY_HOURS } from "@/lib/booking/availability";
import type { BookingSettings } from "@/lib/supabase/types";

export function BookingSettingsForm({
  settings,
  siteUrl,
}: {
  settings: BookingSettings | null;
  siteUrl: string;
}) {
  const [state, formAction] = useActionState(saveBookingSettings, { error: null });
  const hours = settings?.weekly_hours ?? DEFAULT_WEEKLY_HOURS;

  return (
    <form action={formAction} className="card space-y-5 p-6">
      <h2 className="font-display text-lg font-bold text-cream">Your booking page</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="business_name">Business name</label>
          <input
            className="input"
            id="business_name"
            name="business_name"
            defaultValue={settings?.business_name ?? ""}
            placeholder="Qp Digital"
          />
        </div>
        <div>
          <label className="label" htmlFor="slug">Booking page URL</label>
          <input
            className="input"
            id="slug"
            name="slug"
            defaultValue={settings?.slug ?? ""}
            placeholder="qp-digital"
          />
          <p className="mt-1 truncate text-xs text-cream-dim">
            {siteUrl}/book/{settings?.slug || "your-slug"}
          </p>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="description">
          Description (shown to customers on your booking page)
        </label>
        <textarea
          className="input"
          id="description"
          name="description"
          rows={3}
          defaultValue={settings?.description ?? ""}
          placeholder="Book a free consultation with the Qp Digital team."
        />
      </div>

      <div>
        <label className="label" htmlFor="timezone">Timezone (IANA name)</label>
        <input
          className="input max-w-xs"
          id="timezone"
          name="timezone"
          defaultValue={settings?.timezone ?? "UTC"}
          placeholder="Europe/London"
        />
      </div>

      <div>
        <p className="label mb-2">Weekly hours</p>
        <div className="space-y-2">
          {WEEKDAY_ORDER.map((day) => {
            const range = hours[day]?.[0];
            return (
              <div key={day} className="flex flex-wrap items-center gap-3">
                <label className="flex w-32 items-center gap-2 text-sm text-cream-dim">
                  <input
                    type="checkbox"
                    name={`${day}_open`}
                    defaultChecked={!!range}
                    className="h-4 w-4 rounded border-ink-border bg-ink-soft"
                  />
                  {WEEKDAY_LABELS[day]}
                </label>
                <input
                  type="time"
                  name={`${day}_start`}
                  defaultValue={range?.[0] ?? "09:00"}
                  className="input w-32"
                />
                <span className="text-cream-dim">to</span>
                <input
                  type="time"
                  name={`${day}_end`}
                  defaultValue={range?.[1] ?? "17:00"}
                  className="input w-32"
                />
              </div>
            );
          })}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-cream-dim">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={settings?.enabled ?? true}
          className="h-4 w-4 rounded border-ink-border bg-ink-soft"
        />
        Enabled — turn off to take your booking page offline temporarily.
      </label>

      {state.error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {state.error}
        </p>
      )}

      <SubmitButton pendingText="Saving…" className="btn-primary">
        Save settings
      </SubmitButton>
    </form>
  );
}
