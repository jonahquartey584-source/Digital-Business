import twilio from "twilio";
import { createAdminClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";
import type { VoiceCall, VoiceSettings, VoiceTranscriptTurn } from "@/lib/supabase/types";

export async function getVoiceSettingsByToken(
  token: string
): Promise<VoiceSettings | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("voice_settings")
    .select("*")
    .eq("webhook_token", token)
    .maybeSingle<VoiceSettings>();
  return data;
}

/** Verifies the request really came from Twilio, using this client's own Auth Token. */
export function verifyTwilioSignature(
  settings: VoiceSettings,
  signature: string | null,
  url: string,
  params: Record<string, string>
): boolean {
  if (!signature || !settings.twilio_auth_token_enc) return false;
  try {
    const authToken = decryptSecret(settings.twilio_auth_token_enc);
    return twilio.validateRequest(authToken, signature, url, params);
  } catch {
    return false;
  }
}

export async function formDataToParams(
  request: Request
): Promise<Record<string, string>> {
  const formData = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") params[key] = value;
  }
  return params;
}

export function twimlResponse(twiml: string): Response {
  return new Response(twiml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

export async function getOrCreateCall(
  ownerId: string,
  callSid: string,
  fromNumber: string,
  toNumber: string
): Promise<VoiceCall> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("voice_calls")
    .select("*")
    .eq("twilio_call_sid", callSid)
    .maybeSingle<VoiceCall>();
  if (existing) return existing;

  const { data: created } = await admin
    .from("voice_calls")
    .insert({
      owner_id: ownerId,
      twilio_call_sid: callSid,
      from_number: fromNumber,
      to_number: toNumber,
      status: "ringing",
    })
    .select("*")
    .single<VoiceCall>();

  return created!;
}

export async function updateCallStatus(callSid: string, status: VoiceCall["status"]) {
  const admin = createAdminClient();
  await admin.from("voice_calls").update({ status }).eq("twilio_call_sid", callSid);
}

export async function appendTranscriptTurns(
  callSid: string,
  turns: VoiceTranscriptTurn[]
): Promise<VoiceTranscriptTurn[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("voice_calls")
    .select("transcript")
    .eq("twilio_call_sid", callSid)
    .maybeSingle<Pick<VoiceCall, "transcript">>();

  const updated = [...(data?.transcript ?? []), ...turns];
  await admin.from("voice_calls").update({ transcript: updated }).eq("twilio_call_sid", callSid);
  return updated;
}

/**
 * Finalizes a call: marks it completed, stores the summary, and — if the
 * same user also has an active CRM subscription — logs it there too
 * (finds or creates a contact by phone number, adds a call activity).
 * Safe to call more than once for the same call (idempotent enough for
 * Twilio's occasional webhook retries).
 */
export async function finalizeCall(
  ownerId: string,
  callSid: string,
  summary: string | null,
  durationSeconds: number | null
) {
  const admin = createAdminClient();

  const { data: call } = await admin
    .from("voice_calls")
    .select("*")
    .eq("twilio_call_sid", callSid)
    .maybeSingle<VoiceCall>();
  if (!call || call.status === "completed") return;

  await admin
    .from("voice_calls")
    .update({
      status: "completed",
      summary,
      duration_seconds: durationSeconds,
      ended_at: new Date().toISOString(),
    })
    .eq("twilio_call_sid", callSid);

  if (!call.from_number) return;

  // lib/subscription.ts's hasActiveSubscription() reads the currently
  // signed-in user via cookies — there is no session in a webhook, so
  // resolve the call owner's CRM access directly instead.
  const { data: crmSub } = await admin
    .from("subscriptions")
    .select("status")
    .eq("user_id", ownerId)
    .eq("product", "crm")
    .maybeSingle<{ status: string }>();
  if (!crmSub || !["active", "trialing"].includes(crmSub.status)) return;

  let { data: contact } = await admin
    .from("crm_contacts")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("phone", call.from_number)
    .maybeSingle<{ id: string }>();

  if (!contact) {
    const { data: created } = await admin
      .from("crm_contacts")
      .insert({
        owner_id: ownerId,
        first_name: "Caller",
        phone: call.from_number,
        notes: "Auto-created from an AI Reception call.",
      })
      .select("id")
      .single<{ id: string }>();
    contact = created;
  }

  if (contact) {
    await admin.from("crm_activities").insert({
      owner_id: ownerId,
      contact_id: contact.id,
      type: "call",
      content: summary ?? "Missed call handled by AI Reception.",
    });
    await admin.from("voice_calls").update({ contact_id: contact.id }).eq("twilio_call_sid", callSid);
  }
}
