import { createAdminClient } from "@/lib/supabase/server";
import {
  finalizeCall,
  formDataToParams,
  getVoiceSettingsByToken,
  verifyTwilioSignature,
} from "@/lib/voice/webhook-helpers";
import { summarizeVoiceCall } from "@/lib/voice/ai";
import type { VoiceCall } from "@/lib/supabase/types";

export const runtime = "nodejs";

const TERMINAL_STATUSES = new Set(["completed", "busy", "failed", "no-answer", "canceled"]);

// Fires on every call status change once the client also sets this as their
// Twilio number's "Call status changes" webhook (see the dashboard's Voice
// settings page for the exact URL and setup steps). This is the one place
// a call gets its final summary, duration, and CRM activity — the gather
// loop only ever ends the conversation, never finalizes.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const settings = await getVoiceSettingsByToken(token);
  if (!settings) return new Response("Not found.", { status: 404 });

  const twilioParams = await formDataToParams(request);
  const signature = request.headers.get("X-Twilio-Signature");
  if (!verifyTwilioSignature(settings, signature, request.url, twilioParams)) {
    return new Response("Invalid signature.", { status: 403 });
  }

  const callSid = twilioParams.CallSid;
  const callStatus = twilioParams.CallStatus;
  if (!callSid || !TERMINAL_STATUSES.has(callStatus)) {
    return new Response("ok", { status: 200 });
  }

  const admin = createAdminClient();
  const { data: call } = await admin
    .from("voice_calls")
    .select("*")
    .eq("twilio_call_sid", callSid)
    .maybeSingle<VoiceCall>();

  // A human-answered call is finalized already (nothing for the AI to
  // summarize); a call Twilio never even logged with us (e.g. it failed
  // before reaching our voice webhook) has nothing to finalize either.
  if (!call || call.status === "human_answered" || call.status === "completed") {
    return new Response("ok", { status: 200 });
  }

  const summary =
    call.transcript.length > 0 ? await summarizeVoiceCall(settings, call.transcript) : null;

  const duration = twilioParams.CallDuration ? Number(twilioParams.CallDuration) : null;
  await finalizeCall(settings.owner_id, callSid, summary, duration);

  return new Response("ok", { status: 200 });
}
