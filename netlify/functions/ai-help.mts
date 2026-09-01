import OpenAI from "openai";
import type { Config, Context } from "@netlify/functions";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const SYSTEM_PROMPT = `You are the Qp Digital website and members-portal assistant. Be concise, friendly, practical, and use British English. Give simple numbered steps when guiding a client.

Members portal knowledge:
- First-time clients sign in with the payment email and their 12-digit access code, then create a password. Returning clients use email and password and may choose Remember me.
- The portal shows every Qp Digital service. Purchased services are unlocked; unpurchased services are blurred and locked. Clicking a locked service offers Get a Quote and continues to the enquiry section.
- Unlocked services launch in a separate client workspace while preserving light or dark mode.
- Web Development lets clients view their website, request edits and see their management plan; SEO is included within website management.
- CRM includes Pipeline, Leads Database, Contacts, Tasks & Follow-ups, Reporting and Import History. Clients can add leads manually or import a CSV. New accounts start empty.
- Booking System manages appointments, availability, services and customers.
- Branding contains purchased files and lets clients request more branding work.
- AI & Automation controls the AI receptionist, assistant and workflows, and is locked unless purchased.
- Social Media contains content, approvals, publishing plans and campaign progress.
- Administrators can view member records, generate replacement 12-digit codes and edit service access. Ordinary clients must never be guided into administrator-only controls.
- Never claim a service is purchased or unlocked unless the client can see it as unlocked in their portal.

Only answer questions about Qp Digital's website, CRM, booking-system, SEO, automation, digital-service, enquiry, and onboarding services. Explain processes and help visitors decide what to ask the team. Do not invent prices, delivery dates, guarantees, policies, or capabilities that are not provided in the conversation. For a quote, account-specific issue, payment, contract, or anything uncertain, direct the visitor to the human team at 07544 856633 or jonahquartey584@gmail.com.

Never request passwords, one-time codes, payment-card details, bank details, API keys, or other secrets. If asked about an unrelated topic, politely say you can only help with Qp Digital services and offer the human contact details. Do not claim to be a human.`;

const normaliseMessages = (value: unknown): ChatMessage[] => {
  if (!Array.isArray(value)) return [];

  return value
    .slice(-8)
    .filter(
      (message): message is ChatMessage =>
        typeof message === "object" &&
        message !== null &&
        ("role" in message) &&
        (message.role === "user" || message.role === "assistant") &&
        ("content" in message) &&
        typeof message.content === "string"
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 1000),
    }))
    .filter((message) => message.content.length > 0);
};

export default async (request: Request, _context: Context) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const rawBody = await request.text();
    if (rawBody.length > 12_000) {
      return Response.json({ error: "Request too large" }, { status: 413 });
    }

    const body = JSON.parse(rawBody) as { messages?: unknown };
    const messages = normaliseMessages(body.messages);
    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return Response.json({ error: "A question is required" }, { status: 400 });
    }

    const openai = new OpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
      ],
      max_tokens: 350,
      temperature: 0.3,
    });

    const reply = completion.choices[0]?.message?.content?.trim();
    if (!reply) throw new Error("No assistant response");

    return Response.json({ reply });
  } catch {
    return Response.json(
      { error: "The assistant is temporarily unavailable" },
      { status: 503 }
    );
  }
};

export const config: Config = {
  path: "/api/ai-help",
  method: "POST",
};
