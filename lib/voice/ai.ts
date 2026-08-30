import Anthropic from "@anthropic-ai/sdk";
import type { VoiceSettings, VoiceTranscriptTurn } from "@/lib/supabase/types";

let anthropicSingleton: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicSingleton) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Add it to your environment (see .env.example)."
      );
    }
    anthropicSingleton = new Anthropic({ apiKey: key });
  }
  return anthropicSingleton;
}

function systemPrompt(settings: VoiceSettings): string {
  const business = settings.business_name?.trim() || "this business";
  const context = settings.business_context?.trim();

  return [
    `You are the AI phone receptionist for ${business}, currently on a live phone call with a caller whose call was missed by the team.`,
    context ? `What you know about the business:\n${context}` : null,
    `Your job: sound warm and human, find out who's calling and why, answer what you can from the business info above, and make sure nothing important gets lost — take a clear message (name, number if different from caller ID, and what they need) if you can't fully resolve it yourself.`,
    `Rules for this medium — you are being read aloud by text-to-speech on a phone call:`,
    `- Keep every reply short: 1–3 sentences, plain conversational language, no lists, no markdown, no emoji.`,
    `- Ask one question at a time.`,
    `- Never claim to be a human. If asked, say you're the AI assistant for ${business}.`,
    `- If the caller wants to end the call, thank them and say goodbye — don't keep prompting.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function toAnthropicMessages(
  transcript: VoiceTranscriptTurn[]
): Anthropic.MessageParam[] {
  return transcript.map((turn) => ({
    role: turn.role === "caller" ? "user" : "assistant",
    content: turn.text,
  }));
}

/**
 * Generates the AI's next spoken reply given the conversation so far.
 * Low effort + no extended thinking: this is a latency-sensitive live phone
 * call, not a task worth reasoning deeply about, and callers won't wait
 * through a multi-second thinking pause.
 */
export async function generateVoiceReply(
  settings: VoiceSettings,
  transcript: VoiceTranscriptTurn[]
): Promise<string> {
  const client = getAnthropic();

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 300,
    system: systemPrompt(settings),
    messages: toAnthropicMessages(transcript),
    output_config: { effort: "low" },
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  return (
    textBlock?.text.trim() ||
    "Sorry, could you say that again?"
  );
}

/** One-line greeting spoken the moment the AI picks up. */
export function openingGreeting(settings: VoiceSettings): string {
  const custom = settings.greeting?.trim();
  if (custom) return custom;
  const business = settings.business_name?.trim() || "us";
  return `Hi, thanks for calling ${business}. Our team can't get to the phone right now, but I'm their AI assistant — how can I help?`;
}

/** Short summary generated once the call ends, for the call log + CRM activity. */
export async function summarizeVoiceCall(
  settings: VoiceSettings,
  transcript: VoiceTranscriptTurn[]
): Promise<string> {
  if (transcript.length === 0) return "Call ended with no conversation recorded.";

  const client = getAnthropic();
  const transcriptText = transcript
    .map((t) => `${t.role === "caller" ? "Caller" : "AI"}: ${t.text}`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 200,
    system:
      "Summarize this phone call transcript in 1–2 short sentences for a busy business owner catching up on missed calls. Lead with what the caller wants and any callback details they gave. Plain text, no markdown.",
    messages: [{ role: "user", content: transcriptText }],
    output_config: { effort: "low" },
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  return textBlock?.text.trim() || "Call completed — see transcript for details.";
}
