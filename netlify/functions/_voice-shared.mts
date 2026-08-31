// Shared helpers for AI Reception (missed-call AI answering) — the "voice"
// product. Ported from the real SaaS app's lib/voice/* (same provisioning
// model, same TwiML shapes, same Claude prompt), rebuilt for this site's
// Netlify Functions + Blobs stack instead of Next.js + Supabase. See
// _shared.mts for the auth/trust-model note that applies throughout this
// site — the same trust level applies here (a client's own verified email
// scopes their voice workspace).

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getStore } from "@netlify/blobs";
import twilioLib from "twilio";
import { json } from "./_shared.mts";

const { VoiceResponse } = twilioLib.twiml;

// --- Encryption (AES-256-GCM) — same scheme as the real app's lib/crypto.ts,
// so a Subaccount Auth Token is never stored in plaintext. -----------------

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY is not set.");
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes.");
  return buf;
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((b) => b.toString("base64")).join(":");
}

export function decryptSecret(stored: string): string {
  const key = getEncryptionKey();
  const [ivB64, authTagB64, ciphertextB64] = stored.split(":");
  if (!ivB64 || !authTagB64 || !ciphertextB64) throw new Error("Malformed encrypted secret.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

// --- Data model -------------------------------------------------------------

export interface VoiceTranscriptTurn {
  role: "caller" | "ai";
  text: string;
  at: string;
}

export type VoiceCallStatus = "ringing" | "human_answered" | "ai_answered" | "completed";

export interface VoiceCall {
  callSid: string;
  fromNumber: string | null;
  toNumber: string | null;
  status: VoiceCallStatus;
  transcript: VoiceTranscriptTurn[];
  summary: string | null;
  durationSeconds: number | null;
  startedAt: string;
  endedAt: string | null;
}

export interface VoiceSettings {
  email: string;
  twilioSubAccountSid: string | null;
  twilioAuthTokenEnc: string | null;
  phoneNumber: string | null;
  webhookToken: string | null;
  businessName: string | null;
  businessContext: string | null;
  forwardingNumber: string | null;
  greeting: string | null;
  enabled: boolean;
  calls: VoiceCall[];
}

function emptySettings(email: string): VoiceSettings {
  return {
    email,
    twilioSubAccountSid: null,
    twilioAuthTokenEnc: null,
    phoneNumber: null,
    webhookToken: null,
    businessName: null,
    businessContext: null,
    forwardingNumber: null,
    greeting: null,
    enabled: false,
    calls: [],
  };
}

function voiceStore() {
  return getStore({ name: "voice-workspaces", consistency: "strong" });
}

export async function getVoiceSettings(email: string): Promise<VoiceSettings> {
  const existing = (await voiceStore().get(email.toLowerCase(), { type: "json" })) as VoiceSettings | null;
  return existing ?? emptySettings(email.toLowerCase());
}

export async function saveVoiceSettings(settings: VoiceSettings): Promise<void> {
  await voiceStore().setJSON(settings.email.toLowerCase(), settings);
}

// Webhook token -> email index, so the Twilio webhook handlers (which only
// ever receive the token, never the email) can find the right workspace
// without listing every client on every call.
function tokenIndexStore() {
  return getStore({ name: "voice-token-index", consistency: "strong" });
}

export async function getVoiceSettingsByToken(token: string): Promise<VoiceSettings | null> {
  const email = await tokenIndexStore().get(token, { type: "text" });
  if (!email) return null;
  const settings = await getVoiceSettings(email);
  return settings.webhookToken === token ? settings : null;
}

async function setTokenIndex(token: string, email: string): Promise<void> {
  await tokenIndexStore().set(token, email.toLowerCase());
}

// --- Master Twilio client (the platform account) ----------------------------

let masterClient: ReturnType<typeof twilioLib> | null = null;

export function getMasterTwilioClient() {
  if (!masterClient) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) throw new Error("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are not set.");
    masterClient = twilioLib(sid, token);
  }
  return masterClient;
}

export function verifyTwilioSignature(
  settings: VoiceSettings,
  signature: string | null,
  url: string,
  params: Record<string, string>
): boolean {
  if (!signature || !settings.twilioAuthTokenEnc) return false;
  try {
    const authToken = decryptSecret(settings.twilioAuthTokenEnc);
    return twilioLib.validateRequest(authToken, signature, url, params);
  } catch {
    return false;
  }
}

export async function formDataToParams(req: Request): Promise<Record<string, string>> {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") params[key] = value;
  }
  return params;
}

export function twimlResponse(twiml: string): Response {
  return new Response(twiml, { status: 200, headers: { "Content-Type": "text/xml" } });
}

// --- Provisioning -------------------------------------------------------------

export interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string | null;
  region: string | null;
}

export async function searchAvailableUkNumbers(): Promise<AvailableNumber[]> {
  const client = getMasterTwilioClient();
  const results = await client.availablePhoneNumbers("GB").local.list({ limit: 8 });
  return results.map((n) => ({
    phoneNumber: n.phoneNumber,
    friendlyName: n.friendlyName,
    locality: n.locality ?? null,
    region: n.region ?? null,
  }));
}

/**
 * Creates a Twilio Subaccount for this email (if it doesn't already have
 * one), buys the chosen number under it, and points that number's voice
 * webhooks at this site's own Netlify Functions. Usage bills to the
 * platform's master Twilio account (see getMasterTwilioClient).
 */
export async function provisionNumberForEmail(
  email: string,
  phoneNumber: string,
  siteUrl: string
): Promise<VoiceSettings> {
  const master = getMasterTwilioClient();
  const settings = await getVoiceSettings(email);

  let subAccountSid = settings.twilioSubAccountSid;
  let subAccountToken = settings.twilioAuthTokenEnc ? decryptSecret(settings.twilioAuthTokenEnc) : null;

  if (!subAccountSid || !subAccountToken) {
    const subAccount = await master.api.v2010.accounts.create({
      friendlyName: `Qp Digital client ${email}`,
    });
    subAccountSid = subAccount.sid;
    subAccountToken = subAccount.authToken;
  }

  const webhookToken = settings.webhookToken ?? randomBytes(24).toString("hex");
  const voiceUrl = `${siteUrl}/api/voice/${webhookToken}`;

  const subClient = twilioLib(subAccountSid, subAccountToken);
  await subClient.incomingPhoneNumbers.create({
    phoneNumber,
    voiceUrl,
    voiceMethod: "POST",
    statusCallback: `${voiceUrl}/status`,
    statusCallbackMethod: "POST",
  });

  const updated: VoiceSettings = {
    ...settings,
    twilioSubAccountSid: subAccountSid,
    twilioAuthTokenEnc: encryptSecret(subAccountToken),
    phoneNumber,
    webhookToken,
    enabled: true,
  };

  await setTokenIndex(webhookToken, email);
  await saveVoiceSettings(updated);
  return updated;
}

/** Releases a client's number and closes their Subaccount — call this the
 * moment their AI Reception access actually ends, not just when they stop
 * using it, since Twilio bills monthly number rental regardless of usage. */
export async function releaseNumberForEmail(email: string): Promise<void> {
  const settings = await getVoiceSettings(email);
  if (!settings.twilioSubAccountSid || !settings.twilioAuthTokenEnc || !settings.phoneNumber) return;

  try {
    const authToken = decryptSecret(settings.twilioAuthTokenEnc);
    const subClient = twilioLib(settings.twilioSubAccountSid, authToken);
    const numbers = await subClient.incomingPhoneNumbers.list({ phoneNumber: settings.phoneNumber });
    for (const n of numbers) await subClient.incomingPhoneNumbers(n.sid).remove();
    await getMasterTwilioClient()
      .api.v2010.accounts(settings.twilioSubAccountSid)
      .update({ status: "closed" });
  } catch (error) {
    console.error("releaseNumberForEmail failed:", error);
  }

  await saveVoiceSettings({ ...settings, phoneNumber: null, enabled: false });
}

// --- TwiML --------------------------------------------------------------------

const VOICE = "Polly.Joanna";

export function gatherUrl(origin: string, token: string): string {
  return `${origin}/api/voice/${token}/gather`;
}

export function aiPickupTwiml(origin: string, token: string, greeting: string): string {
  const twiml = new VoiceResponse();
  twiml.say({ voice: VOICE }, greeting);
  twiml.gather({ input: ["speech"], action: gatherUrl(origin, token), method: "POST", speechTimeout: "auto", timeout: 6 });
  twiml.say({ voice: VOICE }, "Sorry, I didn't catch that. Goodbye for now.");
  twiml.hangup();
  return twiml.toString();
}

export function replyAndGatherTwiml(origin: string, token: string, replyText: string): string {
  const twiml = new VoiceResponse();
  twiml.say({ voice: VOICE }, replyText);
  twiml.gather({ input: ["speech"], action: gatherUrl(origin, token), method: "POST", speechTimeout: "auto", timeout: 6 });
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

export function dialThenFallbackTwiml(origin: string, token: string, forwardingNumber: string): string {
  const twiml = new VoiceResponse();
  const dial = twiml.dial({ timeout: 18, action: `${origin}/api/voice/${token}/fallback`, method: "POST" });
  dial.number(forwardingNumber);
  return twiml.toString();
}

// --- Claude (the AI's conversation) --------------------------------------------

function systemPrompt(settings: VoiceSettings): string {
  const business = settings.businessName?.trim() || "this business";
  const context = settings.businessContext?.trim();
  return [
    `You are the AI phone receptionist for ${business}, currently on a live phone call with a caller whose call was missed by the team.`,
    context ? `What you know about the business:\n${context}` : null,
    `Your job: sound warm and human, find out who's calling and why, answer what you can from the business info above, and make sure nothing important gets lost — take a clear message (name, number if different from caller ID, and what they need) if you can't fully resolve it yourself.`,
    `Rules for this medium — you are being read aloud by text-to-speech on a phone call:`,
    `- Keep every reply short: 1–3 sentences, plain conversational language, no lists, no markdown, no emoji.`,
    `- Ask one question at a time.`,
    `- Never claim to be a human. If asked, say you're the AI assistant for ${business}.`,
    `- If the caller wants to end the call, thank them and say goodbye — don't keep prompting.`,
  ].filter(Boolean).join("\n\n");
}

async function callClaude(body: Record<string, unknown>): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    console.error("Claude API error:", response.status, await response.text().catch(() => ""));
    throw new Error(`Claude API returned ${response.status}`);
  }
  const data = (await response.json()) as { content: Array<{ type: string; text?: string }> };
  const textBlock = data.content.find((b) => b.type === "text");
  return textBlock?.text?.trim() ?? "";
}

/** Latency-sensitive live call — low effort, short replies, no extended thinking. */
export async function generateVoiceReply(settings: VoiceSettings, transcript: VoiceTranscriptTurn[]): Promise<string> {
  const text = await callClaude({
    model: "claude-opus-5",
    max_tokens: 300,
    system: systemPrompt(settings),
    messages: transcript.map((t) => ({ role: t.role === "caller" ? "user" : "assistant", content: t.text })),
    output_config: { effort: "low" },
  }).catch(() => "");
  return text || "Sorry, could you say that again?";
}

export function openingGreeting(settings: VoiceSettings): string {
  const custom = settings.greeting?.trim();
  if (custom) return custom;
  const business = settings.businessName?.trim() || "us";
  return `Hi, thanks for calling ${business}. Our team can't get to the phone right now, but I'm their AI assistant — how can I help?`;
}

export async function summarizeVoiceCall(settings: VoiceSettings, transcript: VoiceTranscriptTurn[]): Promise<string> {
  if (transcript.length === 0) return "Call ended with no conversation recorded.";
  const transcriptText = transcript.map((t) => `${t.role === "caller" ? "Caller" : "AI"}: ${t.text}`).join("\n");
  const text = await callClaude({
    model: "claude-opus-5",
    max_tokens: 200,
    system:
      "Summarize this phone call transcript in 1–2 short sentences for a busy business owner catching up on missed calls. Lead with what the caller wants and any callback details they gave. Plain text, no markdown.",
    messages: [{ role: "user", content: transcriptText }],
    output_config: { effort: "low" },
  }).catch(() => "");
  return text || "Call completed — see transcript for details.";
}

// --- Call log helpers ------------------------------------------------------

export async function getOrCreateCall(email: string, callSid: string, from: string, to: string): Promise<VoiceCall> {
  const settings = await getVoiceSettings(email);
  const existing = settings.calls.find((c) => c.callSid === callSid);
  if (existing) return existing;

  const call: VoiceCall = {
    callSid,
    fromNumber: from || null,
    toNumber: to || null,
    status: "ringing",
    transcript: [],
    summary: null,
    durationSeconds: null,
    startedAt: new Date().toISOString(),
    endedAt: null,
  };
  settings.calls.unshift(call);
  await saveVoiceSettings(settings);
  return call;
}

export async function updateCallStatus(email: string, callSid: string, status: VoiceCallStatus): Promise<void> {
  const settings = await getVoiceSettings(email);
  const call = settings.calls.find((c) => c.callSid === callSid);
  if (!call) return;
  call.status = status;
  await saveVoiceSettings(settings);
}

export async function appendTranscriptTurns(
  email: string,
  callSid: string,
  turns: VoiceTranscriptTurn[]
): Promise<VoiceTranscriptTurn[]> {
  const settings = await getVoiceSettings(email);
  const call = settings.calls.find((c) => c.callSid === callSid);
  if (!call) return turns;
  call.transcript.push(...turns);
  await saveVoiceSettings(settings);
  return call.transcript;
}

/** Finalizes a call: marks it completed, stores the summary, and — if this
 * email also has an active CRM workspace — logs it there too (finds or
 * creates a lead by phone number). Safe to call more than once per call. */
export async function finalizeCall(
  email: string,
  callSid: string,
  summary: string | null,
  durationSeconds: number | null
): Promise<void> {
  const settings = await getVoiceSettings(email);
  const call = settings.calls.find((c) => c.callSid === callSid);
  if (!call || call.status === "completed") return;

  call.status = "completed";
  call.summary = summary;
  call.durationSeconds = durationSeconds;
  call.endedAt = new Date().toISOString();
  await saveVoiceSettings(settings);

  if (!call.fromNumber) return;

  try {
    const crmStore = getStore({ name: "crm-workspaces", consistency: "strong" });
    const crmWorkspace = (await crmStore.get(email.toLowerCase(), { type: "json" })) as
      | { email: string; leads: Array<{ phone: string | null }> }
      | null;
    // Only log to CRM if this email actually has a CRM workspace already
    // (i.e. they've used the CRM at least once) — this is a light-touch
    // integration, not a reason to create one from scratch here.
    if (!crmWorkspace) return;

    const alreadyLead = crmWorkspace.leads.some((l) => l.phone === call.fromNumber);
    if (alreadyLead) return;

    const { randomUUID } = await import("node:crypto");
    (crmWorkspace as any).leads.push({
      id: randomUUID(),
      firstName: "Caller",
      lastName: null,
      email: null,
      phone: call.fromNumber,
      source: "AI Reception call",
      status: "new",
      promotedContactId: null,
      createdAt: new Date().toISOString(),
    });
    await crmStore.setJSON(email.toLowerCase(), crmWorkspace);
  } catch (error) {
    console.error("finalizeCall: CRM logging failed (non-fatal):", error);
  }
}

export { json };
