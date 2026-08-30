import { createClient } from "@/lib/supabase/server";
import { saveVoiceSettings, releaseVoiceNumber, regenerateWebhookToken } from "@/lib/voice/actions";
import { SubmitButton } from "@/components/submit-button";
import { VoiceNumberPicker } from "@/components/voice-number-picker";
import type { VoiceSettings } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function VoiceSettingsPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("voice_settings")
    .select("*")
    .maybeSingle<VoiceSettings>();

  const hasNumber = !!settings?.twilio_phone_number;

  return (
    <div className="space-y-6">
      {hasNumber ? (
        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-bold text-cream">
                Your AI Reception number
              </h2>
              <p className="mt-1 font-mono text-lg text-gold-300">
                {settings!.twilio_phone_number}
              </p>
              <p className="mt-1 text-xs text-cream-dim">
                Set up automatically — calls to this number are already
                routed to your AI.
              </p>
            </div>
            <div className="flex gap-2">
              <form action={regenerateWebhookToken}>
                <button type="submit" className="btn-ghost text-xs">
                  Rotate webhook (security)
                </button>
              </form>
              <form action={releaseVoiceNumber}>
                <button type="submit" className="btn-ghost text-xs text-red-400 hover:text-red-300">
                  Release number
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : (
        <VoiceNumberPicker />
      )}

      <form action={saveVoiceSettings} className="card space-y-5 p-6">
        <h2 className="font-display text-lg font-bold text-cream">
          What the AI should know
        </h2>

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
            <label className="label" htmlFor="forwarding_number">
              Forward to first (optional)
            </label>
            <input
              className="input"
              id="forwarding_number"
              name="forwarding_number"
              defaultValue={settings?.forwarding_number ?? ""}
              placeholder="+15557654321"
            />
            <p className="mt-1 text-xs text-cream-dim">
              Leave blank to have the AI answer every call directly.
            </p>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="greeting">Greeting (optional)</label>
          <input
            className="input"
            id="greeting"
            name="greeting"
            defaultValue={settings?.greeting ?? ""}
            placeholder="Hi, thanks for calling — how can I help?"
          />
        </div>

        <div>
          <label className="label" htmlFor="business_context">
            Business info (services, hours, pricing — anything the AI should know)
          </label>
          <textarea
            className="input"
            id="business_context"
            name="business_context"
            rows={5}
            defaultValue={settings?.business_context ?? ""}
            placeholder="We build websites, CRMs, and booking systems for small businesses. Open Mon–Fri, 9am–5pm. Free initial quote."
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-cream-dim">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={settings?.enabled ?? true}
            className="h-4 w-4 rounded border-ink-border bg-ink-soft"
          />
          Enabled — turn off to have calls hit a "not in service" message
          instead of the AI.
        </label>

        <SubmitButton pendingText="Saving…" className="btn-primary">
          Save settings
        </SubmitButton>
      </form>
    </div>
  );
}
