import { redirect } from "next/navigation";
import { hasActiveSubscription } from "@/lib/subscription";
import { VoiceTabs } from "@/components/voice-tabs";

export const dynamic = "force-dynamic";

export default async function VoiceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const allowed = await hasActiveSubscription("voice");
  if (!allowed) redirect("/dashboard/billing?upgrade=voice");

  return (
    <div>
      <h1 className="mb-6 font-display text-2xl font-bold text-cream">AI Reception</h1>
      <VoiceTabs />
      {children}
    </div>
  );
}
