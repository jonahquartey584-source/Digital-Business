import { randomBytes } from "crypto";
import twilio from "twilio";
import { getMasterTwilioClient } from "@/lib/voice/twilio-master";
import { createAdminClient } from "@/lib/supabase/server";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import type { VoiceSettings } from "@/lib/supabase/types";

export interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string | null;
  region: string | null;
}

/** Searches for purchasable numbers on the platform's master account. */
export async function searchAvailableNumbers(
  countryCode: string,
  areaCode?: string
): Promise<AvailableNumber[]> {
  const client = getMasterTwilioClient();
  const parsedAreaCode = areaCode ? Number(areaCode) : undefined;
  const results = await client
    .availablePhoneNumbers(countryCode)
    .local.list({
      areaCode: parsedAreaCode && !Number.isNaN(parsedAreaCode) ? parsedAreaCode : undefined,
      limit: 8,
    });

  return results.map((n) => ({
    phoneNumber: n.phoneNumber,
    friendlyName: n.friendlyName,
    locality: n.locality ?? null,
    region: n.region ?? null,
  }));
}

/**
 * Creates a Twilio Subaccount for this user (if they don't already have
 * one), buys the chosen number under it, and points that number's voice
 * webhooks at this app — fully automatic, no Twilio console steps for the
 * client. Usage on the purchased number bills to the platform's master
 * Twilio account.
 */
export async function provisionNumberForUser(
  ownerId: string,
  phoneNumber: string,
  siteUrl: string
): Promise<VoiceSettings> {
  const admin = createAdminClient();
  const master = getMasterTwilioClient();

  const { data: existing } = await admin
    .from("voice_settings")
    .select("*")
    .eq("owner_id", ownerId)
    .maybeSingle<VoiceSettings>();

  let subAccountSid = existing?.twilio_account_sid ?? null;
  let subAccountToken = existing?.twilio_auth_token_enc
    ? decryptSecret(existing.twilio_auth_token_enc)
    : null;

  if (!subAccountSid || !subAccountToken) {
    const subAccount = await master.api.v2010.accounts.create({
      friendlyName: `Qp Digital client ${ownerId}`,
    });
    subAccountSid = subAccount.sid;
    subAccountToken = subAccount.authToken;
  }

  const webhookToken = existing?.webhook_token ?? randomBytes(24).toString("hex");
  const voiceUrl = `${siteUrl}/api/twilio/voice/${webhookToken}`;
  const statusCallback = `${voiceUrl}/status`;

  // Buy the number under the Subaccount (not the master account) so its
  // usage/billing is scoped there — separable per client if this platform
  // ever needs to audit or re-bill individual clients' usage.
  const subClient = twilio(subAccountSid, subAccountToken);
  await subClient.incomingPhoneNumbers.create({
    phoneNumber,
    voiceUrl,
    voiceMethod: "POST",
    statusCallback,
    statusCallbackMethod: "POST",
  });

  const { data: saved } = await admin
    .from("voice_settings")
    .upsert(
      {
        owner_id: ownerId,
        twilio_account_sid: subAccountSid,
        twilio_auth_token_enc: encryptSecret(subAccountToken),
        twilio_phone_number: phoneNumber,
        webhook_token: webhookToken,
        enabled: true,
      },
      { onConflict: "owner_id" }
    )
    .select("*")
    .single<VoiceSettings>();

  return saved!;
}

/**
 * Releases a client's number and closes their Subaccount so the platform
 * stops paying for it — call this the moment their AI Reception
 * subscription actually ends (see app/api/stripe/webhook), not just when
 * they stop using it, since Twilio bills monthly number rental regardless
 * of usage.
 */
export async function releaseNumberForUser(ownerId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("voice_settings")
    .select("*")
    .eq("owner_id", ownerId)
    .maybeSingle<VoiceSettings>();

  if (!settings?.twilio_account_sid || !settings.twilio_auth_token_enc) return;

  try {
    const subAccountToken = decryptSecret(settings.twilio_auth_token_enc);
    const subClient = twilio(settings.twilio_account_sid, subAccountToken);

    if (settings.twilio_phone_number) {
      const numbers = await subClient.incomingPhoneNumbers.list({
        phoneNumber: settings.twilio_phone_number,
        limit: 1,
      });
      for (const n of numbers) {
        await subClient.incomingPhoneNumbers(n.sid).remove();
      }
    }

    // Closing (not just suspending) the subaccount stops any further
    // billing on it entirely.
    const master = getMasterTwilioClient();
    await master.api.v2010.accounts(settings.twilio_account_sid).update({
      status: "closed",
    });
  } catch (err) {
    console.error(`Failed to release Twilio number for user ${ownerId}:`, err);
    // Don't throw — a Stripe webhook failing here shouldn't block the
    // subscription-cancellation record from being saved. Worth alerting on
    // in production (this can leave a number billing with no active sub).
  }

  await admin
    .from("voice_settings")
    .update({ enabled: false, twilio_phone_number: null })
    .eq("owner_id", ownerId);
}
