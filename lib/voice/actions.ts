"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { hasActiveSubscription } from "@/lib/subscription";
import { encryptSecret } from "@/lib/crypto";

async function requireVoiceAccess() {
  if (!isSupabaseConfigured) redirect("/login");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const allowed = await hasActiveSubscription("voice");
  if (!allowed) redirect("/dashboard/billing?upgrade=voice");
  return { supabase, user: user! };
}

function str(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length ? trimmed : null;
}

export async function saveVoiceSettings(formData: FormData) {
  const { supabase, user } = await requireVoiceAccess();

  const accountSid = str(formData, "twilio_account_sid");
  const authToken = str(formData, "twilio_auth_token"); // blank = "leave unchanged"
  const phoneNumber = str(formData, "twilio_phone_number");

  const update: Record<string, unknown> = {
    owner_id: user.id,
    twilio_account_sid: accountSid,
    twilio_phone_number: phoneNumber,
    forwarding_number: str(formData, "forwarding_number"),
    business_name: str(formData, "business_name"),
    business_context: str(formData, "business_context"),
    greeting: str(formData, "greeting"),
    enabled: formData.get("enabled") === "on",
  };

  // Only overwrite the stored Auth Token if the user actually typed a new
  // one — the form never shows the real value back, so a blank field means
  // "unchanged," not "clear it."
  if (authToken) {
    update.twilio_auth_token_enc = encryptSecret(authToken);
  }

  await supabase.from("voice_settings").upsert(update, { onConflict: "owner_id" });

  revalidatePath("/dashboard/voice");
}

export async function regenerateWebhookToken() {
  const { supabase, user } = await requireVoiceAccess();

  const token = randomBytes(24).toString("hex");
  await supabase
    .from("voice_settings")
    .update({ webhook_token: token })
    .eq("owner_id", user.id);

  revalidatePath("/dashboard/voice");
}
