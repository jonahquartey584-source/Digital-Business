import {
  formDataToParams,
  getOrCreateCall,
  getVoiceSettingsByToken,
  twimlResponse,
  verifyTwilioSignature,
} from "@/lib/voice/webhook-helpers";
import { aiPickupTwiml, dialThenFallbackTwiml, rejectTwiml } from "@/lib/voice/twiml";
import { openingGreeting } from "@/lib/voice/ai";

export const runtime = "nodejs";

// Twilio hits this the moment a call comes in to the client's configured
// number ("A call comes in" webhook in their Twilio console).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const settings = await getVoiceSettingsByToken(token);
  if (!settings || !settings.enabled) {
    return twimlResponse(rejectTwiml());
  }

  const twilioParams = await formDataToParams(request);
  const signature = request.headers.get("X-Twilio-Signature");
  if (!verifyTwilioSignature(settings, signature, request.url, twilioParams)) {
    return new Response("Invalid signature.", { status: 403 });
  }

  const callSid = twilioParams.CallSid;
  const from = twilioParams.From ?? "";
  const to = twilioParams.To ?? "";
  if (!callSid) return new Response("Missing CallSid.", { status: 400 });

  await getOrCreateCall(settings.owner_id, callSid, from, to);

  const origin = new URL(request.url).origin;

  if (settings.forwarding_number) {
    return twimlResponse(dialThenFallbackTwiml(origin, token, settings.forwarding_number));
  }

  // No forwarding number configured — the AI answers every call directly.
  return twimlResponse(aiPickupTwiml(origin, token, openingGreeting(settings)));
}
