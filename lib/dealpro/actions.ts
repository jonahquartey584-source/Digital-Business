"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { hasActiveSubscription } from "@/lib/subscription";
import { refundCredits, reserveCredits } from "@/lib/dealpro/credits";
import { isAiConfigured, parseAdvertWithAI, researchDeal } from "@/lib/dealpro/ai";
import {
  DEAL_STATUSES,
  DD_STATUSES,
  DD_TEMPLATE,
  DEFAULT_ASSUMPTIONS,
  DEFAULT_NOTICE,
  DEFAULT_PACK,
  emptyDiligence,
  normalizeDeal,
  parseAdvertLocally,
  type Assumptions,
  type CreditAction,
  type Deal,
  type DealStatus,
  type DealUnit,
  type DdItem,
  type NoticeFields,
  type PackSettings,
  type ParsedAdvert,
} from "@/lib/dealpro/model";

async function requireDealProAccess() {
  if (!isSupabaseConfigured) redirect("/login");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const allowed = await hasActiveSubscription("dealpro");
  if (!allowed) redirect("/dashboard/billing?upgrade=dealpro");
  return { supabase, user: user! };
}

async function loadDeal(supabase: Awaited<ReturnType<typeof createClient>>, id: string): Promise<Deal> {
  const { data } = await supabase.from("dealpro_deals").select("*").eq("id", id).maybeSingle<Deal>();
  if (!data) throw new Error("Deal not found.");
  return normalizeDeal(data);
}

/** Result type for actions the client awaits directly (not form actions). */
export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
}

// ---------- sanitising client input ----------

const n = (v: unknown, fallback = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
};
const s = (v: unknown, max = 500) => (typeof v === "string" ? v.slice(0, max) : "");

function cleanUnits(v: unknown): DealUnit[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 50).map((u) => ({
    label: s(u?.label, 80) || "Unit",
    rent: n(u?.rent),
    dep: n(u?.dep),
    rate: n(u?.rate),
  }));
}

function cleanAssumptions(v: Partial<Assumptions> | undefined): Assumptions {
  return {
    fee: n(v?.fee, DEFAULT_ASSUMPTIONS.fee),
    clean: n(v?.clean, DEFAULT_ASSUMPTIONS.clean),
    stay: Math.max(1, n(v?.stay, DEFAULT_ASSUMPTIONS.stay)),
    other: n(v?.other, DEFAULT_ASSUMPTIONS.other),
  };
}

function cleanDiligence(v: unknown, existing: DdItem[]): DdItem[] {
  const items = Array.isArray(v) ? (v as Partial<DdItem>[]) : [];
  return DD_TEMPLATE.map((t) => {
    const prev = existing.find((x) => x.k === t.k);
    const next = items.find((x) => x?.k === t.k);
    return {
      k: t.k,
      s: DD_STATUSES.includes(next?.s as DdItem["s"]) ? (next!.s as DdItem["s"]) : prev?.s ?? "none",
      n: next ? s(next.n, 4000) : prev?.n ?? "",
      // AI drafts are only ever written by runDealResearch, never by the client.
      ai: prev?.ai ?? null,
    };
  });
}

function cleanPack(v: Partial<PackSettings> | undefined, existing: PackSettings): PackSettings {
  return {
    biz: s(v?.biz, 200),
    redress: s(v?.redress, 200),
    fee: s(v?.fee, 200),
    nda: v?.nda !== false,
    // Only finalizePack can set this (it costs credits).
    final: existing.final,
  };
}

function cleanNotice(v: Partial<NoticeFields> | undefined): NoticeFields {
  const out = { ...DEFAULT_NOTICE };
  for (const k of Object.keys(DEFAULT_NOTICE) as (keyof NoticeFields)[]) {
    if (v && typeof v[k] === "string") out[k] = s(v[k], 500);
  }
  return out;
}

// ---------- deals ----------

export async function createDeal() {
  const { supabase, user } = await requireDealProAccess();
  const { data, error } = await supabase
    .from("dealpro_deals")
    .insert({
      owner_id: user.id,
      name: "New deal",
      units: [{ label: "Unit 1", rent: 1500, dep: 1500, rate: 150 }],
      assumptions: DEFAULT_ASSUMPTIONS,
      diligence: emptyDiligence(),
      pack: DEFAULT_PACK,
      notice: DEFAULT_NOTICE,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) throw new Error("Couldn't create the deal. Please try again.");
  revalidatePath("/dashboard/dealpro");
  redirect(`/dashboard/dealpro/${data.id}`);
}

export interface DealPatch {
  name?: string;
  area?: string;
  strategy?: string;
  london?: boolean;
  units?: DealUnit[];
  assumptions?: Assumptions;
  diligence?: DdItem[];
  pack?: PackSettings;
  notice?: NoticeFields;
}

/** Autosave from the deal workspace. Returns the saved deal. */
export async function saveDeal(id: string, patch: DealPatch): Promise<ActionResult<Deal>> {
  try {
    const { supabase } = await requireDealProAccess();
    const current = await loadDeal(supabase, id);

    const update: Record<string, unknown> = {};
    if (patch.name !== undefined) update.name = s(patch.name, 200) || "Untitled deal";
    if (patch.area !== undefined) update.area = s(patch.area, 200) || null;
    if (patch.strategy !== undefined) update.strategy = patch.strategy === "R2R" ? "R2R" : "R2SA";
    if (patch.london !== undefined) update.london = !!patch.london;
    if (patch.units !== undefined) update.units = cleanUnits(patch.units);
    if (patch.assumptions !== undefined) update.assumptions = cleanAssumptions(patch.assumptions);
    if (patch.diligence !== undefined) update.diligence = cleanDiligence(patch.diligence, current.diligence);
    if (patch.pack !== undefined) update.pack = cleanPack(patch.pack, current.pack);
    if (patch.notice !== undefined) update.notice = cleanNotice(patch.notice);

    const { data, error } = await supabase
      .from("dealpro_deals")
      .update(update)
      .eq("id", id)
      .select("*")
      .single<Deal>();
    if (error || !data) throw new Error("Couldn't save the deal. Please try again.");
    revalidatePath("/dashboard/dealpro");
    return { ok: true, data: normalizeDeal(data) };
  } catch (e) {
    unstable_rethrow(e);
    return fail(e);
  }
}

export async function setDealStatus(id: string, status: string) {
  const { supabase } = await requireDealProAccess();
  if (!DEAL_STATUSES.includes(status as DealStatus)) throw new Error("Unknown status.");
  await supabase.from("dealpro_deals").update({ status }).eq("id", id);
  revalidatePath("/dashboard/dealpro");
}

export async function deleteDeal(id: string) {
  const { supabase } = await requireDealProAccess();
  await supabase.from("dealpro_deals").delete().eq("id", id);
  revalidatePath("/dashboard/dealpro");
}

// ---------- AI tasks (spend credits) ----------

/**
 * Reserves credits, runs `work`, and refunds the reservation if it throws.
 * The deal is loaded through the user's RLS-scoped client first, so a
 * user can only ever spend on, and write to, their own deals.
 */
async function withCredits(
  id: string,
  action: CreditAction,
  work: (ctx: { deal: Deal; userId: string }) => Promise<Deal>
): Promise<ActionResult<Deal>> {
  let reservation: string | null = null;
  try {
    const { supabase, user } = await requireDealProAccess();
    const deal = await loadDeal(supabase, id);
    reservation = await reserveCredits(user, action, id);
    const saved = await work({ deal, userId: user.id });
    revalidatePath("/dashboard/dealpro");
    return { ok: true, data: normalizeDeal(saved) };
  } catch (e) {
    if (reservation) await refundCredits(reservation);
    unstable_rethrow(e);
    return fail(e);
  }
}

/** Writes fields only the server may set (see 0007's trigger). Scoped to the owner explicitly since this bypasses RLS. */
async function adminUpdateDeal(id: string, userId: string, update: Record<string, unknown>): Promise<Deal> {
  const { data, error } = await createAdminClient()
    .from("dealpro_deals")
    .update(update)
    .eq("id", id)
    .eq("owner_id", userId)
    .select("*")
    .single<Deal>();
  if (error || !data) throw new Error("Couldn't save the deal. Please try again.");
  return data;
}

/** Parses a pasted advert into a new unit on the deal. 1 credit. */
export async function importAdvert(id: string, advert: string): Promise<ActionResult<Deal>> {
  const text = s(advert, 8000).trim();
  if (!text) return { ok: false, error: "Paste an advert first." };
  return withCredits(id, "import", async ({ deal, userId }) => {
    const parsed: ParsedAdvert = isAiConfigured ? await parseAdvertWithAI(text) : parseAdvertLocally(text);
    if (!parsed.rent) throw new Error('No rent found. Check the advert includes the monthly rent, e.g. "Rent £1,500".');

    const nextNo = deal.units.length + 1;
    const units = cleanUnits([
      ...deal.units,
      {
        label: parsed.label ? `${parsed.label} ${nextNo}` : `Unit ${nextNo}`,
        rent: parsed.rent,
        dep: parsed.dep ?? parsed.rent,
        rate: parsed.rate ?? 150,
      },
    ]);
    return adminUpdateDeal(id, userId, { units, area: deal.area || s(parsed.area, 200) || null });
  });
}

/** Drafts AI findings for every due diligence check. 5 credits. */
export async function runDealResearch(id: string): Promise<ActionResult<Deal>> {
  if (!isAiConfigured) return { ok: false, error: "AI research isn't set up yet (ANTHROPIC_API_KEY is missing)." };
  return withCredits(id, "research", async ({ deal, userId }) => {
    const findings = await researchDeal(deal);
    const diligence = deal.diligence.map((item) => {
      const f = findings.find((x) => x.k === item.k);
      if (!f) return item;
      // Never overwrite a status the user already set themselves.
      return { ...item, ai: s(f.n, 4000), s: item.s === "none" ? f.s : item.s };
    });
    return adminUpdateDeal(id, userId, { diligence, ai_researched_at: new Date().toISOString() });
  });
}

/** Marks the investor pack final (removes the preview watermark). 3 credits, once per deal. */
export async function finalizePack(id: string): Promise<ActionResult<Deal>> {
  try {
    const { supabase } = await requireDealProAccess();
    const deal = await loadDeal(supabase, id);
    if (deal.pack.final) return { ok: true, data: deal };
  } catch (e) {
    unstable_rethrow(e);
    return fail(e);
  }
  return withCredits(id, "pack", ({ deal, userId }) =>
    adminUpdateDeal(id, userId, { pack: { ...deal.pack, final: true } })
  );
}
