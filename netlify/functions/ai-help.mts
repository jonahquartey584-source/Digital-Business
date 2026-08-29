import OpenAI from "openai";
import type { Config, Context } from "@netlify/functions";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const SYSTEM_PROMPT = `You are the Qp Digital website help-centre assistant. Be concise, friendly, practical, and use British English.

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
