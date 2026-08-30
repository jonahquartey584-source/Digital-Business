import {
  formDataToParams,
  getVoiceSettingsByToken,
  twimlResponse,
  updateCallStatus,
  verifyTwilioSignature,
} from "@/lib/voice/webhook-helpers";
import { aiPickupTwiml } from "@/lib/voice/twiml";
import { openingGreeting } from "@/lib/voice/ai";

export const runtime = "nodejs";

// Twilio calls this when the forwarded <Dial> to the client's real phone
// finishes — either because someone answered, or because it rang out.
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
  const dialCallStatus = twilioParams.DialCallStatus; // completed | busy | no-answer | failed | canceled
  if (!callSid) return new Response("Missing CallSid.", { status: 400 });

  if (dialCallStatus === "completed") {
    // A human answered and the call already ran its course.
    await updateCallStatus(callSid, "human_answered");
    return new Response("<Response></Response>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Unanswered, busy, or failed — the AI picks up.
  await updateCallStatus(callSid, "ai_answered");
  const origin = new URL(request.url).origin;
  return twimlResponse(aiPickupTwiml(origin, token, openingGreeting(settings)));
}
