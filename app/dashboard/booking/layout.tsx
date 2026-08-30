import { redirect } from "next/navigation";
import { hasActiveSubscription } from "@/lib/subscription";
import { BookingTabs } from "@/components/booking-tabs";

export const dynamic = "force-dynamic";

export default async function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const allowed = await hasActiveSubscription("booking");
  if (!allowed) redirect("/dashboard/billing?upgrade=booking");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-cream">Booking System</h1>
      </div>
      <BookingTabs />
      {children}
    </div>
  );
}
