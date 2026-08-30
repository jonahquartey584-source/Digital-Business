import {
  appendTranscriptTurns,
  formDataToParams,
  getVoiceSettingsByToken,
  twimlResponse,
  verifyTwilioSignature,
} from "@/lib/voice/webhook-helpers";
import { goodbyeTwiml, replyAndGatherTwiml } from "@/lib/voice/twiml";
import { generateVoiceReply } from "@/lib/voice/ai";
import type { VoiceTranscriptTurn } from "@/lib/supabase/types";

export const runtime = "nodejs";

const REPROMPT_TEXT = "Sorry, I didn't catch that — could you say that again?";
const CLOSING_TEXT = "No worries — thanks for calling, goodbye for now.";
const WRAP_UP_TEXT =
  "I want to make sure this gets handled properly, so I've noted everything down for the team to follow up with you shortly. Thanks for your patience — goodbye for now.";

// Long calls are capped so a stuck/looping conversation can't run forever
// (bounds both AI cost and call duration).
const MAX_CALLER_TURNS = 15;

function turn(role: VoiceTranscriptTurn["role"], text: string): VoiceTranscriptTurn {
  return { role, text, at: new Date().toISOString() };
}

// Each time Twilio's <Gather> captures (or times out on) a turn of speech,
// it POSTs here. This handler is the entire conversation loop — one HTTP
// round trip per turn, no persistent connection needed.
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
  const speechResult = twilioParams.SpeechResult?.trim();
  if (!callSid) return new Response("Missing CallSid.", { status: 400 });

  const origin = new URL(request.url).origin;

  if (!speechResult) {
    // Caller was silent. Reprompt once; if they're silent again right
    // after, end the call rather than looping forever.
    const soFar = await appendTranscriptTurns(callSid, []); // read current transcript, no-op write
    const lastWasReprompt = soFar.at(-1)?.text === REPROMPT_TEXT;

    if (lastWasReprompt) {
      await appendTranscriptTurns(callSid, [turn("ai", CLOSING_TEXT)]);
      return twimlResponse(goodbyeTwiml(CLOSING_TEXT));
    }

    await appendTranscriptTurns(callSid, [turn("ai", REPROMPT_TEXT)]);
    return twimlResponse(replyAndGatherTwiml(origin, token, REPROMPT_TEXT));
  }

  const transcriptSoFar = await appendTranscriptTurns(callSid, [turn("caller", speechResult)]);

  const callerTurnCount = transcriptSoFar.filter((t) => t.role === "caller").length;
  if (callerTurnCount > MAX_CALLER_TURNS) {
    await appendTranscriptTurns(callSid, [turn("ai", WRAP_UP_TEXT)]);
    return twimlResponse(goodbyeTwiml(WRAP_UP_TEXT));
  }

  const reply = await generateVoiceReply(settings, transcriptSoFar);
  await appendTranscriptTurns(callSid, [turn("ai", reply)]);

  return twimlResponse(replyAndGatherTwiml(origin, token, reply));
}
