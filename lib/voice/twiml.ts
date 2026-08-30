import twilio from "twilio";

const { VoiceResponse } = twilio.twiml;

// Amazon Polly's standard voice, available on every Twilio account with no
// extra enablement. Swap for a Neural/Generative voice (e.g.
// "Polly.Joanna-Neural" or one of Twilio's newer Generative voices) once
// you've confirmed it's enabled on the connected Twilio account.
const VOICE = "Polly.Joanna";

export function gatherUrl(origin: string, token: string): string {
  return `${origin}/api/twilio/voice/${token}/gather`;
}

/** Greeting + first turn of the AI conversation. */
export function aiPickupTwiml(
  origin: string,
  token: string,
  greeting: string
): string {
  const twiml = new VoiceResponse();
  twiml.say({ voice: VOICE }, greeting);
  twiml.gather({
    input: ["speech"],
    action: gatherUrl(origin, token),
    method: "POST",
    speechTimeout: "auto",
    timeout: 6,
  });
  // If Gather gets no input at all (caller silent from the start) and
  // falls through without hitting `action`, end the call gracefully rather
  // than hanging up abruptly.
  twiml.say({ voice: VOICE }, "Sorry, I didn't catch that. Goodbye for now.");
  twiml.hangup();
  return twiml.toString();
}

/** AI's reply, then listens for the caller's next turn. */
export function replyAndGatherTwiml(
  origin: string,
  token: string,
  replyText: string
): string {
  const twiml = new VoiceResponse();
  twiml.say({ voice: VOICE }, replyText);
  twiml.gather({
    input: ["speech"],
    action: gatherUrl(origin, token),
    method: "POST",
    speechTimeout: "auto",
    timeout: 6,
  });
  twiml.say({ voice: VOICE }, "Thanks for calling — goodbye for now.");
  twiml.hangup();
  return twiml.toString();
}

export function goodbyeTwiml(text: string): string {
  const twiml = new VoiceResponse();
  twiml.say({ voice: VOICE }, text);
  twiml.hangup();
  return twiml.toString();
}

export function rejectTwiml(): string {
  const twiml = new VoiceResponse();
  twiml.say({ voice: VOICE }, "This number is not currently in service.");
  twiml.hangup();
  return twiml.toString();
}

export function dialThenFallbackTwiml(
  origin: string,
  token: string,
  forwardingNumber: string
): string {
  const twiml = new VoiceResponse();
  const dial = twiml.dial({
    timeout: 18,
    action: `${origin}/api/twilio/voice/${token}/fallback`,
    method: "POST",
  });
  dial.number(forwardingNumber);
  return twiml.toString();
}
