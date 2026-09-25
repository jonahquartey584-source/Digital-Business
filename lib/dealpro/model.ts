// Deal Pro — pure deal model. No I/O, safe to import from client and
// server components alike. All the "live number-crunching" (monthly model,
// sensitivity, break-even, automatic flags) lives here.

export type Strategy = "R2SA" | "R2R";
export type DealStatus = "Checking" | "Issue found" | "Sent to sourcer" | "Completed";
export type DdStatus = "none" | "partly" | "verified" | "issue";

export interface DealUnit {
  label: string;
  rent: number; // pcm, bills included
  dep: number; // deposit
  rate: number; // nightly rate
}

export interface Assumptions {
  fee: number; // platform fees, %
  clean: number; // cleaning per stay, £
  stay: number; // average stay, nights
  other: number; // other costs per unit per month, £
}

export interface DdItem {
  k: string;
  s: DdStatus;
  n: string; // the user's own notes/evidence
  ai?: string | null; // AI-drafted finding, if research has run
}

export interface PackSettings {
  biz: string;
  redress: string;
  fee: string;
  nda: boolean;
  final: boolean;
}

export interface NoticeFields {
  co: string;
  email: string;
  addr: string;
  ll: string;
  role: string;
  phone: string;
  lemail: string;
  use: string;
  docs: string;
}

/** Row shape of public.dealpro_deals (supabase/migrations/0006_dealpro.sql). */
export interface Deal {
  id: string;
  owner_id: string;
  name: string;
  area: string | null;
  strategy: Strategy;
  london: boolean;
  status: DealStatus;
  units: DealUnit[];
  assumptions: Assumptions;
  diligence: DdItem[];
  ai_researched_at: string | null;
  pack: PackSettings;
  notice: NoticeFields;
  created_at: string;
  updated_at: string;
}

export const DEAL_STATUSES: DealStatus[] = ["Checking", "Issue found", "Sent to sourcer", "Completed"];

export const DD_TEMPLATE: { k: string; t: string; d: string }[] = [
  { k: "terms", t: "Advertised terms", d: "Written offer, rent, deposit, which bills are included (including council tax), usage caps, inventory, availability." },
  { k: "consent", t: "Short-let consent", d: "Landlord identity and title checked; signed agreement permitting the use; freeholder, lender and insurer consent." },
  { k: "ninety", t: "London letting limit", d: "90 nights a year without planning permission for stays under 90 consecutive nights. Planning position for year-round use." },
  { k: "licence", t: "Licensing", d: "Selective / HMO licensing for the ward; whether the licence allows subletting." },
  { k: "tax", t: "Council tax and rates", d: "Second-home premium, who pays it, and whether business rates apply." },
  { k: "location", t: "Location claims", d: "Stations, zone, walking times and other advert claims checked against the address." },
  { k: "safety", t: "Condition and safety", d: "EPC, gas and electrical certificates, fire-risk assessment, alarms, insurance, inventory." },
  { k: "rates", t: "Nightly rate evidence", d: "Comparable listings, seasonality, event demand, achieved booking data." },
];

export const DD_LABEL: Record<DdStatus, string> = {
  none: "Not checked",
  partly: "Partly checked",
  verified: "Verified",
  issue: "Issue found",
};

export const DD_STATUSES = Object.keys(DD_LABEL) as DdStatus[];

export const CREDIT_COSTS = { import: 1, research: 5, pack: 3 } as const;
export type CreditAction = keyof typeof CREDIT_COSTS;

export const SAMPLE_ADVERT = `Deal 2 - (£1,650 studio)
📍 Islington, N4 (zone 2) 📍
🔥 Fully Furnished Studio Flat
🛏 Studio (open-plan bedroom)
💸 Rent + Bills £1,650/month (£19,800/year)
💸 Deposit £1,650
💰 Nightly Rate £180`;

export const DEFAULT_ASSUMPTIONS: Assumptions = { fee: 15, clean: 45, stay: 3, other: 150 };

export function emptyDiligence(): DdItem[] {
  return DD_TEMPLATE.map((x) => ({ k: x.k, s: "none", n: "", ai: null }));
}

export const DEFAULT_PACK: PackSettings = { biz: "", redress: "", fee: "", nda: true, final: false };

export const DEFAULT_NOTICE: NoticeFields = {
  co: "",
  email: "",
  addr: "",
  ll: "",
  role: "Owner / landlord",
  phone: "",
  lemail: "",
  use: "Serviced accommodation",
  docs: "Advert, photos, landlord emails",
};

/**
 * Fills in any fields missing from a stored row (older rows, or jsonb
 * columns that defaulted to {}), so the UI never has to null-check.
 */
export function normalizeDeal(row: Deal): Deal {
  const dd = Array.isArray(row.diligence) ? row.diligence : [];
  return {
    ...row,
    units: Array.isArray(row.units) ? row.units : [],
    assumptions: { ...DEFAULT_ASSUMPTIONS, ...(row.assumptions ?? {}) },
    diligence: DD_TEMPLATE.map(
      (t) => dd.find((x) => x.k === t.k) ?? { k: t.k, s: "none", n: "", ai: null }
    ),
    pack: { ...DEFAULT_PACK, ...(row.pack ?? {}) },
    notice: { ...DEFAULT_NOTICE, ...(row.notice ?? {}) },
  };
}

// ---------- formatting ----------

export function gbp(x: number): string {
  if (!Number.isFinite(x)) return "–";
  const r = Math.round(x + 1e-9);
  return (r < 0 ? "-£" : "£") + Math.abs(r).toLocaleString("en-GB");
}

export function pct(x: number): string {
  return Number.isFinite(x) ? `${Math.round(x * 100)}%` : "–";
}

// ---------- the model ----------

/** 30-day month. */
export const DAYS = 30;
export const OCCUPANCY = [0.6, 0.8, 1] as const;

export interface MonthResult {
  nights: number;
  revenue: number;
  fees: number;
  cleaning: number;
  surplus: number;
}

export function month(u: DealUnit, occ: number, a: Assumptions, rate = u.rate): MonthResult {
  const nights = Math.round(DAYS * occ);
  const revenue = nights * rate;
  const fees = (revenue * a.fee) / 100;
  const cleaning = (nights / Math.max(a.stay, 1)) * a.clean;
  return { nights, revenue, fees, cleaning, surplus: revenue - fees - cleaning - u.rent - a.other };
}

/** Occupancy (0–1+) at which a unit covers rent, fees, cleaning and other costs. Infinity if never. */
export function breakEven(u: DealUnit, a: Assumptions, rate = u.rate): number {
  const perNight = rate * (1 - a.fee / 100) - a.clean / Math.max(a.stay, 1);
  if (perNight <= 0) return Infinity;
  return (u.rent + a.other) / perNight / DAYS;
}

export interface DealSummary {
  rent: number;
  deposits: number;
  upfront: number;
  surplus: number[]; // per OCCUPANCY entry, all units
  revenue: number[]; // per OCCUPANCY entry, all units
  breakEvens: number[]; // per unit
  worstBreakEven: number;
}

export function summarize(units: DealUnit[], a: Assumptions): DealSummary {
  const rent = units.reduce((s, u) => s + u.rent, 0);
  const deposits = units.reduce((s, u) => s + u.dep, 0);
  const surplus = OCCUPANCY.map((o) => units.reduce((s, u) => s + month(u, o, a).surplus, 0));
  const revenue = OCCUPANCY.map((o) => units.reduce((s, u) => s + month(u, o, a).revenue, 0));
  const breakEvens = units.map((u) => breakEven(u, a));
  return {
    rent,
    deposits,
    upfront: rent + deposits,
    surplus,
    revenue,
    breakEvens,
    worstBreakEven: breakEvens.length ? Math.max(...breakEvens) : Infinity,
  };
}

export const VAT_THRESHOLD = 90_000;

export interface Flag {
  tone: "bad" | "warn" | "good";
  title: string;
  body: string;
}

/** The automatic flags shown under the summary strip. */
export function dealFlags(deal: Pick<Deal, "units" | "assumptions" | "london" | "strategy">): Flag[] {
  const U = deal.units;
  const s = summarize(U, deal.assumptions);
  const flags: Flag[] = [];

  if (deal.london && deal.strategy === "R2SA") {
    const earn = U.reduce((sum, u) => sum + 90 * u.rate, 0);
    const gap = earn - s.rent * 12;
    flags.push({
      tone: gap < 0 ? "bad" : "warn",
      title: "London 90-night limit.",
      body: `At 90 nights a year the units earn ${gbp(earn)} against ${gbp(s.rent * 12)} rent, ${
        gap < 0 ? `a ${gbp(-gap)} shortfall` : `a ${gbp(gap)} margin`
      } before any other costs. Year-round use needs planning permission or another lawful basis.`,
    });
  }

  const vatIdx = s.revenue.findIndex((r) => r * 12 >= VAT_THRESHOLD);
  if (vatIdx >= 0) {
    flags.push({
      tone: "warn",
      title: "VAT.",
      body: `Run through one business, revenue reaches ${gbp(s.revenue[vatIdx] * 12)} a year at ${pct(
        OCCUPANCY[vatIdx]
      )} occupancy, over the £90,000 VAT threshold. VAT at 20% would cut the surplus.`,
    });
  }

  if (U.some((u) => u.dep > ((u.rent * 12) / 52) * 5)) {
    flags.push({
      tone: "warn",
      title: "Deposit above 5 weeks' rent",
      body: "on at least one unit. The cap applies to lets to individuals.",
    });
  }

  if (!flags.length) {
    flags.push({ tone: "good", title: "No automatic flags.", body: "Due diligence still needs to be completed." });
  }
  return flags;
}

// ---------- advert parsing (regex fallback when AI isn't configured) ----------

export interface ParsedAdvert {
  label: string | null;
  area: string | null;
  rent: number | null;
  dep: number | null;
  rate: number | null;
}

export function parseAdvertLocally(t: string): ParsedAdvert {
  const num = (re: RegExp) => {
    const m = t.match(re);
    return m ? Number(m[1].replace(/,/g, "")) : null;
  };
  const rent = num(/rent[^£\n]*£\s?([\d,]+)/i);
  const dep = num(/deposit[^£\n]*£\s?([\d,]+)/i);
  const rate = num(/nightly\s*rate[^£\n]*£\s?([\d,]+)/i);
  const area = (t.match(/📍\s*([^📍\n]+?)\s*📍/u) || [])[1] ?? null;
  const lab = (t.match(/\(\s*£[\d,]+\s*([a-z ]+)\)/i) || [])[1];
  return {
    rent,
    dep,
    rate,
    area,
    label: lab ? lab.trim().replace(/^\w/, (c) => c.toUpperCase()) : null,
  };
}

// ---------- pack / notice ----------

/** Strips a UK postcode from an area string for the pre-NDA pack. */
export function stripPostcode(area: string): string {
  return area.replace(/,?\s*[A-Z]{1,2}\d[\dA-Z]?\s*\d[A-Z]{2}\b/i, "").trim();
}

export function formatToday(): string {
  return new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function noticeReference(dealId: string): string {
  return "DN-" + dealId.replace(/\W/g, "").toUpperCase().slice(-6).padStart(6, "0");
}

export function noticeText(deal: Deal, senderName: string): string {
  const s = deal.notice;
  const U = deal.units;
  return `To: ${s.co || "[Sourcer company]"} (${s.email || "[notice email]"})
Subject: Deal Notice under Deal Introduction Agreement

Deal Notice reference: ${noticeReference(deal.id)}
Date sent: ${formatToday()}

Property address and postcode: ${s.addr || "[full address]"}
Number of units and type: ${U.length} unit${U.length === 1 ? "" : "s"} (${U.map((u) => u.label).join(", ")})
Rent and deposit asked:
${U.map((u) => `  - ${u.label}: ${gbp(u.rent)}/month, deposit ${gbp(u.dep)}`).join("\n")}

Introduced Contact: ${s.ll || "[name]"} (${s.role}), ${s.phone || "[phone]"}, ${s.lemail || "[email]"}
Use the landlord has agreed to: ${s.use}
Documents attached: ${s.docs || "-"}

Response needed by: within 3 Business Days of this notice. If no reply is received, this property is a Registered Deal under clause 4.2 of our Deal Introduction Agreement.

${senderName}`;
}
