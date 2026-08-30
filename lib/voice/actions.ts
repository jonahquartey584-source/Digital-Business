"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { hasActiveSubscription } from "@/lib/subscription";
import { decryptSecret } from "@/lib/crypto";
import {
  provisionNumberForUser,
  releaseNumberForUser,
  searchAvailableNumbers,
  type AvailableNumber,
} from "@/lib/voice/provisioning";
import type { VoiceSettings } from "@/lib/supabase/types";
import twilio from "twilio";

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

function siteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be set to provision a Twilio number.");
  }
  return url;
}

/** The business-info half of settings — everything that isn't Twilio provisioning. */
export async function saveVoiceSettings(formData: FormData) {
  const { supabase, user } = await requireVoiceAccess();

  await supabase.from("voice_settings").upsert(
    {
      owner_id: user.id,
      forwarding_number: str(formData, "forwarding_number"),
      business_name: str(formData, "business_name"),
      business_context: str(formData, "business_context"),
      greeting: str(formData, "greeting"),
      enabled: formData.get("enabled") === "on",
    },
    { onConflict: "owner_id" }
  );

  revalidatePath("/dashboard/voice");
}

/** Called from the number picker (a client component) — searches the platform's Twilio account. */
export async function searchVoiceNumbers(
  countryCode: string,
  areaCode: string
): Promise<{ numbers: AvailableNumber[]; error: string | null }> {
  await requireVoiceAccess();
  try {
    const numbers = await searchAvailableNumbers(countryCode, areaCode);
    return { numbers, error: null };
  } catch (err) {
    return {
      numbers: [],
      error: err instanceof Error ? err.message : "Number search failed.",
    };
  }
}

/** Buys the chosen number and wires it up — fully automatic, no Twilio console steps for the client. */
export async function provisionVoiceNumber(formData: FormData) {
  const { user } = await requireVoiceAccess();
  const phoneNumber = str(formData, "phone_number");
  if (!phoneNumber) throw new Error("No phone number selected.");

  await provisionNumberForUser(user.id, phoneNumber, siteUrl());
  revalidatePath("/dashboard/voice");
}

/** Releases the client's number and closes their Twilio Subaccount so the platform stops paying for it. */
export async function releaseVoiceNumber() {
  const { user } = await requireVoiceAccess();
  await releaseNumberForUser(user.id);
  revalidatePath("/dashboard/voice");
}

/**
 * Rotates the webhook routing token and re-points the client's live
 * Twilio number at the new URLs, so the number keeps working — a token
 * regenerated without this would leave the number calling a dead URL.
 */
export async function regenerateWebhookToken() {
  const { user } = await requireVoiceAccess();
  const admin = createAdminClient();

  const { data: settings } = await admin
    .from("voice_settings")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle<VoiceSettings>();

  if (!settings?.twilio_account_sid || !settings.twilio_auth_token_enc || !settings.twilio_phone_number) {
    return; // nothing provisioned yet — nothing to rotate
  }

  const token = randomBytes(24).toString("hex");
  const origin = siteUrl();

  const subClient = twilio(settings.twilio_account_sid, decryptSecret(settings.twilio_auth_token_enc));
  const numbers = await subClient.incomingPhoneNumbers.list({
    phoneNumber: settings.twilio_phone_number,
    limit: 1,
  });
  if (numbers[0]) {
    await subClient.incomingPhoneNumbers(numbers[0].sid).update({
      voiceUrl: `${origin}/api/twilio/voice/${token}`,
      statusCallback: `${origin}/api/twilio/voice/${token}/status`,
    });
  }

  await admin.from("voice_settings").update({ webhook_token: token }).eq("owner_id", user.id);
  revalidatePath("/dashboard/voice");
}
