import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;

/**
 * Lazily-constructed Stripe client. Lazy so that pages which don't touch
 * Stripe can still build/render without STRIPE_SECRET_KEY set.
 */
export function getStripe(): Stripe {
  if (!stripeSingleton) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error(
        "STRIPE_SECRET_KEY is not set. Add it to your environment (see .env.example)."
      );
    }
    stripeSingleton = new Stripe(key, {
      apiVersion: "2026-08-26.dahlia",
    });
  }
  return stripeSingleton;
}

/** Product/price catalog for the SaaS. Add more entries as you launch more services. */
export const PRODUCTS = {
  crm: {
    slug: "crm",
    name: "CRM",
    description:
      "Manage contacts, companies, and your sales pipeline in one place.",
    priceId: process.env.STRIPE_CRM_PRICE_ID ?? "",
    priceLabel: "$29/month",
    features: [
      "Unlimited contacts & companies",
      "Deal pipeline with stages",
      "Activity notes & timeline",
      "Access on web and the Qp Digital app",
    ],
  },
  voice: {
    slug: "voice",
    name: "AI Reception",
    description:
      "Connect your own Twilio number — when a call is missed, an AI answers, talks with the caller, and logs it straight to your CRM.",
    priceId: process.env.STRIPE_VOICE_PRICE_ID ?? "",
    priceLabel: "$49/month",
    features: [
      "Uses your own Twilio number",
      "Real-time AI phone conversations",
      "Auto-logs calls & summaries to your CRM",
      "Ring your team first, or AI-first — your choice",
    ],
  },
  booking: {
    slug: "booking",
    name: "Booking System",
    description:
      "A public booking page your customers use to schedule appointments — synced to your availability and your CRM.",
    priceId: process.env.STRIPE_BOOKING_PRICE_ID ?? "",
    priceLabel: "$19/month",
    features: [
      "Your own public booking page",
      "Set your weekly hours & services",
      "Double-booking prevented automatically",
      "New bookings logged straight to your CRM",
    ],
  },
} as const;

export type ProductSlug = keyof typeof PRODUCTS;
