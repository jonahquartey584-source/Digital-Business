// Fires on every call status change once the client's number is
// provisioned (statusCallback is set automatically — see
// provisionNumberForEmail). This is the one place a call gets its final
// summary, duration, and CRM lead — the gather loop only ever ends the
// conversation, never finalizes.

import type { Config, Context } from "@netlify/functions";
import {
  finalizeCall,
  formDataToParams,
  getVoiceSettings,
  getVoiceSettingsByToken,
  summarizeVoiceCall,
  verifyTwilioSignature,
} from "./_voice-shared.mts";

const TERMINAL_STATUSES = new Set(["completed", "busy", "failed", "no-answer", "canceled"]);

export default async (req: Request, context: Context) => {
  const token = context.params.token;
  const settings = token ? await getVoiceSettingsByToken(token) : null;
  if (!settings) return new Response("Not found.", { status: 404 });

  const twilioParams = await formDataToParams(req);
  const signature = req.headers.get("X-Twilio-Signature");
  if (!verifyTwilioSignature(settings, signature, req.url, twilioParams)) {
    return new Response("Invalid signature.", { status: 403 });
  }

  const callSid = twilioParams.CallSid;
  const callStatus = twilioParams.CallStatus;
  if (!callSid || !callStatus || !TERMINAL_STATUSES.has(callStatus)) {
    return new Response("ok", { status: 200 });
  }

  // Re-fetch fresh settings (gather.mts may have appended to the transcript
  // since the settings object above was loaded).
  const fresh = await getVoiceSettings(settings.email);
  const call = fresh.calls.find((c) => c.callSid === callSid);

  // A human-answered call is finalized already (nothing for the AI to
  // summarize); a call we never even logged has nothing to finalize either.
  if (!call || call.status === "human_answered" || call.status === "completed") {
    return new Response("ok", { status: 200 });
  }

  const summary = call.transcript.length > 0 ? await summarizeVoiceCall(fresh, call.transcript) : null;
  const duration = twilioParams.CallDuration ? Number(twilioParams.CallDuration) : null;
  await finalizeCall(settings.email, callSid, summary, duration);

  return new Response("ok", { status: 200 });
};

export const config: Config = { path: "/api/voice/:token/status" };
