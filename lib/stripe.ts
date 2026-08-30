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
  },
} as const;

export type ProductSlug = keyof typeof PRODUCTS;
