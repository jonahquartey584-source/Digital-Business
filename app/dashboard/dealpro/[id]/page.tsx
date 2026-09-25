import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCreditBalance } from "@/lib/dealpro/credits";
import { isAiConfigured } from "@/lib/dealpro/ai";
import { normalizeDeal, type Deal } from "@/lib/dealpro/model";
import { DealWorkspace, type WorkspaceTab } from "@/components/dealpro/workspace";

export const dynamic = "force-dynamic";

const TABS: WorkspaceTab[] = ["analyse", "diligence", "pack", "notice"];

export default async function DealPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data }, { data: profile }, balance] = await Promise.all([
    supabase.from("dealpro_deals").select("*").eq("id", id).maybeSingle<Deal>(),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle<{ full_name: string | null }>(),
    getCreditBalance(supabase, user),
  ]);
  if (!data) notFound();

  const tab = TABS.includes(sp.tab as WorkspaceTab) ? (sp.tab as WorkspaceTab) : "analyse";

  return (
    <DealWorkspace
      initialDeal={normalizeDeal(data)}
      initialTab={tab}
      credits={balance.unlimited ? null : balance.remaining}
      senderName={profile?.full_name?.trim() || user.email || ""}
      aiConfigured={isAiConfigured}
    />
  );
}
