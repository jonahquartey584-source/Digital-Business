// Twilio hits this the moment a call comes in to a client's AI Reception
// number ("A call comes in" webhook, configured automatically at
// provisioning time — see provisionNumberForEmail in _voice-shared.mts).

import type { Config, Context } from "@netlify/functions";
import {
  formDataToParams,
  getOrCreateCall,
  getVoiceSettingsByToken,
  twimlResponse,
  verifyTwilioSignature,
  dialThenFallbackTwiml,
  aiPickupTwiml,
  rejectTwiml,
  openingGreeting,
} from "./_voice-shared.mts";

export default async (req: Request, context: Context) => {
  const token = context.params.token;
  const settings = token ? await getVoiceSettingsByToken(token) : null;
  if (!settings || !settings.enabled) {
    return twimlResponse(rejectTwiml());
  }

  const twilioParams = await formDataToParams(req);
  const signature = req.headers.get("X-Twilio-Signature");
  if (!verifyTwilioSignature(settings, signature, req.url, twilioParams)) {
    return new Response("Invalid signature.", { status: 403 });
  }

  const callSid = twilioParams.CallSid;
  if (!callSid) return new Response("Missing CallSid.", { status: 400 });

  await getOrCreateCall(settings.email, callSid, twilioParams.From ?? "", twilioParams.To ?? "");

  const origin = new URL(req.url).origin;

  if (settings.forwardingNumber) {
    return twimlResponse(dialThenFallbackTwiml(origin, token!, settings.forwardingNumber));
  }
  return twimlResponse(aiPickupTwiml(origin, token!, openingGreeting(settings)));
};

export const config: Config = { path: "/api/voice/:token" };
