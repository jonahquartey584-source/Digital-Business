import Anthropic from "@anthropic-ai/sdk";
import {
  DD_TEMPLATE,
  DD_STATUSES,
  gbp,
  summarize,
  type Deal,
  type DdStatus,
  type ParsedAdvert,
} from "@/lib/dealpro/model";

let anthropicSingleton: Anthropic | null = null;

export const isAiConfigured = Boolean(process.env.ANTHROPIC_API_KEY);

function getAnthropic(): Anthropic {
  if (!anthropicSingleton) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error("ANTHROPIC_API_KEY is not set. Add it to your environment (see .env.example).");
    }
    anthropicSingleton = new Anthropic({ apiKey: key });
  }
  return anthropicSingleton;
}

const MODEL = "claude-opus-5";

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

function assertNotRefused(response: Anthropic.Message) {
  if (response.stop_reason === "refusal") {
    throw new Error("The AI declined this request. Try rewording the advert or area.");
  }
}

// ---------- advert import ----------

const ADVERT_SCHEMA = {
  type: "object",
  properties: {
    label: { type: ["string", "null"], description: "Short unit name, e.g. 'Studio' or '2-bed flat'" },
    area: { type: ["string", "null"], description: "Area / postcode district / zone as advertised" },
    rent: { type: ["number", "null"], description: "Monthly rent in GBP (convert weekly/annual to monthly)" },
    dep: { type: ["number", "null"], description: "Deposit in GBP" },
    rate: { type: ["number", "null"], description: "Advertised or suggested nightly rate in GBP" },
  },
  required: ["label", "area", "rent", "dep", "rate"],
  additionalProperties: false,
} as const;

/** Extracts one unit's numbers from pasted landlord/sourcing advert text. */
export async function parseAdvertWithAI(advert: string): Promise<ParsedAdvert> {
  const response = await getAnthropic().messages.create({
    model: MODEL,
    max_tokens: 1024,
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: ADVERT_SCHEMA },
    },
    system:
      "You extract rental terms from UK property adverts (rent-to-rent / serviced accommodation deals). Use null for anything the advert doesn't state. Never invent figures.",
    messages: [{ role: "user", content: advert }],
  });
  assertNotRefused(response);
  return JSON.parse(textOf(response.content)) as ParsedAdvert;
}

// ---------- due diligence research ----------

export interface ResearchFinding {
  k: string;
  s: DdStatus;
  n: string;
}

function dealBrief(deal: Deal): string {
  const s = summarize(deal.units, deal.assumptions);
  return [
    `Deal: ${deal.name}`,
    `Area: ${deal.area || "not given"}`,
    `Strategy: ${deal.strategy === "R2SA" ? "rent-to-serviced-accommodation (short lets)" : "rent-to-rent"}`,
    `In London: ${deal.london ? "yes" : "no"}`,
    `Units:`,
    ...deal.units.map(
      (u) => `  - ${u.label}: rent ${gbp(u.rent)}/month incl. bills, deposit ${gbp(u.dep)}, nightly rate £${u.rate}`
    ),
    `Total rent ${gbp(s.rent)}/month. Modelled monthly surplus: ${gbp(s.surplus[0])} at 60% occupancy, ${gbp(
      s.surplus[1]
    )} at 80%.`,
  ].join("\n");
}

const CHECKLIST = DD_TEMPLATE.map((t) => `- ${t.k} (${t.t}): ${t.d}`).join("\n");

const FINDINGS_SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          k: { type: "string", enum: DD_TEMPLATE.map((t) => t.k) },
          s: { type: "string", enum: DD_STATUSES },
          n: { type: "string" },
        },
        required: ["k", "s", "n"],
        additionalProperties: false,
      },
    },
  },
  required: ["findings"],
  additionalProperties: false,
} as const;

/**
 * Drafts a finding for each due diligence check. Two calls: a research
 * pass with web search (free-form notes with sources), then a cheap
 * structuring pass that turns the notes into one finding per check. The
 * user still confirms every finding — the UI labels these as AI drafts.
 */
export async function researchDeal(deal: Deal): Promise<ResearchFinding[]> {
  const client = getAnthropic();

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Research this UK property deal for due diligence before it goes to investors.

${dealBrief(deal)}

For each check below, search public sources (council licensing and planning pages, council tax policy, TfL / National Rail, listing-market data) and write what you found for this area, with the source name and date. Be concrete: name the council, scheme, fees and dates. Where something can only be confirmed with documents from the landlord (title, signed consent, certificates), say exactly what to request. Where the advert or the numbers look wrong, say so plainly.

Checks:
${CHECKLIST}`,
    },
  ];

  let notes = "";
  // Server-side web search can pause long turns; resume up to a few times.
  for (let i = 0; i < 4; i++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 10, user_location: { type: "approximate", country: "GB" } }],
      messages,
    });
    assertNotRefused(response);
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    notes = textOf(response.content);
    break;
  }
  if (!notes) throw new Error("AI research didn't finish. Please try again.");

  const structured = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: FINDINGS_SCHEMA },
    },
    system: `Turn due diligence research notes into exactly one finding per check key (${DD_TEMPLATE.map(
      (t) => t.k
    ).join(", ")}). Status: "issue" if the notes show a problem, "partly" if some of it is confirmed from public sources but documents are still needed, "none" if nothing could be checked publicly. Never use "verified" — only the user can verify. Each note: 1–3 plain sentences, keep figures, names and sources.`,
    messages: [{ role: "user", content: notes }],
  });
  assertNotRefused(structured);
  const parsed = JSON.parse(textOf(structured.content)) as { findings: ResearchFinding[] };
  return parsed.findings.map((f) => ({ ...f, s: f.s === "verified" ? "partly" : f.s }));
}
