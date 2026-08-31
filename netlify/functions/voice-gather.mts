// Each time Twilio's <Gather> captures (or times out on) a turn of speech,
// it POSTs here. This handler is the entire conversation loop — one HTTP
// round trip per turn, no persistent connection needed (Netlify Functions
// can't hold a live call open, so the loop is: TwiML tells Twilio to
// gather -> Twilio POSTs the result here -> we generate the next line and
// hand back more TwiML -> repeat).

import type { Config, Context } from "@netlify/functions";
import {
  appendTranscriptTurns,
  formDataToParams,
  getVoiceSettingsByToken,
  twimlResponse,
  verifyTwilioSignature,
  generateVoiceReply,
  goodbyeTwiml,
  replyAndGatherTwiml,
  type VoiceTranscriptTurn,
} from "./_voice-shared.mts";

const REPROMPT_TEXT = "Sorry, I didn't catch that — could you say that again?";
const CLOSING_TEXT = "No worries — thanks for calling, goodbye for now.";
const WRAP_UP_TEXT =
  "I want to make sure this gets handled properly, so I've noted everything down for the team to follow up with you shortly. Thanks for your patience — goodbye for now.";

// Bounds both AI cost and call duration against a stuck/looping conversation.
const MAX_CALLER_TURNS = 15;

function turn(role: VoiceTranscriptTurn["role"], text: string): VoiceTranscriptTurn {
  return { role, text, at: new Date().toISOString() };
}

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
  const speechResult = twilioParams.SpeechResult?.trim();
  if (!callSid) return new Response("Missing CallSid.", { status: 400 });

  const origin = new URL(req.url).origin;

  if (!speechResult) {
    // Caller was silent. Reprompt once; if they're silent again right
    // after, end the call rather than looping forever.
    const soFar = await appendTranscriptTurns(settings.email, callSid, []);
    const lastWasReprompt = soFar.at(-1)?.text === REPROMPT_TEXT;

    if (lastWasReprompt) {
      await appendTranscriptTurns(settings.email, callSid, [turn("ai", CLOSING_TEXT)]);
      return twimlResponse(goodbyeTwiml(CLOSING_TEXT));
    }
    await appendTranscriptTurns(settings.email, callSid, [turn("ai", REPROMPT_TEXT)]);
    return twimlResponse(replyAndGatherTwiml(origin, token!, REPROMPT_TEXT));
  }

  const transcriptSoFar = await appendTranscriptTurns(settings.email, callSid, [turn("caller", speechResult)]);

  const callerTurnCount = transcriptSoFar.filter((t) => t.role === "caller").length;
  if (callerTurnCount > MAX_CALLER_TURNS) {
    await appendTranscriptTurns(settings.email, callSid, [turn("ai", WRAP_UP_TEXT)]);
    return twimlResponse(goodbyeTwiml(WRAP_UP_TEXT));
  }

  const reply = await generateVoiceReply(settings, transcriptSoFar);
  await appendTranscriptTurns(settings.email, callSid, [turn("ai", reply)]);

  return twimlResponse(replyAndGatherTwiml(origin, token!, reply));
};

export const config: Config = { path: "/api/voice/:token/gather" };
