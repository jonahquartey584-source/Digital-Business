import { notFound } from "next/navigation";
import { LogoWordmark } from "@/components/logo-wordmark";
import { BookingWidget } from "@/components/booking-widget";
import { getPublicBookingPage } from "@/lib/booking/public";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isSupabaseConfigured) notFound();

  const page = await getPublicBookingPage(slug);
  if (!page) notFound();

  const { settings, services } = page;

  return (
    <main className="min-h-screen bg-ink px-6 py-16">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 text-center">
          <LogoWordmark className="text-xl" />
          <h1 className="mt-6 font-display text-2xl font-bold text-cream">
            Book with {settings.business_name || "us"}
          </h1>
          {settings.description && (
            <p className="mt-2 text-sm text-cream-dim">{settings.description}</p>
          )}
        </div>

        <BookingWidget slug={slug} services={services} />

        <p className="mt-8 text-center font-mono text-[11px] uppercase tracking-wider text-cream-dim/60">
          Powered by Qp Digital
        </p>
      </div>
    </main>
  );
}
