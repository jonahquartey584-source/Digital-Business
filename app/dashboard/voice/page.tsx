import { createClient } from "@/lib/supabase/server";
import { saveVoiceSettings, regenerateWebhookToken } from "@/lib/voice/actions";
import { SubmitButton } from "@/components/submit-button";
import type { VoiceSettings } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function VoiceSettingsPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("voice_settings")
    .select("*")
    .maybeSingle<VoiceSettings>();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const voiceUrl = settings && siteUrl
    ? `${siteUrl}/api/twilio/voice/${settings.webhook_token}`
    : null;
  const statusUrl = settings && siteUrl
    ? `${siteUrl}/api/twilio/voice/${settings.webhook_token}/status`
    : null;

  return (
    <div className="space-y-6">
      {voiceUrl && statusUrl ? (
        <div className="card p-6">
          <h2 className="font-display text-lg font-bold text-cream">
            Connect your Twilio number
          </h2>
          <p className="mt-1 text-sm text-cream-dim">
            In the Twilio Console, open your phone number's configuration and
            set these two webhooks:
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <p className="label">A call comes in</p>
              <code className="block break-all rounded-md border border-ink-border bg-ink px-3 py-2 text-xs text-gold-300">
                {voiceUrl}
              </code>
            </div>
            <div>
              <p className="label">Call status changes</p>
              <code className="block break-all rounded-md border border-ink-border bg-ink px-3 py-2 text-xs text-gold-300">
                {statusUrl}
              </code>
            </div>
          </div>
          <p className="mt-3 text-xs text-cream-dim">
            Both should be set to <strong>HTTP POST</strong>. See the README
            for the full walkthrough.
          </p>
          <form action={regenerateWebhookToken} className="mt-4">
            <button type="submit" className="btn-ghost text-xs">
              Regenerate webhook URL (invalidates the one above)
            </button>
          </form>
        </div>
      ) : (
        <div className="card p-6">
          <p className="text-sm text-cream-dim">
            Save your Twilio details below to get your webhook URLs.
          </p>
        </div>
      )}

      <form action={saveVoiceSettings} className="card space-y-5 p-6">
        <h2 className="font-display text-lg font-bold text-cream">Twilio account</h2>
        <p className="text-sm text-cream-dim">
          Your own Twilio account — you're billed by Twilio directly for
          call/SMS usage on this number.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="twilio_account_sid">Account SID</label>
            <input
              className="input"
              id="twilio_account_sid"
              name="twilio_account_sid"
              defaultValue={settings?.twilio_account_sid ?? ""}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
          </div>
          <div>
            <label className="label" htmlFor="twilio_auth_token">Auth Token</label>
            <input
              className="input"
              id="twilio_auth_token"
              name="twilio_auth_token"
              type="password"
              autoComplete="off"
              placeholder={
                settings?.twilio_auth_token_enc ? "•••••••••••••• (unchanged)" : "Your Twilio Auth Token"
              }
            />
            <p className="mt-1 text-xs text-cream-dim">
              Stored encrypted. Leave blank to keep the current one.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="twilio_phone_number">Twilio phone number</label>
            <input
              className="input"
              id="twilio_phone_number"
              name="twilio_phone_number"
              defaultValue={settings?.twilio_phone_number ?? ""}
              placeholder="+15551234567"
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
              Leave blank to have the AI answer every call directly instead
              of ringing a real phone first.
            </p>
          </div>
        </div>

        <h2 className="pt-2 font-display text-lg font-bold text-cream">
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
            <label className="label" htmlFor="greeting">Greeting (optional)</label>
            <input
              className="input"
              id="greeting"
              name="greeting"
              defaultValue={settings?.greeting ?? ""}
              placeholder="Hi, thanks for calling — how can I help?"
            />
          </div>
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
