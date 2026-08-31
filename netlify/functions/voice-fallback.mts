// Twilio calls this when the forwarded <Dial> to the client's real phone
// finishes — either because someone answered, or because it rang out
// unanswered. This is the "missed call -> AI picks up" switch.

import type { Config, Context } from "@netlify/functions";
import {
  formDataToParams,
  getVoiceSettingsByToken,
  twimlResponse,
  updateCallStatus,
  verifyTwilioSignature,
  aiPickupTwiml,
  openingGreeting,
} from "./_voice-shared.mts";

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
  const dialCallStatus = twilioParams.DialCallStatus; // completed | busy | no-answer | failed | canceled
  if (!callSid) return new Response("Missing CallSid.", { status: 400 });

  if (dialCallStatus === "completed") {
    // A human answered and the call already ran its course.
    await updateCallStatus(settings.email, callSid, "human_answered");
    return new Response("<Response></Response>", { status: 200, headers: { "Content-Type": "text/xml" } });
  }

  // Unanswered, busy, or failed — the AI picks up.
  await updateCallStatus(settings.email, callSid, "ai_answered");
  const origin = new URL(req.url).origin;
  return twimlResponse(aiPickupTwiml(origin, token!, openingGreeting(settings)));
};

export const config: Config = { path: "/api/voice/:token/fallback" };
